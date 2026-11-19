// ─────────────────────────────────────────────────────────────
// Settings Service
//
// Reads the seeded global `system_settings` table. Settings are
// keyed `${category}.${key}` (e.g. `pos.max_discount_percent`) and
// stored with an explicit `dataType` ("boolean" | "number" | ...).
//
// The POS module has its own typed accessor (`getPosSettings`)
// with defaults that mirror `prisma/seeds/settings.ts`, so a POS
// call never breaks on a missing row.
// ─────────────────────────────────────────────────────────────
import prisma from '@/lib/db/prisma'
import { ensureProvisionedDbSettings } from './settings-provisioning-service'

export interface PosSettings {
  autoPrintInvoice: boolean
  invoiceType: 'thermal' | 'a4'
  maxDiscountPercent: number
  allowCreditSales: boolean
  requireCustomerForCredit: boolean
  roundOffTotal: boolean
  fefoEnabled: boolean
  negativeStock: boolean
  taxInclusive: boolean
}

/** Defaults mirror prisma/seeds/settings.ts (POS, inventory, GST categories). */
export const DEFAULT_POS_SETTINGS: PosSettings = {
  autoPrintInvoice: false,
  invoiceType: 'thermal',
  maxDiscountPercent: 20,
  allowCreditSales: true,
  requireCustomerForCredit: true,
  roundOffTotal: true,
  fefoEnabled: true,
  negativeStock: false,
  taxInclusive: false,
}

let cachedSettingsMap: Record<string, string> | null = null
let cachedSettingsTimestamp = 0
const SETTINGS_CACHE_TTL_MS = 60_000 // 1 minute in memory

/**
 * Invalidate in-memory settings cache when settings are saved.
 */
export function invalidateSettingsCache(): void {
  cachedSettingsMap = null
  cachedSettingsTimestamp = 0
}

/**
 * All system settings as `key = `${category}.${key}`` → value.
 * Cached in-memory with a 1-minute TTL to prevent repeated DB scans.
 */
export async function getSystemSettingsMap(): Promise<Record<string, string>> {
  const now = Date.now()
  if (cachedSettingsMap && now - cachedSettingsTimestamp < SETTINGS_CACHE_TTL_MS) {
    return cachedSettingsMap
  }
  const rows = await prisma.systemSetting.findMany({
    select: { category: true, key: true, value: true },
    orderBy: [{ category: 'asc' }, { key: 'asc' }],
  })
  cachedSettingsMap = Object.fromEntries(rows.map((r) => [`${r.category}.${r.key}`, r.value]))
  cachedSettingsTimestamp = now
  return cachedSettingsMap
}

/**
 * Get all system settings grouped by category with full metadata
 */
export async function getAllSystemSettingsGrouped() {
  await ensureProvisionedDbSettings()
  const rows = await prisma.systemSetting.findMany({
    orderBy: [{ category: 'asc' }, { key: 'asc' }],
  })

  const grouped: Record<
    string,
    Array<{
      id: string
      key: string
      value: string
      dataType: string
      label: string | null
      updatedAt: Date
    }>
  > = {}

  for (const r of rows) {
    if (!grouped[r.category]) {
      grouped[r.category] = []
    }
    grouped[r.category].push({
      id: r.id,
      key: r.key,
      value: r.value,
      dataType: r.dataType,
      label: r.label,
      updatedAt: r.updatedAt,
    })
  }

  return { settings: rows, grouped }
}

/**
 * Update multiple system settings in a single atomic transaction
 */
export async function updateSystemSettings(
  updates: Array<{ category: string; key: string; value: string }>,
  userId?: string
) {
  const updated = await prisma.$transaction(async (tx) => {
    const results = []
    for (const u of updates) {
      const row = await tx.systemSetting.upsert({
        where: { category_key: { category: u.category, key: u.key } },
        update: { value: String(u.value) },
        create: {
          category: u.category,
          key: u.key,
          value: String(u.value),
          dataType: typeof u.value === 'boolean' ? 'boolean' : typeof u.value === 'number' ? 'number' : 'string',
        },
      })
      results.push(row)
    }

    if (userId) {
      await tx.auditLog.create({
        data: {
          userId,
          action: 'UPDATE',
          entity: 'SystemSetting',
          entityId: 'batch',
          newData: { count: updates.length, updates },
        },
      })
    }

    return results
  })

  invalidateSettingsCache()
  return updated
}

function pickBoolean(map: Record<string, string>, key: string, fallback: boolean): boolean {
  const raw = map[key]
  if (raw === undefined) return fallback
  return raw === 'true' || raw === '1'
}

function pickNumber(map: Record<string, string>, key: string, fallback: number): number {
  const raw = map[key]
  if (raw === undefined) return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

function pickInvoiceType(
  map: Record<string, string>,
  fallback: PosSettings['invoiceType']
): PosSettings['invoiceType'] {
  const raw = map['pos.invoice_type']
  return raw === 'a4' ? 'a4' : raw === 'thermal' ? 'thermal' : fallback
}

/**
 * Typed POS + related settings. Missing rows fall back to the seeded
 * defaults so callers always receive a complete, valid object.
 */
export async function getPosSettings(): Promise<PosSettings> {
  const map = await getSystemSettingsMap()
  return {
    autoPrintInvoice: pickBoolean(
      map,
      'pos.auto_print_invoice',
      DEFAULT_POS_SETTINGS.autoPrintInvoice
    ),
    invoiceType: pickInvoiceType(map, DEFAULT_POS_SETTINGS.invoiceType),
    maxDiscountPercent: pickNumber(
      map,
      'pos.max_discount_percent',
      DEFAULT_POS_SETTINGS.maxDiscountPercent
    ),
    allowCreditSales: pickBoolean(
      map,
      'pos.allow_credit_sales',
      DEFAULT_POS_SETTINGS.allowCreditSales
    ),
    requireCustomerForCredit: pickBoolean(
      map,
      'pos.require_customer_for_credit',
      DEFAULT_POS_SETTINGS.requireCustomerForCredit
    ),
    roundOffTotal: pickBoolean(map, 'pos.round_off_total', DEFAULT_POS_SETTINGS.roundOffTotal),
    fefoEnabled: pickBoolean(map, 'inventory.fefo_enabled', DEFAULT_POS_SETTINGS.fefoEnabled),
    negativeStock: pickBoolean(map, 'inventory.negative_stock', DEFAULT_POS_SETTINGS.negativeStock),
    taxInclusive: pickBoolean(map, 'gst.tax_inclusive', DEFAULT_POS_SETTINGS.taxInclusive),
  }
}
