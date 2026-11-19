import type { PrismaClient } from '@prisma/client'

const SETTINGS = [
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

  // Notifications
  { category: 'notifications', key: 'low_stock_enabled', value: 'true', dataType: 'boolean', label: 'Low Stock Alerts' },
  { category: 'notifications', key: 'expiry_alert_enabled', value: 'true', dataType: 'boolean', label: 'Expiry Alerts' },
  { category: 'notifications', key: 'payment_due_enabled', value: 'true', dataType: 'boolean', label: 'Payment Due Alerts' },

  // GST
  { category: 'gst', key: 'tax_inclusive', value: 'false', dataType: 'boolean', label: 'Prices are Tax Inclusive' },
  { category: 'gst', key: 'default_gst_rate', value: '12', dataType: 'number', label: 'Default GST Rate %' },
  { category: 'gst', key: 'state_code', value: '29', dataType: 'string', label: 'State Code (for GST)' },

  // Accounting & Financial Governance (Period Locking)
  { category: 'accounting', key: 'lock_date', value: '', dataType: 'string', label: 'Financial Period Lock Date (YYYY-MM-DD)' },
  { category: 'accounting', key: 'allow_admin_bypass', value: 'true', dataType: 'boolean', label: 'Allow Admin to Bypass Period Lock' },
]

export async function seedSettings(prisma: PrismaClient) {
  for (const setting of SETTINGS) {
    await prisma.systemSetting.upsert({
      where: { category_key: { category: setting.category, key: setting.key } },
      update: {},
      create: setting,
    })
  }

  // Seed default tenant organization settings for default-org
  const defaultOrgSettings = [
    { key: 'pharmacy_name', value: 'PharmaCare Medical Store' },
    { key: 'gstin', value: '29ABCDE1234F1Z5' },
    { key: 'dl_number', value: 'DL-KA-12345' },
    { key: 'invoice_header', value: 'PharmaCare Medical Store' },
    { key: 'invoice_footer', value: 'Thank you for choosing us for your healthcare needs. Get well soon!' },
    { key: 'low_stock_threshold', value: '10' },
    { key: 'thermal_printer_paper_width', value: '80mm' },
  ]

  for (const s of defaultOrgSettings) {
    await prisma.organizationSetting.upsert({
      where: { organizationId_key: { organizationId: 'default-org', key: s.key } },
      update: { value: s.value },
      create: { organizationId: 'default-org', key: s.key, value: s.value },
    })
  }

  console.log(`  ✓ ${SETTINGS.length} system settings & ${defaultOrgSettings.length} organization settings seeded`)
}
