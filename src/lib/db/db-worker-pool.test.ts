import { DbWorkerPool, getDbWorkerPool } from './db-worker-pool'
import { fetchSidebarAggregates } from './parallel-sidebar-prefetcher'
import prisma from '@/lib/db/prisma'

jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  default: {
    product: {
      count: jest.fn().mockResolvedValue(150),
    },
    inventory: {
      count: jest.fn().mockImplementation((args?: { where?: { availableQuantity?: unknown } }) => {
        if (args?.where?.availableQuantity === 0) return Promise.resolve(5)
        return Promise.resolve(12)
      }),
    },
    batch: {
      count: jest.fn().mockResolvedValue(45),
    },
    sale: {
      count: jest.fn().mockResolvedValue(28),
      aggregate: jest.fn().mockResolvedValue({ _sum: { totalAmount: 54320.5 } }),
    },
    prescription: {
      count: jest.fn().mockResolvedValue(7),
    },
    purchase: {
      count: jest.fn().mockResolvedValue(3),
    },
    voucher: {
      count: jest.fn().mockResolvedValue(14),
    },
    ledger: {
      count: jest.fn().mockResolvedValue(22),
    },
    doctor: {
      count: jest.fn().mockResolvedValue(8),
    },
    doctorCommission: {
      count: jest.fn().mockResolvedValue(4),
    },
    customer: {
      count: jest.fn().mockResolvedValue(190),
    },
  },
}))

describe('DbWorkerPool & Parallel Prefetcher', () => {
  let pool: DbWorkerPool

  beforeEach(() => {
    pool = new DbWorkerPool(2)
  })

  afterEach(async () => {
    await pool.terminate()
    const globalPool = getDbWorkerPool()
    await globalPool.terminate()
  })

  it('correctly executes in-process fallback across all query domains', async () => {
    const invRes = await pool.executeInProcessFallback({
      taskId: 'test_inv',
      domain: 'INVENTORY',
    })
    expect(invRes.success).toBe(true)
    expect(invRes.data).toEqual({
      totalProducts: 150,
      lowStockCount: 12,
      outOfStockCount: 5,
      activeBatches: 45,
    })

    const comRes = await pool.executeInProcessFallback({
      taskId: 'test_com',
      domain: 'COMMERCE',
    })
    expect(comRes.success).toBe(true)
    expect(comRes.data).toEqual({
      todaySalesCount: 28,
      pendingPrescriptions: 7,
      todayRevenue: 54320.5,
    })

    const finRes = await pool.executeInProcessFallback({
      taskId: 'test_fin',
      domain: 'FINANCE',
    })
    expect(finRes.success).toBe(true)
    expect(finRes.data).toEqual({
      receiptVouchersCount: 14,
      activeLedgersCount: 22,
      pendingPayablesCount: 3,
    })

    const cliRes = await pool.executeInProcessFallback({
      taskId: 'test_cli',
      domain: 'CLINICAL',
    })
    expect(cliRes.success).toBe(true)
    expect(cliRes.data).toEqual({
      totalDoctors: 8,
      pendingCommissions: 4,
      activeCustomers: 190,
    })

    const expRes = await pool.executeInProcessFallback({
      taskId: 'test_exp',
      domain: 'EXPIRY',
    })
    expect(expRes.success).toBe(true)
    expect(expRes.data).toEqual({
      expiredCount: 45,
      expiring30Count: 45,
      expiring90Count: 45,
    })
  })

  it('runs executeInProcessFallback on domains and safely aggregates results', async () => {
    const domains = ['INVENTORY', 'COMMERCE', 'FINANCE', 'CLINICAL', 'EXPIRY'] as const
    const results = await Promise.all(
      domains.map((d) => pool.executeInProcessFallback({ taskId: `test_${d}`, domain: d }))
    )
    expect(results).toHaveLength(5)
    expect(results.every((r) => r.success)).toBe(true)
  })

  it('safely handles domain errors in executeInProcessFallback without throwing', async () => {
    const spy = jest.spyOn(prisma.product, 'count').mockRejectedValueOnce(new Error('Simulated DB timeout'))

    const res = await pool.executeInProcessFallback({
      taskId: 'test_err',
      domain: 'INVENTORY',
    })

    expect(res.success).toBe(false)
    expect(res.error).toContain('Simulated DB timeout')
    spy.mockRestore()
  })

  it('getDbWorkerPool returns singleton instance and terminates gracefully', async () => {
    const p1 = getDbWorkerPool()
    const p2 = getDbWorkerPool()
    expect(p1).toBe(p2)
    await p1.terminate()
  })
})
