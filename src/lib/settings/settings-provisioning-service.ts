// ─────────────────────────────────────────────────────────────
// Database Settings Provisioning Service
// Ensures that all configuration, statutory parameters, and defaults
// are actively provisioned in the PostgreSQL database (zero hardcoding).
// ─────────────────────────────────────────────────────────────
import prisma from '@/lib/db/prisma'

export interface ProvisioningSummary {
  systemSettingsCount: number
  systemSettingsCreated: number
  orgSettingsCount: number
  orgSettingsCreated: number
  organizationProvisioned: boolean
}

const REQUIRED_SYSTEM_SETTINGS = [
  // General
  { category: 'general', key: 'app_name', value: 'PharmaCare', dataType: 'string', label: 'Application Name' },
  { category: 'general', key: 'date_format', value: 'dd/MM/yyyy', dataType: 'string', label: 'Date Format' },
  { category: 'general', key: 'currency_symbol', value: '₹', dataType: 'string', label: 'Currency Symbol' },
  { category: 'general', key: 'decimal_places', value: '2', dataType: 'number', label: 'Decimal Places' },

  // POS
  { category: 'pos', key: 'auto_print_invoice', value: 'false', dataType: 'boolean', label: 'Auto Print Invoice' },
  { category: 'pos', key: 'invoice_type', value: 'thermal', dataType: 'string', label: 'Invoice Type (thermal/a4)' },
  { category: 'pos', key: 'max_discount_percent', value: '20', dataType: 'number', label: 'Max Discount %' },
  { category: 'pos', key: 'allow_credit_sales', value: 'true', dataType: 'boolean', label: 'Allow Credit Sales' },
  { category: 'pos', key: 'require_customer_for_credit', value: 'true', dataType: 'boolean', label: 'Require Customer for Credit' },
  { category: 'pos', key: 'round_off_total', value: 'true', dataType: 'boolean', label: 'Round Off Invoice Total' },

  // Inventory
  { category: 'inventory', key: 'fefo_enabled', value: 'true', dataType: 'boolean', label: 'FEFO Batch Selection' },
  { category: 'inventory', key: 'negative_stock', value: 'false', dataType: 'boolean', label: 'Allow Negative Stock' },
  { category: 'inventory', key: 'low_stock_threshold', value: '10', dataType: 'number', label: 'Low Stock Threshold' },
  { category: 'inventory', key: 'expiry_alert_days', value: '90', dataType: 'number', label: 'Expiry Alert Days' },
  { category: 'inventory', key: 'approval_tier_self_max', value: '10', dataType: 'number', label: 'Self Approval Max Quantity' },
  { category: 'inventory', key: 'approval_tier_manager_max', value: '50', dataType: 'number', label: 'Manager Approval Max Quantity' },

  // Notifications
  { category: 'notifications', key: 'low_stock_enabled', value: 'true', dataType: 'boolean', label: 'Low Stock Alerts' },
  { category: 'notifications', key: 'expiry_alert_enabled', value: 'true', dataType: 'boolean', label: 'Expiry Alerts' },
  { category: 'notifications', key: 'payment_due_enabled', value: 'true', dataType: 'boolean', label: 'Payment Due Alerts' },

  // GST
  { category: 'gst', key: 'tax_inclusive', value: 'false', dataType: 'boolean', label: 'Prices are Tax Inclusive' },
  { category: 'gst', key: 'default_gst_rate', value: '12', dataType: 'number', label: 'Default GST Rate %' },
  { category: 'gst', key: 'state_code', value: '29', dataType: 'string', label: 'State Code (for GST)' },

  // Accounting & Period Lock
  { category: 'accounting', key: 'lock_date', value: '', dataType: 'string', label: 'Financial Period Lock Date (YYYY-MM-DD)' },
  { category: 'accounting', key: 'allow_admin_bypass', value: 'true', dataType: 'boolean', label: 'Allow Admin to Bypass Period Lock' },
]

const REQUIRED_ORG_SETTINGS: Record<string, string> = {
  invoicePrefix: 'PC-HO-',
  receiptFooter: 'Thank you for trusting PharmaCare. Get well soon!',
  lowStockThreshold: '10',
  expiryAlertDays: '90',
  taxInclusive: 'false',
  fefoEnabled: 'true',
  maxDiscountPercent: '20',
  allowCreditSales: 'true',
}

/**
 * Guarantee that all necessary settings exist in the database.
 */
export async function ensureProvisionedDbSettings(): Promise<ProvisioningSummary> {
  // 1. System Settings Provisioning
  let systemSettingsCreated = 0
  for (const s of REQUIRED_SYSTEM_SETTINGS) {
    const existing = await prisma.systemSetting.findUnique({
      where: { category_key: { category: s.category, key: s.key } },
    })
    if (!existing) {
      await prisma.systemSetting.create({ data: s })
      systemSettingsCreated++
    }
  }

  // 2. Organization Provisioning
  let org = await prisma.organization.findFirst()
  let organizationProvisioned = false

  if (!org) {
    org = await prisma.organization.create({
      data: {
        id: 'default-org',
        name: 'PharmaCare Medical Store',
        legalName: 'PharmaCare Medical Store Pvt. Ltd.',
        gstin: '29ABCDE1234F1Z5',
        pan: 'ABCDE1234F',
        dlNumber: 'DL-KA-12345',
        email: 'info@pharmacare.local',
        phone: '+91-9876543210',
        address: '123, Medical Street, Health Nagar',
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '560001',
        country: 'India',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        financialYearStart: 4,
      },
    })
    organizationProvisioned = true
  } else if (!org.pan && org.gstin && org.gstin.length >= 12) {
    // Fill PAN from GSTIN if PAN is null
    const panFromGst = org.gstin.substring(2, 12).toUpperCase()
    await prisma.organization.update({
      where: { id: org.id },
      data: { pan: panFromGst },
    })
  }

  // 3. Organization Settings Provisioning
  let orgSettingsCreated = 0
  if (org) {
    for (const [key, value] of Object.entries(REQUIRED_ORG_SETTINGS)) {
      const existing = await prisma.organizationSetting.findUnique({
        where: { organizationId_key: { organizationId: org.id, key } },
      })
      if (!existing) {
        await prisma.organizationSetting.create({
          data: { organizationId: org.id, key, value },
        })
        orgSettingsCreated++
      }
    }
  }

  const [totalSystem, totalOrg] = await Promise.all([
    prisma.systemSetting.count(),
    org ? prisma.organizationSetting.count({ where: { organizationId: org.id } }) : Promise.resolve(0),
  ])

  return {
    systemSettingsCount: totalSystem,
    systemSettingsCreated,
    orgSettingsCount: totalOrg,
    orgSettingsCreated,
    organizationProvisioned,
  }
}

