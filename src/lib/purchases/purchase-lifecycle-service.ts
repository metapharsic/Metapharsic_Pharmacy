// ─────────────────────────────────────────────────────────────
// Complete Pharmacy Purchase Lifecycle Orchestrator
// Controls the end-to-end procurement workflow:
// 1. PR (Purchase Requisition with auto-reorder & ADS calculations)
// 2. RFQ / Supplier Quotation Comparison Matrix (Landed cost & risk)
// 3. PO (Purchase Order with validation, revision, and approval)
// 4. GRN (Goods Receipt with cold chain, QC inspection & quarantine)
// 5. Purchase Invoice (3-Way Matching: PO vs GRN vs Bill)
// 6. Accounts Payable & Supplier Payment (Ledger, due dates, ageing)
// 7. Purchase Return & Debit Note (Stock & financial reversal)
// ─────────────────────────────────────────────────────────────
import path from 'path'
import { Worker } from 'worker_threads'
import { Prisma } from '@prisma/client'

import prisma from '@/lib/db/prisma'
import { assertBranchAccess, type AuthUser } from '@/lib/inventory/branch-access'

const {
  computePurchasePipeline,
  computeReorderSuggestions,
  computeQuotationComparison,
} = require('./workers/purchase-analytics.worker.js')

// ─── Self-Healing PostgreSQL DDL Provisioning ─────────────────

let isTableProvisioned = false

export async function ensurePurchaseTablesProvisioned() {
  if (isTableProvisioned) return

  try {
    if (prisma.$executeRawUnsafe) {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS purchase_requisitions (
          id VARCHAR(64) PRIMARY KEY,
          pr_number VARCHAR(64) UNIQUE NOT NULL,
          branch_id VARCHAR(64) NOT NULL,
          product_id VARCHAR(64) NOT NULL,
          product_name VARCHAR(255) NOT NULL,
          sku VARCHAR(100),
          unit_of_measure VARCHAR(50) DEFAULT 'Strip',
          required_quantity INTEGER NOT NULL,
          estimated_unit_cost NUMERIC(12, 2) DEFAULT 0,
          total_estimated_cost NUMERIC(12, 2) DEFAULT 0,
          required_by_date TIMESTAMP WITH TIME ZONE NOT NULL,
          reason VARCHAR(100) DEFAULT 'LOW_STOCK',
          priority VARCHAR(50) DEFAULT 'NORMAL',
          status VARCHAR(50) DEFAULT 'SUBMITTED',
          requested_by_id VARCHAR(64) NOT NULL,
          approved_by_id VARCHAR(64),
          approved_at TIMESTAMP WITH TIME ZONE,
          rejection_reason TEXT,
          converted_po_id VARCHAR(64),
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `)

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS supplier_quotations (
          id VARCHAR(64) PRIMARY KEY,
          rfq_number VARCHAR(64) NOT NULL,
          supplier_id VARCHAR(64) NOT NULL,
          supplier_name VARCHAR(255) NOT NULL,
          product_id VARCHAR(64) NOT NULL,
          product_name VARCHAR(255) NOT NULL,
          paid_quantity INTEGER NOT NULL,
          free_quantity INTEGER DEFAULT 0,
          basic_rate NUMERIC(12, 2) NOT NULL,
          discount_percent NUMERIC(5, 2) DEFAULT 0,
          tax_percent NUMERIC(5, 2) DEFAULT 0,
          freight_charges NUMERIC(12, 2) DEFAULT 0,
          total_net_payable NUMERIC(12, 2) NOT NULL,
          effective_landed_cost NUMERIC(12, 2) NOT NULL,
          remaining_shelf_life_months INTEGER DEFAULT 24,
          lead_time_days INTEGER DEFAULT 2,
          credit_days INTEGER DEFAULT 30,
          payment_terms VARCHAR(100) DEFAULT '30 Days Net',
          return_policy VARCHAR(255),
          commercial_risk_score INTEGER DEFAULT 90,
          risk_rating VARCHAR(50) DEFAULT 'LOW',
          is_recommended BOOLEAN DEFAULT FALSE,
          status VARCHAR(50) DEFAULT 'RECEIVED',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `)
      isTableProvisioned = true
    }
  } catch (err) {
    // If running in mocked test environment or restricted DDL, proceed gracefully
    isTableProvisioned = true
  }
}

// ─── Multi-Threaded Worker Bridge ─────────────────────────────

async function runPurchaseWorker<TInput, TOutput>(
  command: string,
  payload: TInput
): Promise<TOutput> {
  const isTest = process.env.NODE_ENV === 'test'

  if (isTest) {
    if (command === 'ANALYZE_PURCHASE_PIPELINE') return computePurchasePipeline(payload) as TOutput
    if (command === 'ANALYZE_REORDER_SUGGESTIONS') return computeReorderSuggestions(payload) as TOutput
    if (command === 'COMPARE_QUOTATIONS') return computeQuotationComparison(payload) as TOutput
  }

  return new Promise<TOutput>((resolve, reject) => {
    try {
      const workerPath = path.resolve(__dirname, 'workers/purchase-analytics.worker.js')
      const worker = new Worker(workerPath)
      const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(7)}`

      const timeout = setTimeout(() => {
        void worker.terminate()
        try {
          if (command === 'ANALYZE_PURCHASE_PIPELINE') resolve(computePurchasePipeline(payload))
          else if (command === 'ANALYZE_REORDER_SUGGESTIONS') resolve(computeReorderSuggestions(payload))
          else if (command === 'COMPARE_QUOTATIONS') resolve(computeQuotationComparison(payload))
          else reject(new Error('Worker timed out'))
        } catch (e) {
          reject(e)
        }
      }, 5000)

      worker.on('message', (msg: { id: string; success: boolean; data?: TOutput; error?: string }) => {
        if (msg.id === taskId) {
          clearTimeout(timeout)
          void worker.terminate()
          if (msg.success && msg.data) resolve(msg.data)
          else reject(new Error(msg.error || 'Worker error'))
        }
      })

      worker.on('error', (err) => {
        clearTimeout(timeout)
        void worker.terminate()
        try {
          if (command === 'ANALYZE_PURCHASE_PIPELINE') resolve(computePurchasePipeline(payload))
          else if (command === 'ANALYZE_REORDER_SUGGESTIONS') resolve(computeReorderSuggestions(payload))
          else if (command === 'COMPARE_QUOTATIONS') resolve(computeQuotationComparison(payload))
          else reject(err)
        } catch {
          reject(err)
        }
      })

      worker.postMessage({ id: taskId, command, payload })
    } catch {
      if (command === 'ANALYZE_PURCHASE_PIPELINE') resolve(computePurchasePipeline(payload))
      else if (command === 'ANALYZE_REORDER_SUGGESTIONS') resolve(computeReorderSuggestions(payload))
      else if (command === 'COMPARE_QUOTATIONS') resolve(computeQuotationComparison(payload))
      else reject(new Error('Worker execution unavailable'))
    }
  })
}

// ─── 1. Purchase Pipeline Overview ────────────────────────────

export interface PurchasePipelineOverview {
  totalPoCount: number
  totalPoValue: number
  statusBreakdown: {
    draft: number
    ordered: number
    partiallyReceived: number
    received: number
    invoiced: number
    cancelled: number
  }
  counts?: {
    requisitionsPending: number
    quotesActive: number
    ordersOpen: number
    pendingReceival: number
    pendingInvoicing: number
    overduePayables: number
    pendingReturns: number
  }
  payables: {
    totalOutstanding: number
    dueWithin7Days: number
    dueWithin15Days: number
    dueWithin30Days: number
    overdue: number
  }
  topSupplierExposure: {
    id: string
    name: string
    creditDays: number
    outstandingBalance: number
    gstin: string | null
    dlNumber: string | null
  }[]
  urgentActions?: Array<{
    type: string
    title: string
    description: string
    poId?: string
    purchaseNumber?: string
    actionLabel: string
    targetStage: string
    priority: string
  }>
}

export async function getPurchasePipelineOverview(
  branchId?: string | string[],
  _user?: AuthUser,
  organizationId?: string,
  orgBranchIds?: string[]
): Promise<PurchasePipelineOverview> {
  await ensurePurchaseTablesProvisioned()

  const orgId = organizationId || _user?.organizationId || (!_user?.isSuperAdmin ? '__NO_ACCESS__' : undefined)

  let effectiveBranchIds = orgBranchIds
  if (!effectiveBranchIds && orgId && orgId !== '__NO_ACCESS__') {
    const branches = await prisma.branch.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { id: true },
    })
    effectiveBranchIds = branches.map((b) => b.id)
  } else if (orgId === '__NO_ACCESS__') {
    effectiveBranchIds = []
  }

  const where: Prisma.PurchaseWhereInput = {}
  if (orgId) {
    where.branch = { organizationId: orgId }
  }
  if (Array.isArray(branchId)) {
    where.branchId = { in: branchId }
  } else if (branchId && branchId !== 'all') {
    where.branchId = branchId
  }

  const supplierWhere: Prisma.SupplierWhereInput = {
    isActive: true,
    ...(orgId ? { organizationId: orgId } : (!_user?.isSuperAdmin ? { organizationId: '__NO_ACCESS__' } : {})),
  }

  const returnPurchaseWhere: Prisma.PurchaseWhereInput = {}
  if (orgId) {
    returnPurchaseWhere.branch = { organizationId: orgId }
  }
  if (Array.isArray(branchId)) {
    returnPurchaseWhere.branchId = { in: branchId }
  } else if (branchId && branchId !== 'all') {
    returnPurchaseWhere.branchId = branchId
  }
  const returnWhere: Prisma.PurchaseReturnWhereInput =
    Object.keys(returnPurchaseWhere).length > 0 ? { purchase: returnPurchaseWhere } : {}

  const [purchases, suppliers, supplierCount, returnCount] = await Promise.all([
    prisma.purchase.findMany({
      where,
      include: {
        supplier: {
          select: { id: true, name: true, creditDays: true, outstandingBalance: true },
        },
      },
    }),
    prisma.supplier.findMany({
      where: supplierWhere,
      select: {
        id: true,
        name: true,
        creditDays: true,
        outstandingBalance: true,
        gstin: true,
        dlNumber: true,
      },
      orderBy: { outstandingBalance: 'desc' },
      take: 10,
    }),
    prisma.supplier.count({ where: supplierWhere }),
    prisma.purchaseReturn.count({ where: returnWhere }).catch(() => 0),
  ])

  let prCount = 0
  try {
    let prBranchCondition = ''
    if (orgId) {
      if (!effectiveBranchIds || effectiveBranchIds.length === 0) {
        prBranchCondition = `AND 1 = 0`
      } else if (Array.isArray(branchId) && branchId.length > 0) {
        const allowed = branchId.filter((id) => effectiveBranchIds!.includes(id))
        if (allowed.length === 0) {
          prBranchCondition = `AND 1 = 0`
        } else {
          prBranchCondition = `AND branch_id IN (${allowed.map((id) => `'${id}'`).join(',')})`
        }
      } else if (typeof branchId === 'string' && branchId !== 'all') {
        if (!effectiveBranchIds.includes(branchId)) {
          prBranchCondition = `AND 1 = 0`
        } else {
          prBranchCondition = `AND branch_id = '${branchId}'`
        }
      } else {
        prBranchCondition = `AND branch_id IN (${effectiveBranchIds.map((id) => `'${id}'`).join(',')})`
      }
    } else {
      if (Array.isArray(branchId) && branchId.length > 0) {
        prBranchCondition = `AND branch_id IN (${branchId.map((id) => `'${id}'`).join(',')})`
      } else if (typeof branchId === 'string' && branchId !== 'all') {
        prBranchCondition = `AND branch_id = '${branchId}'`
      }
    }
    const prCountRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT count(*) FROM purchase_requisitions WHERE status = 'SUBMITTED' ${prBranchCondition}`
    )
    prCount = Number(prCountRows[0]?.count) || 0
  } catch {
    prCount = 0
  }

  let quoteCount = 0
  try {
    if (orgId) {
      const orgSupplierIds = suppliers.map((s) => `'${s.id}'`).join(',')
      if (orgSupplierIds.length > 0) {
        const quoteCountRows = await prisma.$queryRawUnsafe<any[]>(
          `SELECT count(*) FROM supplier_quotations WHERE supplier_id IN (${orgSupplierIds})`
        )
        quoteCount = Number(quoteCountRows[0]?.count) || 0
      } else {
        quoteCount = 0
      }
    } else if (_user?.isSuperAdmin) {
      const quoteCountRows = await prisma.$queryRawUnsafe<any[]>(
        'SELECT count(*) FROM supplier_quotations'
      )
      quoteCount = Number(quoteCountRows[0]?.count) || 0
    } else {
      quoteCount = 0
    }
  } catch {
    quoteCount = 0
  }

  return runPurchaseWorker('ANALYZE_PURCHASE_PIPELINE', {
    purchases,
    suppliers,
    prCount,
    quoteCount,
    returnCount,
    totalSuppliersCount: supplierCount,
    nowTimestamp: Date.now(),
  })
}

export const getPurchasePipelineAnalytics = getPurchasePipelineOverview

// ─── 2. PR (Purchase Requisition) Engine ──────────────────────

export interface PurchaseRequisitionRecord {
  id: string
  prNumber: string
  branchId: string
  productId: string
  productName: string
  sku: string | null
  unitOfMeasure: string
  requiredQuantity: number
  estimatedUnitCost: number
  totalEstimatedCost: number
  requiredByDate: string
  reason: string
  priority: 'NORMAL' | 'URGENT' | 'EMERGENCY'
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CONVERTED' | 'CLOSED'
  requestedById: string
  approvedById?: string | null
  approvedAt?: string | null
  rejectionReason?: string | null
  convertedPoId?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export async function getAutoReorderSuggestions(params: {
  branchId?: string
  targetDays?: number
  organizationId?: string
} = {}) {
  const { branchId, targetDays = 15, organizationId } = params

  const whereInv: Prisma.InventoryWhereInput = {
    product: {
      isActive: true,
      ...(organizationId ? { organizationId } : {}),
    },
    ...(branchId && branchId !== 'all'
      ? { branchId, ...(organizationId ? { branch: { organizationId } } : {}) }
      : organizationId
        ? { branch: { organizationId } }
        : {}),
  }

  // Fetch low-stock products
  const inventories = await prisma.inventory.findMany({
    where: whereInv,
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          barcode: true,
          unitOfMeasure: true,
          costPrice: true,
          mrp: true,
          reorderLevel: true,
          minStockLevel: true,
          batches: {
            where: { status: 'ACTIVE' },
            select: { purchase: { select: { supplierId: true, supplier: { select: { id: true, name: true } } } } },
            take: 1,
          },
        },
      },
    },
  })

  // Open PO quantities to avoid duplicate ordering
  const openPoItems = await prisma.purchaseItem.findMany({
    where: {
      purchase: {
        status: { in: ['DRAFT', 'ORDERED'] },
        ...(branchId && branchId !== 'all'
          ? { branchId, ...(organizationId ? { branch: { organizationId } } : {}) }
          : organizationId
            ? { branch: { organizationId } }
            : {}),
      },
    },
    select: { productId: true, orderedQuantity: true, receivedQuantity: true },
  })

  const openPoMap = new Map<string, number>()
  for (const item of openPoItems) {
    const pending = item.orderedQuantity - item.receivedQuantity
    if (pending > 0) {
      openPoMap.set(item.productId, (openPoMap.get(item.productId) || 0) + pending)
    }
  }

  // Fetch 30-day sales history
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const salesItems = await prisma.saleItem.findMany({
    where: {
      sale: {
        saleDate: { gte: thirtyDaysAgo },
        status: 'COMPLETED',
        ...(branchId && branchId !== 'all'
          ? { branchId, ...(organizationId ? { branch: { organizationId } } : {}) }
          : organizationId
            ? { branch: { organizationId } }
            : {}),
      },
    },
    select: { productId: true, quantity: true },
  }).catch(() => [])

  const candidates = inventories
    .filter((inv) => inv.availableQuantity <= inv.product.reorderLevel)
    .map((inv) => ({
      productId: inv.productId,
      productName: inv.product.name,
      sku: inv.product.sku,
      barcode: inv.product.barcode,
      unitOfMeasure: inv.product.unitOfMeasure,
      availableQuantity: inv.availableQuantity,
      minStockLevel: inv.product.minStockLevel,
      reorderLevel: inv.product.reorderLevel,
      costPrice: Number(inv.product.costPrice) || (Number(inv.product.mrp) * 0.7),
      mrp: Number(inv.product.mrp),
      pendingPoQuantity: openPoMap.get(inv.productId) || 0,
      preferredSupplierId: inv.product.batches?.[0]?.purchase?.supplierId || null,
      preferredSupplierName: inv.product.batches?.[0]?.purchase?.supplier?.name || null,
    }))

  return runPurchaseWorker('ANALYZE_REORDER_SUGGESTIONS', {
    candidates,
    sales30Days: salesItems,
    targetDays,
  })
}

export async function createPurchaseRequisition(
  input: {
    branchId: string
    productId: string
    requiredQuantity: number
    requiredByDate: Date | string
    reason?: string
    priority?: 'NORMAL' | 'URGENT' | 'EMERGENCY'
    notes?: string
  },
  user: AuthUser
): Promise<PurchaseRequisitionRecord> {
  await ensurePurchaseTablesProvisioned()
  await assertBranchAccess(user, input.branchId)

  const product = await prisma.product.findUnique({ where: { id: input.productId } })
  if (!product) throw new Error('Not Found: product')

  const prId = `pr_${Date.now()}_${Math.random().toString(36).substring(7)}`
  const prNumber = `PR-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`
  const unitCost = Number(product.costPrice) || (Number(product.mrp) * 0.7) || 0
  const totalEstimatedCost = input.requiredQuantity * unitCost
  const requiredByDate = new Date(input.requiredByDate).toISOString()

  await prisma.$executeRawUnsafe(`
    INSERT INTO purchase_requisitions (
      id, pr_number, branch_id, product_id, product_name, sku, unit_of_measure,
      required_quantity, estimated_unit_cost, total_estimated_cost, required_by_date,
      reason, priority, status, requested_by_id, notes, created_at, updated_at
    ) VALUES (
      '${prId}', '${prNumber}', '${input.branchId}', '${product.id}', '${product.name.replace(/'/g, "''")}',
      '${product.sku}', '${product.unitOfMeasure}', ${input.requiredQuantity}, ${unitCost}, ${totalEstimatedCost},
      '${requiredByDate}', '${input.reason || 'LOW_STOCK'}', '${input.priority || 'NORMAL'}',
      'SUBMITTED', '${user.id}', ${input.notes ? `'${input.notes.replace(/'/g, "''")}'` : 'NULL'},
      NOW(), NOW()
    );
  `)

  return {
    id: prId,
    prNumber,
    branchId: input.branchId,
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    unitOfMeasure: product.unitOfMeasure,
    requiredQuantity: input.requiredQuantity,
    estimatedUnitCost: unitCost,
    totalEstimatedCost,
    requiredByDate,
    reason: input.reason || 'LOW_STOCK',
    priority: input.priority || 'NORMAL',
    status: 'SUBMITTED',
    requestedById: user.id,
    notes: input.notes ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export async function listPurchaseRequisitions(params: {
  branchId?: string
  status?: string
  priority?: string
  search?: string
  organizationId?: string
  orgBranchIds?: string[]
} = {}): Promise<PurchaseRequisitionRecord[]> {
  await ensurePurchaseTablesProvisioned()

  try {
    let whereClauses: string[] = []
    let allowedBranchIds: string[] | null = null

    if (params.organizationId) {
      const branches = await prisma.branch.findMany({
        where: { organizationId: params.organizationId, isActive: true },
        select: { id: true },
      })
      allowedBranchIds = branches.map((b) => b.id)
    } else if (params.orgBranchIds) {
      allowedBranchIds = params.orgBranchIds
    }

    if (allowedBranchIds !== null) {
      if (allowedBranchIds.length === 0) return []
      if (params.branchId && params.branchId !== 'all') {
        if (!allowedBranchIds.includes(params.branchId)) return []
        whereClauses.push(`branch_id = '${params.branchId}'`)
      } else {
        whereClauses.push(`branch_id IN (${allowedBranchIds.map((b) => `'${b}'`).join(',')})`)
      }
    } else if (params.branchId && params.branchId !== 'all') {
      whereClauses.push(`branch_id = '${params.branchId}'`)
    } else {
      // Mandate tenant filtering — unscoped platform query is disallowed
      return []
    }
    if (params.status && params.status !== 'all') {
      whereClauses.push(`status = '${params.status}'`)
    }
    if (params.priority && params.priority !== 'all') {
      whereClauses.push(`priority = '${params.priority}'`)
    }
    if (params.search) {
      const q = params.search.replace(/'/g, "''")
      whereClauses.push(`(pr_number ILIKE '%${q}%' OR product_name ILIKE '%${q}%' OR sku ILIKE '%${q}%')`)
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM purchase_requisitions
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT 100;
    `)

    return rows.map((r) => ({
      id: r.id,
      prNumber: r.pr_number,
      branchId: r.branch_id,
      productId: r.product_id,
      productName: r.product_name,
      sku: r.sku,
      unitOfMeasure: r.unit_of_measure,
      requiredQuantity: Number(r.required_quantity),
      estimatedUnitCost: Number(r.estimated_unit_cost),
      totalEstimatedCost: Number(r.total_estimated_cost),
      requiredByDate: new Date(r.required_by_date).toISOString(),
      reason: r.reason,
      priority: r.priority,
      status: r.status,
      requestedById: r.requested_by_id,
      approvedById: r.approved_by_id,
      approvedAt: r.approved_at ? new Date(r.approved_at).toISOString() : null,
      rejectionReason: r.rejection_reason,
      convertedPoId: r.converted_po_id,
      notes: r.notes,
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
    }))
  } catch {
    return []
  }
}

export async function approvePurchaseRequisition(
  prId: string,
  user: AuthUser
): Promise<{ success: boolean; message: string }> {
  await ensurePurchaseTablesProvisioned()

  await prisma.$executeRawUnsafe(`
    UPDATE purchase_requisitions
    SET status = 'APPROVED', approved_by_id = '${user.id}', approved_at = NOW(), updated_at = NOW()
    WHERE id = '${prId}' AND status IN ('SUBMITTED', 'DRAFT');
  `)

  return { success: true, message: 'Purchase requisition approved' }
}

export async function consolidateAndConvertPrsToPo(
  data: {
    prIds: string[]
    supplierId: string
    branchId: string
    expectedDate?: Date
    notes?: string
  },
  user: AuthUser
): Promise<{ purchaseId: string; purchaseNumber: string; itemCount: number }> {
  await ensurePurchaseTablesProvisioned()
  await assertBranchAccess(user, data.branchId)

  const prs = await listPurchaseRequisitions({ branchId: data.branchId })
  const selectedPrs = prs.filter((p) => data.prIds.includes(p.id))

  if (selectedPrs.length === 0) {
    throw new Error('No valid purchase requisitions found to convert')
  }

  // Create formal PO via transaction
  const po = await prisma.$transaction(async (tx) => {
    const purchaseNumber = `PO-${Date.now()}`
    const purchase = await tx.purchase.create({
      data: {
        purchaseNumber,
        branchId: data.branchId,
        supplierId: data.supplierId,
        expectedDate: data.expectedDate,
        notes: `Converted from PRs: ${selectedPrs.map((p) => p.prNumber).join(', ')}${data.notes ? ' — ' + data.notes : ''}`,
        status: 'ORDERED',
        createdById: user.id,
        items: {
          create: selectedPrs.map((item) => ({
            productId: item.productId,
            orderedQuantity: item.requiredQuantity,
            receivedQuantity: 0,
            freeQuantity: 0,
            unitCost: item.estimatedUnitCost,
            discountPercent: 0,
            taxPercent: 12,
            taxAmount: (item.estimatedUnitCost * item.requiredQuantity * 0.12),
            totalAmount: (item.estimatedUnitCost * item.requiredQuantity * 1.12),
            mrp: item.estimatedUnitCost * 1.3,
          })),
        },
      },
    })

    // Calculate PO totals
    const subtotal = selectedPrs.reduce((sum, i) => sum + i.requiredQuantity * i.estimatedUnitCost, 0)
    const taxAmount = subtotal * 0.12
    const totalAmount = subtotal + taxAmount

    await tx.purchase.update({
      where: { id: purchase.id },
      data: { subtotal, taxAmount, totalAmount, balanceDue: totalAmount },
    })

    return purchase
  })

  // Mark PRs as CONVERTED in PostgreSQL
  const idList = data.prIds.map((id) => `'${id}'`).join(',')
  await prisma.$executeRawUnsafe(`
    UPDATE purchase_requisitions
    SET status = 'CONVERTED', converted_po_id = '${po.id}', updated_at = NOW()
    WHERE id IN (${idList});
  `)

  return {
    purchaseId: po.id,
    purchaseNumber: po.purchaseNumber,
    itemCount: selectedPrs.length,
  }
}

// ─── 3. RFQ & Supplier Quotation Matrix ────────────────────────

export interface SupplierQuotationRecord {
  id: string
  rfqNumber: string
  supplierId: string
  supplierName: string
  productId: string
  productName: string
  paidQuantity: number
  freeQuantity: number
  basicRate: number
  discountPercent: number
  taxPercent: number
  freightCharges: number
  totalNetPayable: number
  effectiveLandedCost: number
  remainingShelfLifeMonths: number
  leadTimeDays: number
  creditDays: number
  paymentTerms: string
  returnPolicy: string
  commercialRiskScore: number
  riskRating: 'LOW' | 'MODERATE' | 'HIGH'
  isRecommended: boolean
  status: string
  createdAt: string
}

export async function recordSupplierQuotation(
  data: {
    rfqNumber?: string
    supplierId: string
    productId: string
    paidQuantity: number
    freeQuantity?: number
    basicRate: number
    discountPercent?: number
    taxPercent?: number
    freightCharges?: number
    remainingShelfLifeMonths?: number
    leadTimeDays?: number
    creditDays?: number
    paymentTerms?: string
    returnPolicy?: string
  },
  _user: AuthUser
): Promise<SupplierQuotationRecord> {
  await ensurePurchaseTablesProvisioned()

  const [supplier, product] = await Promise.all([
    prisma.supplier.findUnique({ where: { id: data.supplierId } }),
    prisma.product.findUnique({ where: { id: data.productId } }),
  ])
  if (!supplier) throw new Error('Not Found: supplier')
  if (!product) throw new Error('Not Found: product')
  if (!_user.isSuperAdmin && _user.organizationId) {
    if (supplier.organizationId && supplier.organizationId !== _user.organizationId) {
      throw new Error('Forbidden: supplier belongs to another organization')
    }
    if (product.organizationId && product.organizationId !== _user.organizationId) {
      throw new Error('Forbidden: product belongs to another organization')
    }
  }

  const qId = `quote_${Date.now()}_${Math.random().toString(36).substring(7)}`
  const rfqNumber = data.rfqNumber || `RFQ-${Date.now().toString().slice(-6)}`

  // Compute landed cost & risk in worker
  const evaluated = await runPurchaseWorker<{ quotations: any[] }, { quotations: any[] }>('COMPARE_QUOTATIONS', {
    quotations: [
      {
        ...data,
        supplierName: supplier.name,
        productName: product.name,
        paidQuantity: data.paidQuantity,
        freeQuantity: data.freeQuantity || 0,
        basicRate: data.basicRate,
        discountPercent: data.discountPercent || 0,
        taxPercent: data.taxPercent || 12,
        freightCharges: data.freightCharges || 0,
        remainingShelfLifeMonths: data.remainingShelfLifeMonths || 24,
        leadTimeDays: data.leadTimeDays || 2,
        creditDays: data.creditDays || supplier.creditDays || 30,
      },
    ],
  })

  const item = evaluated.quotations[0]

  await prisma.$executeRawUnsafe(`
    INSERT INTO supplier_quotations (
      id, rfq_number, supplier_id, supplier_name, product_id, product_name,
      paid_quantity, free_quantity, basic_rate, discount_percent, tax_percent,
      freight_charges, total_net_payable, effective_landed_cost, remaining_shelf_life_months,
      lead_time_days, credit_days, payment_terms, return_policy, commercial_risk_score,
      risk_rating, is_recommended, status, created_at
    ) VALUES (
      '${qId}', '${rfqNumber}', '${supplier.id}', '${supplier.name.replace(/'/g, "''")}',
      '${product.id}', '${product.name.replace(/'/g, "''")}', ${data.paidQuantity},
      ${data.freeQuantity || 0}, ${data.basicRate}, ${data.discountPercent || 0},
      ${data.taxPercent || 12}, ${data.freightCharges || 0}, ${item.totalNetPayable},
      ${item.effectiveLandedCost}, ${data.remainingShelfLifeMonths || 24}, ${data.leadTimeDays || 2},
      ${data.creditDays || supplier.creditDays || 30}, '${data.paymentTerms || '30 Days Net'}',
      '${data.returnPolicy || 'Full credit for expiry/damage'}', ${item.riskScore},
      '${item.riskRating}', false, 'RECEIVED', NOW()
    );
  `)

  return {
    id: qId,
    rfqNumber,
    supplierId: supplier.id,
    supplierName: supplier.name,
    productId: product.id,
    productName: product.name,
    paidQuantity: data.paidQuantity,
    freeQuantity: data.freeQuantity || 0,
    basicRate: data.basicRate,
    discountPercent: data.discountPercent || 0,
    taxPercent: data.taxPercent || 12,
    freightCharges: data.freightCharges || 0,
    totalNetPayable: item.totalNetPayable,
    effectiveLandedCost: item.effectiveLandedCost,
    remainingShelfLifeMonths: data.remainingShelfLifeMonths || 24,
    leadTimeDays: data.leadTimeDays || 2,
    creditDays: data.creditDays || supplier.creditDays || 30,
    paymentTerms: data.paymentTerms || '30 Days Net',
    returnPolicy: data.returnPolicy || 'Full credit for expiry/damage',
    commercialRiskScore: item.riskScore,
    riskRating: item.riskRating,
    isRecommended: false,
    status: 'RECEIVED',
    createdAt: new Date().toISOString(),
  }
}

export async function listSupplierQuotations(
  rfqNumber?: string,
  organizationId?: string
): Promise<SupplierQuotationRecord[]> {
  await ensurePurchaseTablesProvisioned()

  try {
    const whereClauses: string[] = []
    if (rfqNumber) {
      const cleanRfq = rfqNumber.replace(/'/g, "''")
      whereClauses.push(`rfq_number = '${cleanRfq}'`)
    }

    if (organizationId) {
      const suppliers = await prisma.supplier.findMany({
        where: { organizationId, isActive: true },
        select: { id: true },
      })
      if (suppliers.length === 0) return []
      const supIds = suppliers.map((s) => `'${s.id}'`).join(',')
      whereClauses.push(`supplier_id IN (${supIds})`)
    } else if (!rfqNumber) {
      return []
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM supplier_quotations
      ${whereSql}
      ORDER BY effective_landed_cost ASC
      LIMIT 100;
    `)

    return rows.map((r) => ({
      id: r.id,
      rfqNumber: r.rfq_number,
      supplierId: r.supplier_id,
      supplierName: r.supplier_name,
      productId: r.product_id,
      productName: r.product_name,
      paidQuantity: Number(r.paid_quantity),
      freeQuantity: Number(r.free_quantity || 0),
      basicRate: Number(r.basic_rate),
      discountPercent: Number(r.discount_percent || 0),
      taxPercent: Number(r.tax_percent || 0),
      freightCharges: Number(r.freight_charges || 0),
      totalNetPayable: Number(r.total_net_payable),
      effectiveLandedCost: Number(r.effective_landed_cost),
      remainingShelfLifeMonths: Number(r.remaining_shelf_life_months || 24),
      leadTimeDays: Number(r.lead_time_days || 2),
      creditDays: Number(r.credit_days || 30),
      paymentTerms: r.payment_terms || '30 Days Net',
      returnPolicy: r.return_policy || 'Standard',
      commercialRiskScore: Number(r.commercial_risk_score || 90),
      riskRating: r.risk_rating || 'LOW',
      isRecommended: Boolean(r.is_recommended),
      status: r.status || 'RECEIVED',
      createdAt: new Date(r.created_at).toISOString(),
    }))
  } catch {
    return []
  }
}

// ─── 4. Advanced GRN with Quality Inspection & Cold Chain ─────

export interface AdvancedGrnCommand {
  purchaseId: string
  branchId: string
  grnNumber: string
  deliveryNoteNumber?: string
  deliveryNoteDate?: Date | string
  grnDate?: Date | string
  coldChainChecked?: boolean
  receivedTemperature?: number
  temperatureExcursion?: boolean
  notes?: string
  items: {
    purchaseItemId: string
    batchNumber: string
    manufacturingDate?: Date | string
    expiryDate: Date | string
    deliveredQuantity: number
    acceptedQuantity: number
    rejectedQuantity: number
    freeQuantity?: number
    purchasePrice: number
    mrp: number
    qualityCheckPassed: boolean
    rejectionReason?: string
    storageRack?: string
    storageBox?: string
  }[]
}

export async function processAdvancedGoodsReceipt(
  command: AdvancedGrnCommand,
  actor: AuthUser
) {
  await assertBranchAccess(actor, command.branchId)

  const purchase = await prisma.purchase.findUnique({
    where: { id: command.purchaseId },
    include: { items: true, supplier: true },
  })
  if (!purchase) throw new Error('Not Found: purchase order')
  if (purchase.branchId !== command.branchId) {
    throw new Error('Forbidden: PO branch mismatch')
  }
  await assertBranchAccess(actor, purchase.branchId)

  if (!['ORDERED', 'SENT', 'PARTIALLY_RECEIVED'].includes(purchase.status)) {
    throw new Error(`Cannot receive goods for purchase in status: ${purchase.status}`)
  }

  const itemMap = new Map(purchase.items.map((i) => [i.id, i]))

  return prisma.$transaction(async (tx) => {
    let totalAccepted = 0
    let totalRejected = 0

    for (const item of command.items) {
      const poItem = itemMap.get(item.purchaseItemId)
      if (!poItem) throw new Error(`PO item not found: ${item.purchaseItemId}`)

      const accepted = Number(item.acceptedQuantity) || 0
      const rejected = Number(item.rejectedQuantity) || 0
      const free = Number(item.freeQuantity) || 0
      totalAccepted += accepted
      totalRejected += rejected

      // 1. Usable Batch (for Accepted Quantity + Free Scheme Units)
      const usableQty = accepted + free
      let batchId: string | null = null

      if (usableQty > 0) {
        const batch = await tx.batch.create({
          data: {
            productId: poItem.productId,
            batchNumber: item.batchNumber,
            manufacturingDate: item.manufacturingDate ? new Date(item.manufacturingDate) : null,
            expiryDate: new Date(item.expiryDate),
            purchasePrice: item.purchasePrice,
            mrp: item.mrp,
            quantity: usableQty,
            reservedQuantity: 0,
            soldQuantity: 0,
            status: command.temperatureExcursion ? 'BLOCKED' : 'ACTIVE',
            blockedReason: command.temperatureExcursion ? 'Cold-chain temperature excursion' : null,
            supplierRef: command.deliveryNoteNumber || item.batchNumber,
            purchaseId: command.purchaseId,
            branchId: command.branchId,
          },
        })
        batchId = batch.id

        // Update branch inventory
        const invWhere = {
          productId_branchId: { productId: poItem.productId, branchId: command.branchId },
        }
        let inv = await tx.inventory.findUnique({ where: invWhere })
        const beforeTotal = inv?.totalQuantity ?? 0
        const beforeAvail = inv?.availableQuantity ?? 0
        const afterTotal = beforeTotal + usableQty
        const afterAvail = beforeAvail + (command.temperatureExcursion ? 0 : usableQty)

        if (inv) {
          await tx.inventory.update({
            where: { id: inv.id },
            data: { totalQuantity: afterTotal, availableQuantity: afterAvail },
          })
        } else {
          inv = await tx.inventory.create({
            data: {
              productId: poItem.productId,
              branchId: command.branchId,
              totalQuantity: afterTotal,
              availableQuantity: afterAvail,
              reservedQuantity: 0,
            },
          })
        }

        // Inventory movement audit record
        await tx.inventoryMovement.create({
          data: {
            inventoryId: inv.id,
            type: 'IN',
            quantity: usableQty,
            quantityBefore: beforeTotal,
            quantityAfter: afterTotal,
            referenceType: 'GRN',
            referenceId: command.grnNumber,
            batchId: batch.id,
            notes: `Accepted via GRN ${command.grnNumber}${free > 0 ? ` (${free} free scheme units)` : ''}`,
            createdById: actor.id,
          },
        })
      }

      // 2. Quarantined Batch for Rejected Quantity
      if (rejected > 0) {
        const rejectBatchNum = `${item.batchNumber}-REJ`
        await tx.batch.create({
          data: {
            productId: poItem.productId,
            batchNumber: rejectBatchNum,
            manufacturingDate: item.manufacturingDate ? new Date(item.manufacturingDate) : null,
            expiryDate: new Date(item.expiryDate),
            purchasePrice: item.purchasePrice,
            mrp: item.mrp,
            quantity: rejected,
            status: 'BLOCKED',
            blockedReason: item.rejectionReason || 'Inspection rejection at GRN receiving dock',
            purchaseId: command.purchaseId,
            branchId: command.branchId,
          },
        })
      }

      // 3. Update PO Item received quantity & storage location
      await tx.purchaseItem.update({
        where: { id: item.purchaseItemId },
        data: {
          receivedQuantity: { increment: accepted },
          freeQuantity: { increment: free },
        },
      })

      if (item.storageRack) {
        const rackCode = item.storageRack.trim().toUpperCase()
        const existingRack = await tx.rack.findFirst({
          where: { branchId: command.branchId, code: rackCode },
        })
        const rackId = existingRack?.id || (await tx.rack.create({
          data: {
            branchId: command.branchId,
            code: rackCode,
            shelfNumber: '1',
            description: `Rack ${rackCode}`,
          },
        })).id

        await tx.product.update({
          where: { id: poItem.productId },
          data: { rackId },
        })
      }
    }

    // Determine final PO status
    const allItems = await tx.purchaseItem.findMany({ where: { purchaseId: command.purchaseId } })
    const allReceived = allItems.every((i) => i.receivedQuantity >= i.orderedQuantity)

    const updatedPo = await tx.purchase.update({
      where: { id: command.purchaseId },
      data: {
        status: allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED',
        receivedAt: new Date(command.grnDate || Date.now()),
      },
      include: { items: true, supplier: true },
    })

    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: 'GRN_COMPLETE',
        entity: 'Purchase',
        entityId: command.purchaseId,
        metadata: {
          grnNumber: command.grnNumber,
          totalAccepted,
          totalRejected,
          deliveryNote: command.deliveryNoteNumber,
        },
      },
    })

    return {
      success: true,
      grnNumber: command.grnNumber,
      totalAccepted,
      totalRejected,
      purchase: updatedPo,
    }
  })
}

// ─── 5. Three-Way Matching & Invoice Posting Engine ───────────

export interface ThreeWayMatchInvoiceInput {
  purchaseId: string
  supplierInvoiceNumber: string
  supplierInvoiceDate: Date | string
  billedSubtotal: number
  billedTaxAmount: number
  freightAmount?: number
  roundOff?: number
  billedTotalAmount: number
  tolerancePercent?: number
  items: {
    purchaseItemId: string
    billedQuantity: number
    billedRate: number
    billedAmount: number
  }[]
}

export async function processThreeWayMatchAndInvoice(
  input: ThreeWayMatchInvoiceInput,
  actor: AuthUser
) {
  const purchase = await prisma.purchase.findUnique({
    where: { id: input.purchaseId },
    include: { items: true, supplier: true },
  })
  if (!purchase) throw new Error('Not Found: purchase order')
  await assertBranchAccess(actor, purchase.branchId)

  // Duplicate Invoice Check for Supplier
  const existingInvoice = await prisma.purchase.findFirst({
    where: {
      supplierId: purchase.supplierId,
      invoiceNumber: input.supplierInvoiceNumber,
      id: { not: purchase.id },
    },
    select: { id: true, purchaseNumber: true },
  })
  if (existingInvoice) {
    throw new Error(`Duplicate Invoice: Invoice #${input.supplierInvoiceNumber} already recorded under ${existingInvoice.purchaseNumber}`)
  }

  const itemMap = new Map(purchase.items.map((i) => [i.id, i]))
  const discrepancies: Array<{
    purchaseItemId: string
    productName?: string
    field: string
    expected: number
    billed: number
    variance: number
  }> = []

  const tolerance = (input.tolerancePercent ?? 1) / 100

  for (const invItem of input.items) {
    const poItem = itemMap.get(invItem.purchaseItemId)
    if (!poItem) continue

    // 1. Quantity Match: Billed vs Accepted
    const acceptedQty = poItem.receivedQuantity
    if (Math.abs(invItem.billedQuantity - acceptedQty) > 0) {
      discrepancies.push({
        purchaseItemId: poItem.id,
        field: 'QUANTITY',
        expected: acceptedQty,
        billed: invItem.billedQuantity,
        variance: invItem.billedQuantity - acceptedQty,
      })
    }

    // 2. Rate Match: Billed Rate vs PO Rate
    const poRate = Number(poItem.unitCost)
    const rateDiff = Math.abs(invItem.billedRate - poRate)
    if (poRate > 0 && rateDiff / poRate > tolerance) {
      discrepancies.push({
        purchaseItemId: poItem.id,
        field: 'UNIT_RATE',
        expected: poRate,
        billed: invItem.billedRate,
        variance: Math.round((invItem.billedRate - poRate) * 100) / 100,
      })
    }
  }

  const hasDiscrepancy = discrepancies.length > 0
  const matchStatus = hasDiscrepancy ? 'DISCREPANCY' : 'MATCHED'

  // Post to Accounts Payable in Database
  const updated = await prisma.$transaction(async (tx) => {
    const updatedPurchase = await tx.purchase.update({
      where: { id: input.purchaseId },
      data: {
        invoiceNumber: input.supplierInvoiceNumber,
        invoiceDate: new Date(input.supplierInvoiceDate),
        status: 'INVOICED',
        totalAmount: input.billedTotalAmount,
        subtotal: input.billedSubtotal,
        taxAmount: input.billedTaxAmount,
        balanceDue: input.billedTotalAmount,
      },
    })

    // Post to Supplier Ledger (CREDIT = Accounts Payable Liability Recorded)
    const lastEntry = await tx.supplierLedger.findFirst({
      where: { supplierId: purchase.supplierId },
      orderBy: { entryDate: 'desc' },
    })
    const curBalance = lastEntry?.balance ?? new Prisma.Decimal(0)
    const newBalance = curBalance.plus(input.billedTotalAmount)

    await tx.supplierLedger.create({
      data: {
        supplierId: purchase.supplierId,
        type: 'CREDIT',
        amount: input.billedTotalAmount,
        balance: newBalance,
        description: `Purchase Invoice #${input.supplierInvoiceNumber} for ${purchase.purchaseNumber}`,
        entryDate: new Date(input.supplierInvoiceDate),
        referenceType: 'PURCHASE_INVOICE',
        referenceId: purchase.id,
      },
    })

    // Update supplier outstanding balance
    await tx.supplier.update({
      where: { id: purchase.supplierId },
      data: { outstandingBalance: { increment: input.billedTotalAmount } },
    })

    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: 'INVOICE_POSTED',
        entity: 'Purchase',
        entityId: purchase.id,
        metadata: {
          invoiceNumber: input.supplierInvoiceNumber,
          totalAmount: input.billedTotalAmount,
          matchStatus,
          discrepancyCount: discrepancies.length,
        },
      },
    })

    return updatedPurchase
  })

  return {
    success: true,
    matchStatus,
    discrepancies,
    purchase: updated,
  }
}
