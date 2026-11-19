// ─────────────────────────────────────────────────────────────
// Financial Period Lock Service (Tier-1 ERP Governance)
//
// Implements TallyPrime ("Disallow Backdated Vouchers") and
// Marg ERP ("Financial Freeze / Day Lock") period locks.
//
// All settings persist in the `system_settings` PostgreSQL table
// under category "accounting". Changes are tracked in `audit_logs`.
// ─────────────────────────────────────────────────────────────
import { parseISO, startOfDay } from 'date-fns'
import prisma from '@/lib/db/prisma'

export interface PeriodLockSettings {
  lockDate: string | null // ISO string YYYY-MM-DD or empty
  allowAdminBypass: boolean
}

let cachedPeriodLock: PeriodLockSettings | null = null
let cachedTimestamp = 0
const CACHE_TTL_MS = 60_000 // 1 minute in memory

export function invalidatePeriodLockCache(): void {
  cachedPeriodLock = null
  cachedTimestamp = 0
}

/**
 * Retrieve the current period lock configuration from PostgreSQL.
 */
export async function getPeriodLockSettings(): Promise<PeriodLockSettings> {
  const now = Date.now()
  if (cachedPeriodLock && now - cachedTimestamp < CACHE_TTL_MS) {
    return cachedPeriodLock
  }

  try {
    const rows = await prisma.systemSetting.findMany({
      where: { category: 'accounting' },
      select: { key: true, value: true },
    })

    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))

    const settings: PeriodLockSettings = {
      lockDate: map.lock_date && map.lock_date.trim().length > 0 ? map.lock_date.trim() : null,
      allowAdminBypass: map.allow_admin_bypass === 'true',
    }

    cachedPeriodLock = settings
    cachedTimestamp = now
    return settings
  } catch {
    return { lockDate: null, allowAdminBypass: true }
  }
}

/**
 * Update the financial period lock date in PostgreSQL with an immutable audit entry.
 */
export async function setPeriodLockSettings(
  input: {
    lockDate: string | null
    allowAdminBypass: boolean
  },
  userId?: string
): Promise<PeriodLockSettings> {
  const sanitizedDate = input.lockDate && input.lockDate.trim().length > 0 ? input.lockDate.trim() : ''

  await prisma.$transaction(async (tx) => {
    // 1. Upsert lock_date
    await tx.systemSetting.upsert({
      where: { category_key: { category: 'accounting', key: 'lock_date' } },
      create: {
        category: 'accounting',
        key: 'lock_date',
        value: sanitizedDate,
        dataType: 'string',
        label: 'Financial Period Lock Date (YYYY-MM-DD)',
      },
      update: {
        value: sanitizedDate,
      },
    })

    // 2. Upsert allow_admin_bypass
    await tx.systemSetting.upsert({
      where: { category_key: { category: 'accounting', key: 'allow_admin_bypass' } },
      create: {
        category: 'accounting',
        key: 'allow_admin_bypass',
        value: input.allowAdminBypass ? 'true' : 'false',
        dataType: 'boolean',
        label: 'Allow Admin to Bypass Period Lock',
      },
      update: {
        value: input.allowAdminBypass ? 'true' : 'false',
      },
    })

    // 3. Write immutable audit log
    await tx.auditLog.create({
      data: {
        userId: userId || null,
        action: 'PERIOD_LOCK_UPDATE',
        entity: 'SystemSetting',
        entityId: 'accounting.lock_date',
        newData: {
          lockDate: sanitizedDate,
          allowAdminBypass: input.allowAdminBypass,
        },
        metadata: {
          source: 'ADMIN_FINANCIAL_GOVERNANCE',
          timestamp: new Date().toISOString(),
        },
      },
    })
  })

  invalidatePeriodLockCache()
  return getPeriodLockSettings()
}

/**
 * Asserts whether a transaction date falls in an open accounting period.
 *
 * @throws Error starting with "PERIOD_LOCKED: " if transaction violates lock threshold.
 */
export async function assertPeriodOpen(
  transactionDate: Date | string | null | undefined,
  userRoles: string[] = []
): Promise<void> {
  if (!transactionDate) {
    return
  }

  const settings = await getPeriodLockSettings()
  if (!settings.lockDate) {
    return // No period lock configured
  }

  // Check if admin bypass is permitted
  const isAdmin = userRoles.some(
    (role) => role.toUpperCase() === 'ADMIN' || role.toUpperCase() === 'SUPER_ADMIN'
  )
  if (isAdmin && settings.allowAdminBypass) {
    return // Administrator role authorized to record backdated entries
  }

  const targetDate = typeof transactionDate === 'string' ? parseISO(transactionDate) : transactionDate
  const lockThreshold = parseISO(settings.lockDate)

  // Disallow entries where transaction is strictly prior to lock date start of day
  if (startOfDay(targetDate).getTime() < startOfDay(lockThreshold).getTime()) {
    throw new Error(
      `PERIOD_LOCKED: Financial period is locked prior to ${settings.lockDate}. Backdated voucher entry is disallowed. Contact system administrator.`
    )
  }
}
