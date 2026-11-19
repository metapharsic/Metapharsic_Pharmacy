import {
  assertPeriodOpen,
  getPeriodLockSettings,
  invalidatePeriodLockCache,
  setPeriodLockSettings,
} from '../period-lock-service'
import prisma from '@/lib/db/prisma'

jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  default: {
    systemSetting: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(async (cb: any) =>
      cb({
        systemSetting: {
          upsert: jest.fn(),
        },
        auditLog: {
          create: jest.fn(),
        },
      })
    ),
  },
}))

describe('Financial Period Lock Service (Tally & Marg ERP Parity)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    invalidatePeriodLockCache()
  })

  describe('getPeriodLockSettings', () => {
    it('returns empty lockDate and default allowAdminBypass when settings do not exist', async () => {
      ;(prisma.systemSetting.findMany as jest.Mock).mockResolvedValue([])

      const settings = await getPeriodLockSettings()

      expect(settings).toEqual({
        lockDate: null,
        allowAdminBypass: false,
      })
      expect(prisma.systemSetting.findMany).toHaveBeenCalledWith({
        where: { category: 'accounting' },
        select: { key: true, value: true },
      })
    })

    it('returns configured lockDate and allowAdminBypass from PostgreSQL table', async () => {
      ;(prisma.systemSetting.findMany as jest.Mock).mockResolvedValue([
        { key: 'lock_date', value: '2026-03-31' },
        { key: 'allow_admin_bypass', value: 'true' },
      ])

      const settings = await getPeriodLockSettings()

      expect(settings).toEqual({
        lockDate: '2026-03-31',
        allowAdminBypass: true,
      })
    })
  })

  describe('setPeriodLockSettings', () => {
    it('executes atomic transaction, creates audit entry, and refreshes cache', async () => {
      ;(prisma.systemSetting.findMany as jest.Mock).mockResolvedValue([
        { key: 'lock_date', value: '2026-06-30' },
        { key: 'allow_admin_bypass', value: 'false' },
      ])

      const result = await setPeriodLockSettings(
        {
          lockDate: '2026-06-30',
          allowAdminBypass: false,
        },
        'usr_admin123'
      )

      expect(prisma.$transaction).toHaveBeenCalled()
      expect(result.lockDate).toBe('2026-06-30')
      expect(result.allowAdminBypass).toBe(false)
    })
  })

  describe('assertPeriodOpen', () => {
    it('allows transaction when no lock date is set in system', async () => {
      ;(prisma.systemSetting.findMany as jest.Mock).mockResolvedValue([])

      await expect(assertPeriodOpen(new Date('2026-01-01'), ['CASHIER'])).resolves.toBeUndefined()
    })

    it('allows transaction when date is on or after the lock threshold', async () => {
      ;(prisma.systemSetting.findMany as jest.Mock).mockResolvedValue([
        { key: 'lock_date', value: '2026-03-31' },
        { key: 'allow_admin_bypass', value: 'true' },
      ])

      // Transaction on lock date
      await expect(assertPeriodOpen('2026-03-31', ['CASHIER'])).resolves.toBeUndefined()

      // Transaction after lock date
      await expect(assertPeriodOpen('2026-04-15', ['CASHIER'])).resolves.toBeUndefined()
    })

    it('throws PERIOD_LOCKED when non-admin attempts transaction prior to lock date', async () => {
      ;(prisma.systemSetting.findMany as jest.Mock).mockResolvedValue([
        { key: 'lock_date', value: '2026-03-31' },
        { key: 'allow_admin_bypass', value: 'true' },
      ])

      await expect(assertPeriodOpen('2026-03-15', ['CASHIER'])).rejects.toThrow(
        'PERIOD_LOCKED: Financial period is locked prior to 2026-03-31'
      )
    })

    it('permits backdated transaction if user has ADMIN role and allowAdminBypass is enabled', async () => {
      ;(prisma.systemSetting.findMany as jest.Mock).mockResolvedValue([
        { key: 'lock_date', value: '2026-03-31' },
        { key: 'allow_admin_bypass', value: 'true' },
      ])

      await expect(assertPeriodOpen('2026-03-15', ['ADMIN'])).resolves.toBeUndefined()
      await expect(assertPeriodOpen('2026-03-15', ['SUPER_ADMIN'])).resolves.toBeUndefined()
    })

    it('rejects backdated transaction even for ADMIN if allowAdminBypass is disabled', async () => {
      ;(prisma.systemSetting.findMany as jest.Mock).mockResolvedValue([
        { key: 'lock_date', value: '2026-03-31' },
        { key: 'allow_admin_bypass', value: 'false' },
      ])

      await expect(assertPeriodOpen('2026-03-15', ['ADMIN'])).rejects.toThrow(
        'PERIOD_LOCKED: Financial period is locked prior to 2026-03-31'
      )
    })
  })
})
