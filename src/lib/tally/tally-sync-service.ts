// ─────────────────────────────────────────────────────────────
// Tally Sync Engine & Service
// Coordinates real-time pushes, background queue, error logging,
// and master synchronization for Sales, Purchases, and Masters.
// ─────────────────────────────────────────────────────────────
import prisma from '@/lib/db/prisma'

import { pushXmlToTally } from './tally-client'
import { getTallyConfig } from './tally-service'
import type { TallyPushResult, TallySyncLogEntry } from './tally-types'
import {
  buildCustomerLedgersXml,
  buildPurchaseVouchersXml,
  buildSalesVouchersXml,
  buildStockItemsXml,
  buildSupplierLedgersXml,
  type CustomerForTally,
  type PurchaseForTally,
  type SaleForTally,
  type StockItemForTally,
  type SupplierForTally,
} from './tally-xml-builder'

const SYNC_LOG_KEY = 'recent_sync_logs'
const MAX_LOGS_KEPT = 100

/**
 * Retrieve recent Tally sync log history from SystemSetting.
 */
export async function getTallySyncLogs(): Promise<TallySyncLogEntry[]> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: {
        category_key: {
          category: 'tally',
          key: SYNC_LOG_KEY,
        },
      },
    })
    if (!setting?.value) return []
    return JSON.parse(setting.value) as TallySyncLogEntry[]
  } catch {
    return []
  }
}

/**
 * Record a sync attempt in persistent system settings.
 */
async function appendSyncLog(entry: Omit<TallySyncLogEntry, 'id' | 'createdAt'>): Promise<void> {
  try {
    const existing = await getTallySyncLogs()
    const newEntry: TallySyncLogEntry = {
      ...entry,
      id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
    }

    // Keep newest MAX_LOGS_KEPT
    const updated = [
      newEntry,
      ...existing.filter((e) => e.entityId !== entry.entityId || e.status === 'SYNCED'),
    ].slice(0, MAX_LOGS_KEPT)

    await prisma.systemSetting.upsert({
      where: {
        category_key: {
          category: 'tally',
          key: SYNC_LOG_KEY,
        },
      },
      update: {
        value: JSON.stringify(updated),
        dataType: 'json',
      },
      create: {
        category: 'tally',
        key: SYNC_LOG_KEY,
        value: JSON.stringify(updated),
        dataType: 'json',
        label: 'Recent Tally Synchronization Logs',
      },
    })
  } catch (err) {
    console.error('Failed to persist Tally sync log:', err)
  }
}

/**
 * Synchronize a Sale directly into Tally as a Sales Voucher.
 * Called automatically when POS "Charge" is clicked, or manually from Sales History / Hub.
 */
export async function syncSaleToTally(saleId: string): Promise<TallyPushResult> {
  const config = await getTallyConfig()

  if (!config.autoSyncSales) {
    return {
      success: true,
      status: 'OFFLINE',
      createdCount: 0,
      alteredCount: 0,
      errorCount: 0,
      errorMessage: 'Auto-sync for sales is currently disabled in accounting settings',
      durationMs: 0,
    }
  }

  // 1. Fetch sale with line items, product tax/HSN, customer, and payments
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      items: {
        include: {
          product: {
            select: {
              name: true,
              sku: true,
              hsnCode: true,
              unitOfMeasure: true,
            },
          },
        },
      },
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
          gstin: true,
          address: true,
          state: true,
          creditLimit: true,
        },
      },
      payments: {
        select: {
          method: true,
          amount: true,
        },
      },
    },
  })

  if (!sale) {
    return {
      success: false,
      status: 'FAILED',
      createdCount: 0,
      alteredCount: 0,
      errorCount: 1,
      errorMessage: `Sale #${saleId} not found`,
      durationMs: 0,
    }
  }

  // 2. If customer has credit or GSTIN, push Customer Ledger Master to Tally first
  if (sale.customer && (Number(sale.customer.creditLimit) > 0 || sale.customer.gstin)) {
    try {
      await syncCustomerToTally(sale.customer.id)
    } catch {
      // Continue to push sale even if master push warning occurs
    }
  }

  const isInterstate = Boolean(
    sale.customer?.state &&
    !sale.customer.state.includes('Karnataka') &&
    !sale.customer.state.startsWith('29')
  )

  const saleForTally: SaleForTally = {
    id: sale.id,
    invoiceNumber: sale.invoiceNumber,
    saleDate: sale.saleDate,
    customer: sale.customer
      ? {
          id: sale.customer.id,
          name: sale.customer.name,
          phone: sale.customer.phone ?? undefined,
          gstin: sale.customer.gstin ?? undefined,
          address: sale.customer.address ?? undefined,
          state: sale.customer.state ?? undefined,
        }
      : null,
    subtotal: Number(sale.subtotal),
    discountAmount: Number(sale.discountAmount),
    taxAmount: Number(sale.taxAmount),
    cgstAmount: Number(sale.cgstAmount),
    sgstAmount: Number(sale.sgstAmount),
    igstAmount: Number(sale.igstAmount),
    totalAmount: Number(sale.totalAmount),
    roundOff: 0,
    items: sale.items.map((i) => {
      const itemTax = Number(i.taxAmount || 0)
      return {
        id: i.id,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        totalAmount: Number(i.totalAmount),
        taxAmount: itemTax,
        cgstAmount: isInterstate ? 0 : itemTax / 2,
        sgstAmount: isInterstate ? 0 : itemTax / 2,
        igstAmount: isInterstate ? itemTax : 0,
        product: {
          name: i.productName,
          sku: i.productSku,
          hsnCode: i.product?.hsnCode ?? undefined,
          unitOfMeasure: i.product?.unitOfMeasure ?? undefined,
        },
      }
    }),
  }

  // 4. Generate standard Tally XML
  const xml = buildSalesVouchersXml([saleForTally], config)

  // 5. Send to Tally HTTP Server
  const result = await pushXmlToTally(xml, config.serverUrl)

  // 6. Record log
  await appendSyncLog({
    entityType: 'SALE',
    entityId: sale.id,
    referenceNumber: sale.invoiceNumber,
    entityName: sale.customer?.name || 'Cash Sale',
    amount: Number(sale.totalAmount),
    status: result.status,
    message: result.errorMessage || `Voucher created in Tally (${result.createdCount} voucher)`,
    attempts: 1,
    lastAttemptAt: new Date().toISOString(),
  })

  return result
}

/**
 * Synchronize a received Purchase Order into Tally as a Purchase Voucher.
 */
export async function syncPurchaseToTally(purchaseId: string): Promise<TallyPushResult> {
  const config = await getTallyConfig()

  const purchase = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    include: {
      supplier: true,
      items: {
        include: {
          product: {
            select: {
              name: true,
              sku: true,
              hsnCode: true,
              unitOfMeasure: true,
            },
          },
        },
      },
    },
  })

  if (!purchase) {
    return {
      success: false,
      status: 'FAILED',
      createdCount: 0,
      alteredCount: 0,
      errorCount: 1,
      errorMessage: `Purchase #${purchaseId} not found`,
      durationMs: 0,
    }
  }

  // Sync supplier master first
  if (purchase.supplier) {
    try {
      const suppForTally: SupplierForTally = {
        id: purchase.supplier.id,
        name: purchase.supplier.name,
        contactPerson: purchase.supplier.contactPerson ?? undefined,
        phone: purchase.supplier.phone ?? undefined,
        gstin: purchase.supplier.gstin ?? undefined,
        address: purchase.supplier.address ?? undefined,
        city: purchase.supplier.city ?? undefined,
        state: purchase.supplier.state ?? undefined,
        pincode: purchase.supplier.pincode ?? undefined,
        outstandingBalance: Number(purchase.supplier.outstandingBalance || 0),
      }
      const suppXml = buildSupplierLedgersXml([suppForTally])
      await pushXmlToTally(suppXml, config.serverUrl)
    } catch {
      // Continue
    }
  }

  const purchaseForTally: PurchaseForTally = {
    id: purchase.id,
    purchaseNumber: purchase.purchaseNumber,
    invoiceNumber: purchase.invoiceNumber ?? undefined,
    purchaseDate: purchase.purchaseDate,
    supplier: {
      id: purchase.supplier.id,
      name: purchase.supplier.name,
      gstin: purchase.supplier.gstin ?? undefined,
      state: purchase.supplier.state ?? undefined,
      phone: purchase.supplier.phone ?? undefined,
      address: purchase.supplier.address ?? undefined,
    },
    subtotal: Number(purchase.subtotal),
    taxAmount: Number(purchase.taxAmount),
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    totalAmount: Number(purchase.totalAmount),
    items: purchase.items.map((i) => ({
      id: i.id,
      quantity: i.receivedQuantity || i.orderedQuantity,
      unitCost: Number(i.unitCost),
      totalAmount: Number(i.totalAmount),
      product: {
        name: i.product.name,
        sku: i.product.sku,
        hsnCode: i.product.hsnCode ?? undefined,
        unitOfMeasure: i.product.unitOfMeasure ?? undefined,
      },
      batchNumber: undefined,
      expiryDate: undefined,
    })),
  }

  const xml = buildPurchaseVouchersXml([purchaseForTally], config)
  const result = await pushXmlToTally(xml, config.serverUrl)

  await appendSyncLog({
    entityType: 'PURCHASE',
    entityId: purchase.id,
    referenceNumber: purchase.invoiceNumber || purchase.purchaseNumber,
    entityName: purchase.supplier.name,
    amount: Number(purchase.totalAmount),
    status: result.status,
    message:
      result.errorMessage || `Purchase voucher created in Tally (${result.createdCount} voucher)`,
    attempts: 1,
    lastAttemptAt: new Date().toISOString(),
  })

  return result
}

/**
 * Synchronize a single Customer as a Tally Ledger under Sundry Debtors.
 */
export async function syncCustomerToTally(customerId: string): Promise<TallyPushResult> {
  const config = await getTallyConfig()
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
  })

  if (!customer) {
    return {
      success: false,
      status: 'FAILED',
      createdCount: 0,
      alteredCount: 0,
      errorCount: 1,
      errorMessage: `Customer #${customerId} not found`,
      durationMs: 0,
    }
  }

  const customerForTally: CustomerForTally = {
    id: customer.id,
    name: customer.name,
    phone: customer.phone ?? undefined,
    gstin: customer.gstin ?? undefined,
    address: customer.address ?? undefined,
    city: customer.city ?? undefined,
    state: customer.state ?? undefined,
    pincode: customer.pincode ?? undefined,
    creditLimit: Number(customer.creditLimit || 0),
    outstandingBalance: Number(customer.outstandingBalance || 0),
  }

  const xml = buildCustomerLedgersXml([customerForTally])
  const result = await pushXmlToTally(xml, config.serverUrl)

  await appendSyncLog({
    entityType: 'CUSTOMER',
    entityId: customer.id,
    referenceNumber: customer.phone || customer.id.slice(-6),
    entityName: customer.name,
    amount: Number(customer.outstandingBalance),
    status: result.status,
    message: result.errorMessage || `Customer ledger synchronized under Sundry Debtors`,
    attempts: 1,
    lastAttemptAt: new Date().toISOString(),
  })

  return result
}

/**
 * Synchronize a single Product as a Stock Item in Tally with HSN, Unit, and Batch tracking.
 */
export async function syncProductToTally(productId: string): Promise<TallyPushResult> {
  const config = await getTallyConfig()
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      inventory: true,
    },
  })

  if (!product) {
    return {
      success: false,
      status: 'FAILED',
      createdCount: 0,
      alteredCount: 0,
      errorCount: 1,
      errorMessage: `Product #${productId} not found`,
      durationMs: 0,
    }
  }

  const totalStock = product.inventory.reduce((acc, inv) => acc + inv.totalQuantity, 0)
  const stockItemForTally: StockItemForTally = {
    id: product.id,
    name: product.name,
    sku: product.sku,
    unitOfMeasure: product.unitOfMeasure || 'Strip',
    hsnCode: product.hsnCode ?? undefined,
    gstRate: Number(product.gstRate),
    mrp: Number(product.mrp),
    costPrice: product.costPrice ? Number(product.costPrice) : undefined,
    openingBalance: totalStock,
    openingValue: totalStock * Number(product.costPrice || product.mrp),
  }

  const xml = buildStockItemsXml([stockItemForTally])
  const result = await pushXmlToTally(xml, config.serverUrl)

  await appendSyncLog({
    entityType: 'PRODUCT',
    entityId: product.id,
    referenceNumber: product.sku,
    entityName: product.name,
    amount: Number(product.mrp),
    status: result.status,
    message: result.errorMessage || `Stock item synchronized with batch tracking enabled`,
    attempts: 1,
    lastAttemptAt: new Date().toISOString(),
  })

  return result
}

/**
 * Bulk synchronize all customers with active credit accounts or GSTIN.
 */
export async function syncAllCreditCustomers(): Promise<{ total: number; successCount: number }> {
  const config = await getTallyConfig()
  const customers = await prisma.customer.findMany({
    where: {
      isActive: true,
      OR: [{ creditLimit: { gt: 0 } }, { outstandingBalance: { gt: 0 } }, { gstin: { not: null } }],
    },
  })

  if (customers.length === 0) return { total: 0, successCount: 0 }

  const mapped: CustomerForTally[] = customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone ?? undefined,
    gstin: c.gstin ?? undefined,
    address: c.address ?? undefined,
    city: c.city ?? undefined,
    state: c.state ?? undefined,
    pincode: c.pincode ?? undefined,
    creditLimit: Number(c.creditLimit || 0),
    outstandingBalance: Number(c.outstandingBalance || 0),
  }))

  const xml = buildCustomerLedgersXml(mapped)
  const result = await pushXmlToTally(xml, config.serverUrl)

  await appendSyncLog({
    entityType: 'CUSTOMER',
    entityId: 'bulk_credit_customers',
    referenceNumber: `${customers.length} Customers`,
    entityName: 'Bulk Credit Customers Master',
    status: result.status,
    message: result.errorMessage || `Pushed ${customers.length} customer ledgers to Tally`,
    attempts: 1,
    lastAttemptAt: new Date().toISOString(),
  })

  return { total: customers.length, successCount: result.success ? customers.length : 0 }
}

/**
 * Bulk synchronize all stock items to Tally.
 */
export async function syncAllProducts(): Promise<{ total: number; successCount: number }> {
  const config = await getTallyConfig()
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { inventory: true },
  })

  if (products.length === 0) return { total: 0, successCount: 0 }

  const mapped: StockItemForTally[] = products.map((p) => {
    const totalStock = p.inventory.reduce((acc, inv) => acc + inv.totalQuantity, 0)
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      unitOfMeasure: p.unitOfMeasure || 'Strip',
      hsnCode: p.hsnCode ?? undefined,
      gstRate: Number(p.gstRate),
      mrp: Number(p.mrp),
      costPrice: p.costPrice ? Number(p.costPrice) : undefined,
      openingBalance: totalStock,
      openingValue: totalStock * Number(p.costPrice || p.mrp),
    }
  })

  const xml = buildStockItemsXml(mapped)
  const result = await pushXmlToTally(xml, config.serverUrl)

  await appendSyncLog({
    entityType: 'PRODUCT',
    entityId: 'bulk_stock_items',
    referenceNumber: `${products.length} Items`,
    entityName: 'Bulk Stock Items Master',
    status: result.status,
    message: result.errorMessage || `Pushed ${products.length} stock items to Tally`,
    attempts: 1,
    lastAttemptAt: new Date().toISOString(),
  })

  return { total: products.length, successCount: result.success ? products.length : 0 }
}

/**
 * Retry an existing sync entry.
 */
export async function retrySync(logId: string): Promise<TallyPushResult> {
  const logs = await getTallySyncLogs()
  const entry = logs.find((l) => l.id === logId)

  if (!entry) {
    return {
      success: false,
      status: 'FAILED',
      createdCount: 0,
      alteredCount: 0,
      errorCount: 1,
      errorMessage: 'Sync entry not found',
      durationMs: 0,
    }
  }

  switch (entry.entityType) {
    case 'SALE':
      return syncSaleToTally(entry.entityId)
    case 'PURCHASE':
      return syncPurchaseToTally(entry.entityId)
    case 'CUSTOMER':
      return syncCustomerToTally(entry.entityId)
    case 'PRODUCT':
      return syncProductToTally(entry.entityId)
    default:
      return {
        success: false,
        status: 'FAILED',
        createdCount: 0,
        alteredCount: 0,
        errorCount: 1,
        errorMessage: 'Unknown entity type',
        durationMs: 0,
      }
  }
}
