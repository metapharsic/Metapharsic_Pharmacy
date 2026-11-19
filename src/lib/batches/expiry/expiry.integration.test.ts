/**
 * @jest-environment node
 */
import prisma from '@/lib/db/prisma'

import { runMultiThreadedExpirySweep } from './expiry-orchestrator'

const HAS_DB = Boolean(process.env.DATABASE_URL)
const maybeDescribe = HAS_DB ? describe : describe.skip

maybeDescribe('Batch Expiry Multi-Threaded Engine (Integration)', () => {
  let orgId: string
  let branchId: string
  let userId: string
  let productId: string
  let batchPastActiveId: string
  let batchPastBlockedId: string
  let batchFutureActiveId: string

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: {
        name: `Expiry Test Org ${Date.now()}`,
      },
    })
    orgId = org.id

    const branch = await prisma.branch.create({
      data: {
        name: 'Expiry Main Branch',
        code: `BR${Date.now().toString().slice(-4)}`,
        invoicePrefix: 'EXP',
        organizationId: orgId,
      },
    })
    branchId = branch.id

    const user = await prisma.user.create({
      data: {
        name: 'Expiry Tester',
        email: `tester-${Date.now()}@pharma.test`,
        branchId,
      },
    })
    userId = user.id

    const product = await prisma.product.create({
      data: {
        name: 'Paracetamol Expiry Test',
        sku: `SKU-EXP-${Date.now()}`,
        mrp: 20.0,
        unitOfMeasure: 'Strip',
        createdById: userId,
      },
    })
    productId = product.id
  })

  afterAll(async () => {
    await prisma.batchStatusLog.deleteMany({
      where: { batchId: { in: [batchPastActiveId, batchPastBlockedId, batchFutureActiveId].filter(Boolean) } },
    }).catch(() => {})

    await prisma.batch.deleteMany({
      where: { productId },
    }).catch(() => {})

    await prisma.product.delete({ where: { id: productId } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.branch.delete({ where: { id: branchId } }).catch(() => {})
    await prisma.organization.delete({ where: { id: orgId } }).catch(() => {})
  })

  beforeEach(async () => {
    await prisma.batchStatusLog.deleteMany({
      where: { batch: { productId } },
    }).catch(() => {})
    await prisma.batch.deleteMany({
      where: { productId },
    }).catch(() => {})

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000)
    const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    // 1. Due expired active batch
    const b1 = await prisma.batch.create({
      data: {
        productId,
        batchNumber: `EXP-A-${Date.now()}`,
        expiryDate: yesterday,
        purchasePrice: 10.0,
        mrp: 15.0,
        quantity: 100,
        status: 'ACTIVE',
        branchId,
      },
    })
    batchPastActiveId = b1.id

    // 2. Due expired blocked/quarantined batch
    const b2 = await prisma.batch.create({
      data: {
        productId,
        batchNumber: `EXP-B-${Date.now()}`,
        expiryDate: twoDaysAgo,
        purchasePrice: 20.0,
        mrp: 25.0,
        quantity: 50,
        status: 'BLOCKED',
        branchId,
      },
    })
    batchPastBlockedId = b2.id

    // 3. Valid future batch
    const b3 = await prisma.batch.create({
      data: {
        productId,
        batchNumber: `EXP-C-${Date.now()}`,
        expiryDate: nextMonth,
        purchasePrice: 15.0,
        mrp: 20.0,
        quantity: 80,
        status: 'ACTIVE',
        branchId,
      },
    })
    batchFutureActiveId = b3.id
  })

  it('correctly expires past ACTIVE and BLOCKED batches while leaving future batches ACTIVE', async () => {
    const sweepResult = await runMultiThreadedExpirySweep({
      branchId,
      chunkSize: 10,
      mode: 'sync',
    })

    expect(sweepResult.success).toBe(true)
    expect(sweepResult.totalDue).toBe(2)
    expect(sweepResult.expiredCount).toBe(2)
    expect(sweepResult.errorCount).toBe(0)

    // Verify DB states
    const updatedB1 = await prisma.batch.findUnique({ where: { id: batchPastActiveId } })
    const updatedB2 = await prisma.batch.findUnique({ where: { id: batchPastBlockedId } })
    const untouchedB3 = await prisma.batch.findUnique({ where: { id: batchFutureActiveId } })

    expect(updatedB1?.status).toBe('EXPIRED')
    expect(updatedB2?.status).toBe('EXPIRED')
    expect(untouchedB3?.status).toBe('ACTIVE')

    // Verify Audit Logs
    const logs = await prisma.batchStatusLog.findMany({
      where: { batchId: { in: [batchPastActiveId, batchPastBlockedId] } },
    })

    expect(logs).toHaveLength(2)
    const log1 = logs.find((l) => l.batchId === batchPastActiveId)
    const log2 = logs.find((l) => l.batchId === batchPastBlockedId)

    expect(log1).toBeDefined()
    expect(log1?.fromStatus).toBe('ACTIVE')
    expect(log1?.toStatus).toBe('EXPIRED')
    expect(log1?.reason).toBe('Batch expired')

    expect(log2).toBeDefined()
    expect(log2?.fromStatus).toBe('BLOCKED')
    expect(log2?.toStatus).toBe('EXPIRED')
    expect(log2?.reason).toBe('Batch expired')
  })

  it('is idempotent on subsequent executions', async () => {
    await runMultiThreadedExpirySweep({ branchId, mode: 'sync' })

    const secondRun = await runMultiThreadedExpirySweep({ branchId, mode: 'sync' })
    expect(secondRun.totalDue).toBe(0)
    expect(secondRun.expiredCount).toBe(0)
  })

  it('does not mutate database in dryRun mode', async () => {
    const dryRunResult = await runMultiThreadedExpirySweep({
      branchId,
      dryRun: true,
      mode: 'sync',
    })

    expect(dryRunResult.totalDue).toBe(2)
    expect(dryRunResult.expiredCount).toBe(2)

    const b1 = await prisma.batch.findUnique({ where: { id: batchPastActiveId } })
    const b2 = await prisma.batch.findUnique({ where: { id: batchPastBlockedId } })

    expect(b1?.status).toBe('ACTIVE')
    expect(b2?.status).toBe('BLOCKED')
  })
})
