import prisma from '@/lib/db/prisma'

import { runMultiThreadedExpirySweep } from './expiry-orchestrator'

jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  default: {
    batch: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    batchStatusLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

jest.mock('node:worker_threads', () => {
  const actual = jest.requireActual('node:worker_threads')
  return {
    ...actual,
    Worker: jest.fn().mockImplementation(() => {
      throw new Error('Worker thread allocation unsupported in unit mock')
    }),
  }
})

const prismaMock = prisma as unknown as {
  batch: {
    findMany: jest.Mock
    updateMany: jest.Mock
  }
  batchStatusLog: {
    create: jest.Mock
  }
  $transaction: jest.Mock
}

describe('Expiry Orchestrator (Unit)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns immediately with 0 counts when no batches are due', async () => {
    prismaMock.batch.findMany.mockResolvedValue([])

    const result = await runMultiThreadedExpirySweep()

    expect(result.success).toBe(true)
    expect(result.totalDue).toBe(0)
    expect(result.expiredCount).toBe(0)
    expect(result.chunksCount).toBe(0)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('runs synchronously when mode is "sync"', async () => {
    const dueBatches = [
      {
        id: 'b-1',
        batchNumber: 'BN1',
        status: 'ACTIVE',
        expiryDate: new Date('2024-01-01'),
        productId: 'prod-1',
        branchId: 'branch-1',
      },
      {
        id: 'b-2',
        batchNumber: 'BN2',
        status: 'BLOCKED',
        expiryDate: new Date('2024-01-02'),
        productId: 'prod-2',
        branchId: 'branch-1',
      },
    ]

    prismaMock.batch.findMany.mockResolvedValue(dueBatches)
    prismaMock.$transaction.mockImplementation(async (cb) => {
      const tx = {
        batch: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        batchStatusLog: { create: jest.fn().mockResolvedValue({ id: 'log-1' }) },
      }
      return cb(tx)
    })

    const result = await runMultiThreadedExpirySweep({
      mode: 'sync',
      branchId: 'branch-1',
      chunkSize: 1,
    })

    expect(result.success).toBe(true)
    expect(result.totalDue).toBe(2)
    expect(result.expiredCount).toBe(2)
    expect(result.modeUsed).toBe('sync')
    expect(result.chunksCount).toBe(2)
  })

  it('supports dryRun mode in orchestrator', async () => {
    const dueBatches = [
      {
        id: 'b-1',
        batchNumber: 'BN1',
        status: 'ACTIVE',
        expiryDate: new Date('2024-01-01'),
        productId: 'prod-1',
        branchId: null,
      },
    ]

    prismaMock.batch.findMany.mockResolvedValue(dueBatches)

    const result = await runMultiThreadedExpirySweep({
      mode: 'sync',
      dryRun: true,
    })

    expect(result.success).toBe(true)
    expect(result.totalDue).toBe(1)
    expect(result.expiredCount).toBe(1)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('falls back to sync processing gracefully when worker threads throw or are unavailable', async () => {
    const dueBatches = [
      {
        id: 'b-1',
        batchNumber: 'BN1',
        status: 'ACTIVE',
        expiryDate: new Date('2024-01-01'),
        productId: 'prod-1',
        branchId: null,
      },
    ]

    prismaMock.batch.findMany.mockResolvedValue(dueBatches)
    prismaMock.$transaction.mockImplementation(async (cb) => {
      const tx = {
        batch: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        batchStatusLog: { create: jest.fn().mockResolvedValue({ id: 'log-1' }) },
      }
      return cb(tx)
    })

    const result = await runMultiThreadedExpirySweep({
      mode: 'worker',
      concurrency: 2,
    })

    expect(result.success).toBe(true)
    expect(result.totalDue).toBe(1)
    expect(result.expiredCount).toBe(1)
    expect(result.modeUsed).toBe('sync')
  })
})
