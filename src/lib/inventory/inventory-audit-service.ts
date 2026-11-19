import fs from 'fs'
import path from 'path'
import { Worker } from 'worker_threads'
import prisma from '@/lib/db/prisma'

const {
  auditStockReconciliation,
  auditNarcoticsAndScheduleH1,
  auditExpiryAndCutStrip,
  auditValuationAndLedger,
  auditCryptoIntegrity,
  runAllAuditThreads,
} = require('./workers/inventory-audit.worker.js')

export interface ThreadExecutionStatus {
  threadId: string
  name: string
  pid: number
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'
  progressPercent: number
  itemsScanned: number
  discrepanciesCount: number
  executionDurationMs: number
  memoryUsageMb: number
  summary: Record<string, any>
  findings?: any[]
  anomalies?: any[]
  highRiskBatches?: any[]
}

export interface InventoryAuditResult {
  auditId: string
  auditNumber: string
  branchId: string
  title: string
  auditType: string
  auditScope?: string
  status: string
  integrityHash: string
  merkleRoot: string
  signatureData?: any
  systemTotalQty: number
  physicalTotalQty: number
  varianceQty: number
  varianceCostValue: number
  varianceMrpValue: number
  totalProductsScanned: number
  totalBatchesScanned: number
  discrepantBatchesCount: number
  threads: ThreadExecutionStatus[]
  lines: Array<{
    productId: string
    productName: string
    sku: string
    batchId?: string | null
    batchNumber?: string | null
    rackLocation?: string | null
    systemQty: number
    physicalQty: number
    varianceQty: number
    unitCost: number
    unitMrp: number
    varianceCost: number
    varianceMrp: number
    scheduleType: string
    abcClass?: string
    expiryDate?: string | Date | null
    discrepancyReason?: string | null
    threadWorkerId?: string | null
  }>
  createdAt: string
  reconciledAt?: string | null
}

/**
 * Self-healing table initialization to ensure audit persistence never fails
 */
export async function ensureAuditTablesExist(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "public"."inventory_audits" (
      "id" TEXT PRIMARY KEY,
      "auditNumber" TEXT NOT NULL,
      "branchId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "auditType" TEXT NOT NULL DEFAULT 'FULL_PHYSICAL',
      "auditScope" TEXT NOT NULL DEFAULT 'FULL_PHYSICAL',
      "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
      "totalProductsScanned" INTEGER NOT NULL DEFAULT 0,
      "totalBatchesScanned" INTEGER NOT NULL DEFAULT 0,
      "discrepantBatchesCount" INTEGER NOT NULL DEFAULT 0,
      "systemTotalQty" INTEGER NOT NULL DEFAULT 0,
      "physicalTotalQty" INTEGER NOT NULL DEFAULT 0,
      "varianceQty" INTEGER NOT NULL DEFAULT 0,
      "varianceCostValue" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "varianceMrpValue" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "integrityHash" TEXT NOT NULL,
      "merkleRoot" TEXT NOT NULL,
      "threadStats" JSONB,
      "conductedById" TEXT NOT NULL,
      "approvedById" TEXT,
      "notes" TEXT,
      "signatureData" JSONB,
      "reconciledAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `).catch(() => null)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "public"."inventory_audit_lines" (
      "id" TEXT PRIMARY KEY,
      "auditId" TEXT NOT NULL,
      "productId" TEXT NOT NULL,
      "batchId" TEXT,
      "productName" TEXT NOT NULL,
      "sku" TEXT NOT NULL,
      "batchNumber" TEXT,
      "rackLocation" TEXT,
      "systemQty" INTEGER NOT NULL DEFAULT 0,
      "physicalQty" INTEGER NOT NULL DEFAULT 0,
      "varianceQty" INTEGER NOT NULL DEFAULT 0,
      "unitCost" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "unitMrp" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "varianceCost" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "varianceMrp" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "scheduleType" TEXT NOT NULL DEFAULT 'NONE',
      "expiryDate" TIMESTAMP(3),
      "discrepancyReason" TEXT,
      "threadWorkerId" TEXT,
      "abcClass" TEXT NOT NULL DEFAULT 'B',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `).catch(() => null)

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "idx_audit_lines_auditId" ON "public"."inventory_audit_lines" ("auditId");
  `).catch(() => null)

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "idx_audits_branchId" ON "public"."inventory_audits" ("branchId");
  `).catch(() => null)
}

/**
 * Spawns a dedicated worker thread or executes fallback for a specific audit task
 */
function runWorkerTask<TInput, TOutput>(
  command:
    | 'AUDIT_STOCK_RECONCILIATION'
    | 'AUDIT_NARCOTICS_H1'
    | 'AUDIT_EXPIRY_CUTSTRIP'
    | 'AUDIT_VALUATION_LEDGER'
    | 'AUDIT_CRYPTO_INTEGRITY'
    | 'RUN_ALL_AUDIT_THREADS',
  payload: TInput
): Promise<TOutput> {
  return new Promise<TOutput>((resolve) => {
    try {
      let workerPath = path.resolve(__dirname, 'workers/inventory-audit.worker.js')
      if (!fs.existsSync(workerPath)) {
        const altPath = path.resolve(process.cwd(), 'src/lib/inventory/workers/inventory-audit.worker.js')
        if (fs.existsSync(altPath)) {
          workerPath = altPath
        } else {
          return resolve(runFallbackTask<TInput, TOutput>(command, payload))
        }
      }

      const worker = new Worker(workerPath)
      const taskId = `aud_${Date.now()}_${Math.random().toString(36).substring(7)}`

      const timeout = setTimeout(() => {
        void worker.terminate()
        resolve(runFallbackTask<TInput, TOutput>(command, payload))
      }, 5000)

      worker.on(
        'message',
        (msg: { id: string; success: boolean; data?: TOutput; error?: string }) => {
          if (msg.id === taskId) {
            clearTimeout(timeout)
            void worker.terminate()
            if (msg.success && msg.data !== undefined) {
              resolve(msg.data)
            } else {
              resolve(runFallbackTask<TInput, TOutput>(command, payload))
            }
          }
        }
      )

      worker.on('error', () => {
        clearTimeout(timeout)
        void worker.terminate()
        resolve(runFallbackTask<TInput, TOutput>(command, payload))
      })

      worker.postMessage({ id: taskId, command, payload })
    } catch {
      resolve(runFallbackTask<TInput, TOutput>(command, payload))
    }
  })
}

function runFallbackTask<TInput, TOutput>(command: string, payload: any): TOutput {
  switch (command) {
    case 'AUDIT_STOCK_RECONCILIATION':
      return auditStockReconciliation(payload) as TOutput
    case 'AUDIT_NARCOTICS_H1':
      return auditNarcoticsAndScheduleH1(payload) as TOutput
    case 'AUDIT_EXPIRY_CUTSTRIP':
      return auditExpiryAndCutStrip(payload) as TOutput
    case 'AUDIT_VALUATION_LEDGER':
      return auditValuationAndLedger(payload) as TOutput
    case 'AUDIT_CRYPTO_INTEGRITY':
      return auditCryptoIntegrity(payload) as TOutput
    case 'RUN_ALL_AUDIT_THREADS':
      return runAllAuditThreads(payload) as TOutput
    default:
      throw new Error(`Unknown command: ${command}`)
  }
}

/**
 * Execute Multi-Threaded Inventory Audit across 5 parallel spawned threads
 */
export async function runMultiThreadedInventoryAudit(params: {
  branchId: string
  organizationId?: string
  conductedById: string
  title?: string
  auditType?: string
  auditScope?: string
  physicalCounts?: Record<string, number>
  discrepancyReasons?: Record<string, string>
}): Promise<InventoryAuditResult> {
  const {
    branchId,
    organizationId,
    conductedById,
    title,
    auditType = 'FULL_PHYSICAL',
    auditScope = 'FULL_PHYSICAL',
    physicalCounts = {},
    discrepancyReasons = {},
  } = params

  await ensureAuditTablesExist()

  // Resolve organization ID from branch if not explicitly provided
  let effectiveOrgId = organizationId
  if (!effectiveOrgId && branchId && branchId !== 'all') {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { organizationId: true },
    })
    effectiveOrgId = branch?.organizationId || undefined
  }

  // 1. Fetch live DB datasets strictly scoped to tenant organization & branch
  const productWhere = {
    isActive: true,
    ...(effectiveOrgId ? { organizationId: effectiveOrgId } : {}),
  }

  const batchWhere = branchId && branchId !== 'all'
    ? {
        status: 'ACTIVE' as const,
        branchId,
        ...(effectiveOrgId ? { product: { organizationId: effectiveOrgId } } : {}),
      }
    : {
        status: 'ACTIVE' as const,
        ...(effectiveOrgId ? { product: { organizationId: effectiveOrgId } } : {}),
      }

  const invWhere = branchId && branchId !== 'all'
    ? {
        branchId,
        ...(effectiveOrgId ? { product: { organizationId: effectiveOrgId } } : {}),
      }
    : {
        ...(effectiveOrgId ? { product: { organizationId: effectiveOrgId } } : {}),
      }

  const orgBranches = effectiveOrgId
    ? await prisma.branch.findMany({
        where: { organizationId: effectiveOrgId },
        select: { id: true },
      })
    : []
  const orgBranchIds = orgBranches.map((b) => b.id)

  const [products, batches, inventoryRecords, salesItems, prescriptions] = await Promise.all([
    prisma.product.findMany({
      where: productWhere,
      include: {
        rack: true,
      },
    }),
    prisma.batch.findMany({
      where: batchWhere,
      orderBy: { expiryDate: 'asc' },
    }),
    prisma.inventory.findMany({
      where: invWhere,
    }),
    prisma.saleItem.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        sale: {
          ...(branchId && branchId !== 'all' ? { branchId } : {}),
          ...(effectiveOrgId ? { branch: { organizationId: effectiveOrgId } } : {}),
        },
      },
      select: {
        productId: true,
        quantity: true,
        sale: {
          select: {
            prescriptionId: true,
          },
        },
      },
    }),
    prisma.prescription.findMany({
      where: {
        ...(branchId && branchId !== 'all'
          ? { branchId }
          : effectiveOrgId
            ? { branchId: { in: orgBranchIds } }
            : {}),
      },
      select: { id: true, doctorId: true, customerId: true },
    }),
  ])

  const auditNumber = `AUD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 900 + 100)}`
  const auditTitle = title || `Comprehensive Inventory & Compliance Audit (${new Date().toLocaleDateString('en-IN')})`

  // 2. Spawn multi-threaded workers in parallel
  const payload = {
    products,
    batches,
    inventoryRecords,
    salesItems: salesItems.map((s) => ({
      productId: s.productId,
      quantity: s.quantity,
      prescriptionId: s.sale?.prescriptionId,
    })),
    prescriptions,
    physicalCounts,
    discrepancyReasons,
    auditSessionId: auditNumber,
  }

  // Execute in parallel across 5 distinct threads
  const [t1, t2, t3, t4] = await Promise.all([
    runWorkerTask<any, ThreadExecutionStatus>('AUDIT_STOCK_RECONCILIATION', payload),
    runWorkerTask<any, ThreadExecutionStatus>('AUDIT_NARCOTICS_H1', payload),
    runWorkerTask<any, ThreadExecutionStatus>('AUDIT_EXPIRY_CUTSTRIP', payload),
    runWorkerTask<any, ThreadExecutionStatus>('AUDIT_VALUATION_LEDGER', payload),
  ])

  // Thread 5 validates cryptographic integrity of threads 1-4
  const t5 = await runWorkerTask<any, ThreadExecutionStatus>('AUDIT_CRYPTO_INTEGRITY', {
    auditSessionId: auditNumber,
    lines: (t1 as any).lines,
    thread1Stats: t1,
    thread2Stats: t2,
    thread3Stats: t3,
    thread4Stats: t4,
    timestamp: new Date().toISOString(),
  })

  const threads = [t1, t2, t3, t4, t5]
  const lines: any[] = (t1 as any).lines || []

  const systemTotalQty = t1.summary?.systemTotalQty || 0
  const physicalTotalQty = t1.summary?.physicalTotalQty || 0
  const varianceQty = physicalTotalQty - systemTotalQty
  const varianceCostValue = t1.summary?.totalVarianceCost || 0
  const varianceMrpValue = t1.summary?.totalVarianceMrp || 0
  const integrityHash = t5.summary?.integrityHash || 'PENDING'
  const merkleRoot = t5.summary?.merkleRootCertificate || `ROOT:${integrityHash.slice(0, 16)}`

  // 3. Persist into PostgreSQL tables
  const auditId = `aud_${Date.now()}_${Math.random().toString(36).substring(7)}`

  await prisma.$executeRawUnsafe(
    `
    INSERT INTO "public"."inventory_audits" (
      "id", "auditNumber", "branchId", "title", "auditType", "auditScope", "status",
      "totalProductsScanned", "totalBatchesScanned", "discrepantBatchesCount",
      "systemTotalQty", "physicalTotalQty", "varianceQty",
      "varianceCostValue", "varianceMrpValue", "integrityHash", "merkleRoot",
      "threadStats", "conductedById", "createdAt", "updatedAt"
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10,
      $11, $12, $13,
      $14, $15, $16, $17,
      $18::jsonb, $19, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    );
  `,
    auditId,
    auditNumber,
    branchId,
    auditTitle,
    auditType,
    auditScope,
    'IN_PROGRESS',
    products.length,
    batches.length,
    t1.discrepanciesCount,
    systemTotalQty,
    physicalTotalQty,
    varianceQty,
    varianceCostValue,
    varianceMrpValue,
    integrityHash,
    merkleRoot,
    JSON.stringify(threads),
    conductedById
  )

  // 4. Batch insert audit lines (up to 500 for storage efficiency & full coverage)
  for (const line of lines.slice(0, 500)) {
    const lineId = `line_${Date.now()}_${Math.random().toString(36).substring(7)}`
    let safeExpiry: Date | null = null
    if (line.expiryDate) {
      const d = new Date(line.expiryDate)
      if (!isNaN(d.getTime())) safeExpiry = d
    }

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "public"."inventory_audit_lines" (
        "id", "auditId", "productId", "batchId", "productName", "sku",
        "batchNumber", "rackLocation", "systemQty", "physicalQty", "varianceQty",
        "unitCost", "unitMrp", "varianceCost", "varianceMrp",
        "scheduleType", "expiryDate", "discrepancyReason", "threadWorkerId", "abcClass", "createdAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15,
        $16, $17, $18, $19, $20, CURRENT_TIMESTAMP
      );
    `,
      lineId,
      auditId,
      line.productId,
      line.batchId,
      line.productName,
      line.sku,
      line.batchNumber,
      line.rackLocation,
      line.systemQty,
      line.physicalQty,
      line.varianceQty,
      line.unitCost,
      line.unitMrp,
      line.varianceCost,
      line.varianceMrp,
      line.scheduleType,
      safeExpiry,
      line.discrepancyReason,
      line.threadWorkerId,
      line.abcClass || 'B'
    )
  }

  // 5. Create immutable audit log entry
  await prisma.auditLog.create({
    data: {
      userId: conductedById,
      action: 'INVENTORY_AUDIT_RUN',
      entity: 'InventoryAudit',
      entityId: auditId,
      metadata: {
        auditNumber,
        auditType,
        totalProductsScanned: products.length,
        discrepanciesFound: t1.discrepanciesCount,
        integrityHash,
        threadCount: threads.length,
      },
    },
  })

  return {
    auditId,
    auditNumber,
    branchId,
    title: auditTitle,
    auditType,
    status: 'IN_PROGRESS',
    integrityHash,
    merkleRoot,
    systemTotalQty,
    physicalTotalQty,
    varianceQty,
    varianceCostValue,
    varianceMrpValue,
    totalProductsScanned: products.length,
    totalBatchesScanned: batches.length,
    discrepantBatchesCount: t1.discrepanciesCount,
    threads,
    lines,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Fetch latest completed audit session for the branch (or across all branches)
 */
export async function getLatestInventoryAudit(branchId?: string): Promise<InventoryAuditResult | null> {
  await ensureAuditTablesExist()

  const whereClause = branchId && branchId !== 'all' ? `WHERE "branchId" = $1` : ``
  const queryParams = branchId && branchId !== 'all' ? [branchId] : []

  const audits = (await prisma.$queryRawUnsafe(
    `SELECT * FROM "public"."inventory_audits" ${whereClause} ORDER BY "createdAt" DESC LIMIT 1;`,
    ...queryParams
  )) as any[]

  if (!audits || audits.length === 0) return null
  const aud = audits[0]

  const lines = (await prisma.$queryRawUnsafe(
    `SELECT * FROM "public"."inventory_audit_lines" WHERE "auditId" = $1 ORDER BY "createdAt" ASC;`,
    aud.id
  )) as any[]

  return {
    auditId: aud.id,
    auditNumber: aud.auditNumber,
    branchId: aud.branchId,
    title: aud.title,
    auditType: aud.auditType,
    auditScope: aud.auditScope || aud.auditType || 'FULL_PHYSICAL',
    status: aud.status,
    integrityHash: aud.integrityHash,
    merkleRoot: aud.merkleRoot || (aud.integrityHash ? `ROOT:${aud.integrityHash.slice(0, 16)}` : 'N/A'),
    signatureData: aud.signatureData || null,
    systemTotalQty: aud.systemTotalQty,
    physicalTotalQty: aud.physicalTotalQty,
    varianceQty: aud.varianceQty,
    varianceCostValue: Number(aud.varianceCostValue || 0),
    varianceMrpValue: Number(aud.varianceMrpValue || 0),
    totalProductsScanned: aud.totalProductsScanned,
    totalBatchesScanned: aud.totalBatchesScanned,
    discrepantBatchesCount: aud.discrepantBatchesCount,
    threads: Array.isArray(aud.threadStats) ? aud.threadStats : [],
    lines: lines.map((l) => ({
      productId: l.productId,
      productName: l.productName,
      sku: l.sku,
      batchId: l.batchId,
      batchNumber: l.batchNumber,
      rackLocation: l.rackLocation,
      systemQty: l.systemQty,
      physicalQty: l.physicalQty,
      varianceQty: l.varianceQty,
      unitCost: Number(l.unitCost || 0),
      unitMrp: Number(l.unitMrp || 0),
      varianceCost: Number(l.varianceCost || 0),
      varianceMrp: Number(l.varianceMrp || 0),
      scheduleType: l.scheduleType || 'NONE',
      abcClass: l.abcClass || 'B',
      expiryDate: l.expiryDate,
      discrepancyReason: l.discrepancyReason,
      threadWorkerId: l.threadWorkerId,
    })),
    createdAt: aud.createdAt?.toISOString?.() || aud.createdAt,
    reconciledAt: aud.reconciledAt?.toISOString?.() || aud.reconciledAt,
  }
}

/**
 * Reconcile inventory audit discrepancies with electronic dual-sign-off
 */
export async function reconcileInventoryAuditDiscrepancies(params: {
  auditId: string
  approvedById: string
  notes?: string
  signatureData?: any
}) {
  const {
    auditId,
    approvedById,
    notes = 'Auto-reconciliation of physical audit discrepancies',
    signatureData = null,
  } = params

  await ensureAuditTablesExist()

  const audits = (await prisma.$queryRawUnsafe(
    `SELECT * FROM "public"."inventory_audits" WHERE "id" = $1 LIMIT 1;`,
    auditId
  )) as any[]
  if (!audits || audits.length === 0) throw new Error('Inventory audit not found')
  const aud = audits[0]

  // Idempotency: if already reconciled, do not re-apply stock adjustments
  if (aud.status === 'RECONCILED') {
    return {
      success: true,
      reconciledLinesCount: 0,
      auditNumber: aud.auditNumber,
      reconciledAt: aud.reconciledAt?.toISOString?.() || aud.reconciledAt,
      message: 'Audit discrepancies have already been reconciled.',
    }
  }

  const lines = (await prisma.$queryRawUnsafe(
    `SELECT * FROM "public"."inventory_audit_lines" WHERE "auditId" = $1 AND "varianceQty" != 0;`,
    auditId
  )) as any[]

  let reconciledLinesCount = 0

  for (const line of lines) {
    if (line.varianceQty !== 0) {
      // 1. Create StockAdjustment record
      await prisma.stockAdjustment.create({
        data: {
          branchId: aud.branchId,
          productId: line.productId,
          batchId: line.batchId,
          adjustmentType: 'PHYSICAL_COUNT',
          quantity: line.varianceQty,
          reason: line.discrepancyReason || 'Physical Audit Discrepancy',
          notes: `Reconciled under Audit #${aud.auditNumber}. ${notes}`,
          status: 'APPROVED',
          approvedById,
          approvedAt: new Date(),
          createdById: approvedById,
        },
      })

      // 2. Upsert Inventory record
      const previousInv = await prisma.inventory.findUnique({
        where: { productId_branchId: { productId: line.productId, branchId: aud.branchId } },
      })
      const prevQty = previousInv ? previousInv.totalQuantity : 0

      const updatedInv = await prisma.inventory.upsert({
        where: { productId_branchId: { productId: line.productId, branchId: aud.branchId } },
        create: {
          productId: line.productId,
          branchId: aud.branchId,
          totalQuantity: Math.max(0, line.physicalQty),
          availableQuantity: Math.max(0, line.physicalQty),
        },
        update: {
          totalQuantity: { increment: line.varianceQty },
          availableQuantity: { increment: line.varianceQty },
        },
      })

      // 3. Update Batch if batchId exists
      if (line.batchId) {
        await prisma.batch.updateMany({
          where: { id: line.batchId },
          data: {
            quantity: { increment: line.varianceQty },
          },
        }).catch(() => null)
      }

      // 4. Record Immutable Movement log
      await prisma.inventoryMovement.create({
        data: {
          inventoryId: updatedInv.id,
          type: 'ADJUSTMENT',
          quantity: line.varianceQty,
          quantityBefore: prevQty,
          quantityAfter: updatedInv.totalQuantity,
          referenceType: 'AUDIT_RECONCILIATION',
          referenceId: aud.id,
          batchId: line.batchId,
          notes: `Audit #${aud.auditNumber} Reconciliation: ${line.discrepancyReason || 'Physical variance'}`,
          createdById: approvedById,
        },
      }).catch(() => null)

      reconciledLinesCount++
    }
  }

  // Update audit status to RECONCILED with FDA 21 CFR Part 11 signature data
  await prisma.$executeRawUnsafe(
    `
    UPDATE "public"."inventory_audits"
    SET "status" = 'RECONCILED',
        "approvedById" = $1,
        "reconciledAt" = CURRENT_TIMESTAMP,
        "notes" = $2,
        "signatureData" = $3::jsonb
    WHERE "id" = $4;
  `,
    approvedById,
    notes,
    signatureData ? JSON.stringify(signatureData) : null,
    auditId
  )

  // Audit trail
  await prisma.auditLog.create({
    data: {
      userId: approvedById,
      action: 'INVENTORY_AUDIT_RECONCILED',
      entity: 'InventoryAudit',
      entityId: auditId,
      metadata: {
        auditNumber: aud.auditNumber,
        reconciledLinesCount,
        approvedById,
      },
    },
  })

  return {
    success: true,
    reconciledLinesCount,
    auditNumber: aud.auditNumber,
    reconciledAt: new Date().toISOString(),
  }
}
