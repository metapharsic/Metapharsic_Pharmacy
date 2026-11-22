// ─────────────────────────────────────────────────────────────
// Tally Service
// Manages Tally configuration, orchestrates data retrieval,
// XML exports, GSTR-1 CSV/JSON reports, and sync status.
// ─────────────────────────────────────────────────────────────
import { format, parseISO, startOfDay, endOfDay } from 'date-fns'

import prisma from '@/lib/db/prisma'
import { resolveBranchScope, type AuthUser } from '@/lib/inventory/branch-access'

import {
  generateGstr1Csv,
  generateGstr1Json,
  generateSalesRegisterCsv,
  processGstr1Data,
} from './gstr1-exporter'
import {
  generatePurchasesRegisterCsv,
  generateCustomersCsv,
  generateSuppliersCsv,
  generateStockItemsCsv,
  generateDaybookCsv,
  generateDebitNotesCsv,
  generateUnitsCsv,
  generatePriceListsCsv,
} from './tally-csv-generators'
import {
  DEFAULT_TALLY_CONFIG,
  type BatchSummaryItem,
  type CompanySetupForTally,
  type DebitNoteForTally,
  type Gstr1ReportSummary,
  type PriceListForTally,
  type TallyConfig,
  type TallyExportQuery,
  type TallyExportSummary,
  type UnitForTally,
} from './tally-types'
import {
  buildCompanySetupXml,
  buildCustomerLedgersXml,
  buildDayBookXml,
  buildDebitNotesXml,
  buildDutiesTaxesLedgersXml,
  buildPriceListXml,
  buildPurchaseVouchersXml,
  buildSalesVouchersXml,
  buildStockItemsXml,
  buildSupplierLedgersXml,
  buildUnitsXml,
  type CustomerForTally,
  type ProductForTally,
  type PurchaseForTally,
  type SaleForTally,
  type SupplierForTally,
} from './tally-xml-builder'
import { getPharmaUnitsForTally } from '@/lib/inventory/unit-conversion'

// ─── Tally Config Management ──────────────────────────────────

export async function getTallyConfig(): Promise<TallyConfig> {
  const rows = await prisma.systemSetting.findMany({
    where: { category: 'tally' },
    select: { key: true, value: true },
  })

  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))

  return {
    serverUrl: map.server_url || DEFAULT_TALLY_CONFIG.serverUrl,
    companyName: map.company_name || DEFAULT_TALLY_CONFIG.companyName,
    autoSyncSales:
      map.auto_sync_sales !== undefined
        ? map.auto_sync_sales === 'true'
        : DEFAULT_TALLY_CONFIG.autoSyncSales,
    autoSyncPurchases:
      map.auto_sync_purchases !== undefined
        ? map.auto_sync_purchases === 'true'
        : DEFAULT_TALLY_CONFIG.autoSyncPurchases,
    cashLedger: map.cash_ledger || DEFAULT_TALLY_CONFIG.cashLedger,
    bankLedger: map.bank_ledger || DEFAULT_TALLY_CONFIG.bankLedger,
    salesLedger: map.sales_ledger || DEFAULT_TALLY_CONFIG.salesLedger,
    purchaseLedger: map.purchase_ledger || DEFAULT_TALLY_CONFIG.purchaseLedger,
    cgstOutputLedger: map.cgst_output_ledger || DEFAULT_TALLY_CONFIG.cgstOutputLedger,
    sgstOutputLedger: map.sgst_output_ledger || DEFAULT_TALLY_CONFIG.sgstOutputLedger,
    igstOutputLedger: map.igst_output_ledger || DEFAULT_TALLY_CONFIG.igstOutputLedger,
    cgstInputLedger: map.cgst_input_ledger || DEFAULT_TALLY_CONFIG.cgstInputLedger,
    sgstInputLedger: map.sgst_input_ledger || DEFAULT_TALLY_CONFIG.sgstInputLedger,
    igstInputLedger: map.igst_input_ledger || DEFAULT_TALLY_CONFIG.igstInputLedger,
    roundOffLedger: map.round_off_ledger || DEFAULT_TALLY_CONFIG.roundOffLedger,
    discountLedger: map.discount_ledger || DEFAULT_TALLY_CONFIG.discountLedger,
    defaultGodown: map.default_godown || DEFAULT_TALLY_CONFIG.defaultGodown,
  }
}

export async function saveTallyConfig(input: Partial<TallyConfig>): Promise<TallyConfig> {
  const entries: [string, string | undefined][] = [
    ['server_url', input.serverUrl],
    ['company_name', input.companyName],
    [
      'auto_sync_sales',
      input.autoSyncSales !== undefined ? String(input.autoSyncSales) : undefined,
    ],
    [
      'auto_sync_purchases',
      input.autoSyncPurchases !== undefined ? String(input.autoSyncPurchases) : undefined,
    ],
    ['cash_ledger', input.cashLedger],
    ['bank_ledger', input.bankLedger],
    ['sales_ledger', input.salesLedger],
    ['purchase_ledger', input.purchaseLedger],
    ['cgst_output_ledger', input.cgstOutputLedger],
    ['sgst_output_ledger', input.sgstOutputLedger],
    ['igst_output_ledger', input.igstOutputLedger],
    ['cgst_input_ledger', input.cgstInputLedger],
    ['sgst_input_ledger', input.sgstInputLedger],
    ['igst_input_ledger', input.igstInputLedger],
    ['round_off_ledger', input.roundOffLedger],
    ['discount_ledger', input.discountLedger],
    ['default_godown', input.defaultGodown],
  ]

  for (const [key, value] of entries) {
    if (value !== undefined) {
      await prisma.systemSetting.upsert({
        where: {
          category_key: {
            category: 'tally',
            key,
          },
        },
        update: { value },
        create: {
          category: 'tally',
          key,
          value,
          dataType: 'string',
        },
      })
    }
  }

  return getTallyConfig()
}

// ─── Export Generator ─────────────────────────────────────────

export interface GeneratedTallyExport {
  xml: string
  content: string
  contentType: string
  summary: TallyExportSummary
  filename: string
  gstr1Summary?: Gstr1ReportSummary
}

export async function generateTallyExport(
  query: TallyExportQuery,
  actor: AuthUser
): Promise<GeneratedTallyExport> {
  const config = await getTallyConfig()
  const branchScope = await resolveBranchScope(actor, query.branchId)
  const targetBranchId = branchScope ?? undefined

  const dateFilter: { gte?: Date; lte?: Date } = {}
  if (query.startDate) {
    dateFilter.gte = startOfDay(parseISO(query.startDate))
  }
  if (query.endDate) {
    dateFilter.lte = endOfDay(parseISO(query.endDate))
  }

  const dateSuffix = format(new Date(), 'yyyyMMdd_HHmm')
  const requestedFormat = query.format || 'csv'

  switch (query.type) {
    case 'sales': {
      const sales = await prisma.sale.findMany({
        where: {
          ...(targetBranchId ? { branchId: targetBranchId } : {}),
          ...(query.startDate || query.endDate ? { saleDate: dateFilter } : {}),
          status: { notIn: ['CANCELLED'] },
        },
        orderBy: { saleDate: 'asc' },
        include: {
          customer: {
            select: { id: true, name: true, gstin: true, state: true, phone: true, address: true },
          },
          payments: {
            select: { method: true, amount: true },
          },
          items: {
            include: {
              product: {
                select: { name: true, sku: true, hsnCode: true, unitOfMeasure: true },
              },
              itemBatches: {
                include: {
                  batch: {
                    select: { batchNumber: true, expiryDate: true },
                  },
                },
              },
            },
          },
        },
      })

      const totalAmount = sales.reduce((sum, s) => sum + Number(s.totalAmount), 0)
      const salesForTally = sales as unknown as SaleForTally[]

      if (requestedFormat === 'csv') {
        const csv = generateSalesRegisterCsv(salesForTally)
        return {
          xml: csv,
          content: csv,
          contentType: 'text/csv; charset=utf-8',
          filename: `sales_register_${dateSuffix}.csv`,
          summary: {
            exportType: 'sales',
            voucherCount: sales.length,
            totalAmount,
            dateRange: { startDate: query.startDate, endDate: query.endDate },
            generatedAt: new Date().toISOString(),
          },
        }
      }

      const xml = buildSalesVouchersXml(salesForTally, config)
      return {
        xml,
        content: xml,
        contentType: 'application/xml; charset=utf-8',
        filename: `tally_sales_${dateSuffix}.xml`,
        summary: {
          exportType: 'sales',
          voucherCount: sales.length,
          totalAmount,
          dateRange: { startDate: query.startDate, endDate: query.endDate },
          generatedAt: new Date().toISOString(),
        },
      }
    }

    case 'gstr1': {
      const sales = await prisma.sale.findMany({
        where: {
          ...(targetBranchId ? { branchId: targetBranchId } : {}),
          ...(query.startDate || query.endDate ? { saleDate: dateFilter } : {}),
          status: { notIn: ['CANCELLED'] },
        },
        orderBy: { saleDate: 'asc' },
        include: {
          customer: {
            select: { id: true, name: true, gstin: true, state: true, phone: true, address: true },
          },
          payments: {
            select: { method: true, amount: true },
          },
          items: {
            include: {
              product: {
                select: { name: true, sku: true, hsnCode: true, unitOfMeasure: true },
              },
              itemBatches: {
                include: {
                  batch: {
                    select: { batchNumber: true, expiryDate: true },
                  },
                },
              },
            },
          },
        },
      })

      const salesForTally = sales as unknown as SaleForTally[]
      const { summary: gstr1Summary } = processGstr1Data(salesForTally)
      const totalAmount = sales.reduce((sum, s) => sum + Number(s.totalAmount), 0)

      if (requestedFormat === 'json') {
        const jsonContent = generateGstr1Json(salesForTally)
        return {
          xml: jsonContent,
          content: jsonContent,
          contentType: 'application/json; charset=utf-8',
          filename: `gstr1_${dateSuffix}.json`,
          summary: {
            exportType: 'gstr1',
            voucherCount: sales.length,
            totalAmount,
            dateRange: { startDate: query.startDate, endDate: query.endDate },
            generatedAt: new Date().toISOString(),
          },
          gstr1Summary,
        }
      }

      const csvContent = generateGstr1Csv(salesForTally)
      return {
        xml: csvContent,
        content: csvContent,
        contentType: 'text/csv; charset=utf-8',
        filename: `gstr1_report_${dateSuffix}.csv`,
        summary: {
          exportType: 'gstr1',
          voucherCount: sales.length,
          totalAmount,
          dateRange: { startDate: query.startDate, endDate: query.endDate },
          generatedAt: new Date().toISOString(),
        },
        gstr1Summary,
      }
    }

    case 'purchases': {
      const purchases = await prisma.purchase.findMany({
        where: {
          ...(targetBranchId ? { branchId: targetBranchId } : {}),
          ...(query.startDate || query.endDate ? { purchaseDate: dateFilter } : {}),
          status: { notIn: ['CANCELLED'] },
        },
        orderBy: { purchaseDate: 'asc' },
        include: {
          supplier: {
            select: { id: true, name: true, gstin: true, state: true, phone: true, address: true },
          },
          items: {
            include: {
              product: {
                select: { name: true, sku: true, hsnCode: true, unitOfMeasure: true },
              },
            },
          },
        },
      })

      const xml = buildPurchaseVouchersXml(purchases as unknown as PurchaseForTally[], config)
      const totalAmount = purchases.reduce((sum, p) => sum + Number(p.totalAmount), 0)

      if (requestedFormat === 'csv') {
        const csv = generatePurchasesRegisterCsv(purchases)
        return {
          xml: csv,
          content: csv,
          contentType: 'text/csv; charset=utf-8',
          filename: `purchase_register_${dateSuffix}.csv`,
          summary: {
            exportType: 'purchases',
            voucherCount: purchases.length,
            totalAmount,
            dateRange: { startDate: query.startDate, endDate: query.endDate },
            generatedAt: new Date().toISOString(),
          },
        }
      }

      return {
        xml,
        content: xml,
        contentType: 'application/xml; charset=utf-8',
        filename: `tally_purchases_${dateSuffix}.xml`,
        summary: {
          exportType: 'purchases',
          voucherCount: purchases.length,
          totalAmount,
          dateRange: { startDate: query.startDate, endDate: query.endDate },
          generatedAt: new Date().toISOString(),
        },
      }
    }

    case 'customers': {
      const customers = await prisma.customer.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          gstin: true,
          address: true,
          city: true,
          state: true,
          pincode: true,
          creditLimit: true,
          outstandingBalance: true,
        },
      })

      const mapped: CustomerForTally[] = customers.map((c) => ({
        ...c,
        creditLimit: Number(c.creditLimit || 0),
        outstandingBalance: Number(c.outstandingBalance || 0),
      }))

      const xml = buildCustomerLedgersXml(mapped)

      if (requestedFormat === 'csv') {
        const csv = generateCustomersCsv(mapped)
        return {
          xml: csv,
          content: csv,
          contentType: 'text/csv; charset=utf-8',
          filename: `customers_${dateSuffix}.csv`,
          summary: {
            exportType: 'customers',
            voucherCount: customers.length,
            totalAmount: 0,
            dateRange: {},
            generatedAt: new Date().toISOString(),
          },
        }
      }

      return {
        xml,
        content: xml,
        contentType: 'application/xml; charset=utf-8',
        filename: `tally_customers_${dateSuffix}.xml`,
        summary: {
          exportType: 'customers',
          voucherCount: customers.length,
          totalAmount: 0,
          dateRange: {},
          generatedAt: new Date().toISOString(),
        },
      }
    }

    case 'suppliers': {
      const suppliers = await prisma.supplier.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          gstin: true,
          pan: true,
          dlNumber: true,
          address: true,
          city: true,
          state: true,
          pincode: true,
          bankName: true,
          bankAccount: true,
          bankIfsc: true,
          outstandingBalance: true,
        },
      })

      const mapped: SupplierForTally[] = suppliers.map((s) => ({
        ...s,
        outstandingBalance: Number(s.outstandingBalance || 0),
      }))

      const xml = buildSupplierLedgersXml(mapped)

      if (requestedFormat === 'csv') {
        const csv = generateSuppliersCsv(mapped)
        return {
          xml: csv,
          content: csv,
          contentType: 'text/csv; charset=utf-8',
          filename: `suppliers_${dateSuffix}.csv`,
          summary: {
            exportType: 'suppliers',
            voucherCount: suppliers.length,
            totalAmount: 0,
            dateRange: {},
            generatedAt: new Date().toISOString(),
          },
        }
      }

      return {
        xml,
        content: xml,
        contentType: 'application/xml; charset=utf-8',
        filename: `tally_suppliers_${dateSuffix}.xml`,
        summary: {
          exportType: 'suppliers',
          voucherCount: suppliers.length,
          totalAmount: 0,
          dateRange: {},
          generatedAt: new Date().toISOString(),
        },
      }
    }

    case 'stock_items': {
      const products = await prisma.product.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          sku: true,
          barcode: true,
          hsnCode: true,
          unitOfMeasure: true,
          mrp: true,
          gstRate: true,
          costPrice: true,
          inventory: {
            select: { totalQuantity: true },
          },
        },
      })

      const mapped: ProductForTally[] = products.map((p) => {
        const totalStock = p.inventory.reduce((acc, inv) => acc + inv.totalQuantity, 0)
        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          unit: p.unitOfMeasure || 'Strip',
          hsnCode: p.hsnCode ?? undefined,
          gstRate: Number(p.gstRate),
          mrp: Number(p.mrp),
          costPrice: p.costPrice ? Number(p.costPrice) : undefined,
          openingBalance: totalStock,
          openingValue: totalStock * Number(p.costPrice || p.mrp),
        }
      })

      const xml = buildStockItemsXml(mapped)

      if (requestedFormat === 'csv') {
        const csv = generateStockItemsCsv(mapped)
        return {
          xml: csv,
          content: csv,
          contentType: 'text/csv; charset=utf-8',
          filename: `stock_items_${dateSuffix}.csv`,
          summary: {
            exportType: 'stock_items',
            voucherCount: products.length,
            totalAmount: 0,
            dateRange: {},
            generatedAt: new Date().toISOString(),
          },
        }
      }

      return {
        xml,
        content: xml,
        contentType: 'application/xml; charset=utf-8',
        filename: `tally_stock_items_${dateSuffix}.xml`,
        summary: {
          exportType: 'stock_items',
          voucherCount: products.length,
          totalAmount: 0,
          dateRange: {},
          generatedAt: new Date().toISOString(),
        },
      }
    }

    case 'daybook': {
      const [sales, purchases] = await Promise.all([
        prisma.sale.findMany({
          where: {
            ...(targetBranchId ? { branchId: targetBranchId } : {}),
            ...(query.startDate || query.endDate ? { saleDate: dateFilter } : {}),
            status: { notIn: ['CANCELLED'] },
          },
          orderBy: { saleDate: 'asc' },
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                gstin: true,
                state: true,
                phone: true,
                address: true,
              },
            },
            payments: {
              select: { method: true, amount: true },
            },
            items: {
              include: {
                product: {
                  select: { name: true, sku: true, hsnCode: true, unitOfMeasure: true },
                },
                itemBatches: {
                  include: {
                    batch: {
                      select: { batchNumber: true, expiryDate: true },
                    },
                  },
                },
              },
            },
          },
        }),
        prisma.purchase.findMany({
          where: {
            ...(targetBranchId ? { branchId: targetBranchId } : {}),
            ...(query.startDate || query.endDate ? { purchaseDate: dateFilter } : {}),
            status: { notIn: ['CANCELLED'] },
          },
          orderBy: { purchaseDate: 'asc' },
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
                gstin: true,
                state: true,
                phone: true,
                address: true,
              },
            },
            items: {
              include: {
                product: {
                  select: { name: true, sku: true, hsnCode: true, unitOfMeasure: true },
                },
              },
            },
          },
        }),
      ])

      const xml = buildDayBookXml(
        sales as unknown as SaleForTally[],
        purchases as unknown as PurchaseForTally[],
        config
      )

      const totalSalesAmount = sales.reduce((sum, s) => sum + Number(s.totalAmount), 0)
      const totalPurchasesAmount = purchases.reduce((sum, p) => sum + Number(p.totalAmount), 0)

      if (requestedFormat === 'csv') {
        const csv = generateDaybookCsv(sales, purchases)
        return {
          xml: csv,
          content: csv,
          contentType: 'text/csv; charset=utf-8',
          filename: `daybook_${dateSuffix}.csv`,
          summary: {
            exportType: 'daybook',
            voucherCount: sales.length + purchases.length,
            totalAmount: totalSalesAmount + totalPurchasesAmount,
            dateRange: { startDate: query.startDate, endDate: query.endDate },
            generatedAt: new Date().toISOString(),
          },
        }
      }

      return {
        xml,
        content: xml,
        contentType: 'application/xml; charset=utf-8',
        filename: `tally_daybook_${dateSuffix}.xml`,
        summary: {
          exportType: 'daybook',
          voucherCount: sales.length + purchases.length,
          totalAmount: totalSalesAmount + totalPurchasesAmount,
          dateRange: { startDate: query.startDate, endDate: query.endDate },
          generatedAt: new Date().toISOString(),
        },
      }
    }

    case 'debit_notes': {
      const returns = await prisma.purchaseReturn.findMany({
        where: {
          ...(query.startDate || query.endDate ? { returnDate: dateFilter } : {}),
          status: { notIn: ['CANCELLED'] },
        },
        orderBy: { returnDate: 'asc' },
        include: {
          supplier: {
            select: { id: true, name: true, gstin: true, state: true, phone: true, address: true },
          },
          purchase: {
            select: { purchaseNumber: true, invoiceNumber: true },
          },
          items: true,
        },
      })

      const productIds = Array.from(new Set(returns.flatMap((r) => r.items.map((it) => it.productId))))
      const batchIds = Array.from(
        new Set(
          returns
            .flatMap((r) => r.items.map((it) => it.batchId))
            .filter((id): id is string => Boolean(id))
        )
      )

      const [products, batches] = await Promise.all([
        prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true, sku: true, hsnCode: true, unitOfMeasure: true },
        }),
        prisma.batch.findMany({
          where: { id: { in: batchIds } },
          select: { id: true, batchNumber: true, expiryDate: true, manufacturingDate: true },
        }),
      ])

      const productMap = new Map(products.map((p) => [p.id, p]))
      const batchMap = new Map(batches.map((b) => [b.id, b]))

      const totalAmount = returns.reduce((sum, r) => sum + Number(r.totalAmount), 0)

      const debitNotesForTally: DebitNoteForTally[] = returns.map((r) => {
        const subtotal = Number(r.totalAmount) * 0.88
        const taxAmount = Number(r.totalAmount) - subtotal
        const cgstAmount = taxAmount / 2
        const sgstAmount = taxAmount / 2

        return {
          id: r.id,
          returnNumber: r.returnNumber,
          invoiceNumber: r.purchase?.invoiceNumber || r.purchase?.purchaseNumber,
          returnDate: r.returnDate,
          reason: r.reason,
          subtotal,
          taxAmount,
          cgstAmount,
          sgstAmount,
          igstAmount: 0,
          totalAmount: Number(r.totalAmount),
          supplier: r.supplier,
          items: r.items.map((it) => {
            const product = productMap.get(it.productId) || {
              name: 'Unknown Item',
              sku: '',
              hsnCode: '',
              unitOfMeasure: 'Strip',
            }
            const batch = it.batchId ? batchMap.get(it.batchId) : undefined
            const exp = batch?.expiryDate
            const isExpired = exp ? new Date(exp).getTime() <= Date.now() : false

            return {
              id: it.id,
              quantity: it.quantity,
              unitCost: Number(it.unitCost),
              totalAmount: Number(it.totalAmount),
              product,
              batchNumber: batch?.batchNumber,
              expiryDate: batch?.expiryDate,
              manufacturingDate: batch?.manufacturingDate,
              isExpired,
            }
          }),
        }
      })

      const xml = buildDebitNotesXml(debitNotesForTally, config)

      if (requestedFormat === 'csv') {
        const csv = generateDebitNotesCsv(returns)
        return {
          xml: csv,
          content: csv,
          contentType: 'text/csv; charset=utf-8',
          filename: `debit_notes_${dateSuffix}.csv`,
          summary: {
            exportType: 'debit_notes',
            voucherCount: returns.length,
            totalAmount,
            dateRange: { startDate: query.startDate, endDate: query.endDate },
            generatedAt: new Date().toISOString(),
          },
        }
      }

      return {
        xml,
        content: xml,
        contentType: 'application/xml; charset=utf-8',
        filename: `tally_debit_notes_${dateSuffix}.xml`,
        summary: {
          exportType: 'debit_notes',
          voucherCount: returns.length,
          totalAmount,
          dateRange: { startDate: query.startDate, endDate: query.endDate },
          generatedAt: new Date().toISOString(),
        },
      }
    }

    case 'units': {
      const units = getPharmaUnitsForTally()
      const xml = buildUnitsXml(units)

      if (requestedFormat === 'csv') {
        const csv = generateUnitsCsv(units)
        return {
          xml: csv,
          content: csv,
          contentType: 'text/csv; charset=utf-8',
          filename: `units_${dateSuffix}.csv`,
          summary: {
            exportType: 'units',
            voucherCount: units.length,
            totalAmount: 0,
            dateRange: {},
            generatedAt: new Date().toISOString(),
          },
        }
      }

      return {
        xml,
        content: xml,
        contentType: 'application/xml; charset=utf-8',
        filename: `tally_units_${dateSuffix}.xml`,
        summary: {
          exportType: 'units',
          voucherCount: units.length,
          totalAmount: 0,
          dateRange: {},
          generatedAt: new Date().toISOString(),
        },
      }
    }

    case 'price_lists': {
      const products = await prisma.product.findMany({
        where: { isActive: true },
        select: {
          name: true,
          unitOfMeasure: true,
          mrp: true,
          ptr: true,
          costPrice: true,
        },
      })

      const rules = products.flatMap((p) => {
        const mrp = Number(p.mrp)
        const ptr = p.ptr ? Number(p.ptr) : Math.round(mrp * 0.85 * 100) / 100
        const cost = p.costPrice ? Number(p.costPrice) : Math.round(mrp * 0.70 * 100) / 100

        return [
          {
            productName: p.name,
            priceLevel: 'Retailer',
            rate: ptr,
            unitOfMeasure: p.unitOfMeasure || 'Strip',
          },
          {
            productName: p.name,
            priceLevel: 'Stockist',
            rate: cost,
            unitOfMeasure: p.unitOfMeasure || 'Strip',
          },
          {
            productName: p.name,
            priceLevel: 'Wholesaler',
            rate: Math.round(cost * 1.05 * 100) / 100,
            unitOfMeasure: p.unitOfMeasure || 'Strip',
          },
        ]
      })

      const xml = buildPriceListXml({
        effectiveDate: new Date(),
        rules,
      })

      if (requestedFormat === 'csv') {
        const csv = generatePriceListsCsv(rules)
        return {
          xml: csv,
          content: csv,
          contentType: 'text/csv; charset=utf-8',
          filename: `price_lists_${dateSuffix}.csv`,
          summary: {
            exportType: 'price_lists',
            voucherCount: rules.length,
            totalAmount: 0,
            dateRange: {},
            generatedAt: new Date().toISOString(),
          },
        }
      }

      return {
        xml,
        content: xml,
        contentType: 'application/xml; charset=utf-8',
        filename: `tally_price_lists_${dateSuffix}.xml`,
        summary: {
          exportType: 'price_lists',
          voucherCount: rules.length,
          totalAmount: 0,
          dateRange: {},
          generatedAt: new Date().toISOString(),
        },
      }
    }

    case 'company_setup': {
      const [org, branch] = await Promise.all([
        prisma.organization.findFirst(),
        prisma.branch.findFirst(),
      ])

      const companySetup: CompanySetupForTally = {
        companyName: org?.name || config.companyName,
        legalName: org?.legalName || org?.name,
        stateName: org?.state || branch?.state || '',
        gstin: org?.gstin || branch?.gstin || '',
        dlNumber: org?.dlNumber || branch?.dlNumber || '',
        address: org?.address || branch?.address,
        phone: org?.phone || branch?.phone,
        email: org?.email || branch?.email,
        registrationType: 'Regular',
        maintainBatchWise: true,
        trackExpiryDates: true,
        trackMfgDates: true,
        financialYearStart: new Date(new Date().getFullYear(), 3, 1),
      }

      const xml = buildCompanySetupXml(companySetup)

      if (requestedFormat === 'csv') {
        const csv = [
          'Setting,Value',
          `Company Name,"${companySetup.companyName}"`,
          `Legal Name,"${companySetup.legalName}"`,
          `State,"${companySetup.stateName}"`,
          `GSTIN,"${companySetup.gstin}"`,
          `Drug License,"${companySetup.dlNumber}"`,
          `Address,"${companySetup.address || ''}"`,
          `Phone,"${companySetup.phone || ''}"`,
          `Email,"${companySetup.email || ''}"`,
          `Registration Type,"${companySetup.registrationType}"`,
          `Maintain Batch-Wise,"${companySetup.maintainBatchWise}"`,
          `Track Expiry Dates,"${companySetup.trackExpiryDates}"`,
          `Track Mfg Dates,"${companySetup.trackMfgDates}"`,
        ].join('\r\n')
        return {
          xml: csv,
          content: csv,
          contentType: 'text/csv; charset=utf-8',
          filename: `company_setup_${dateSuffix}.csv`,
          summary: {
            exportType: 'company_setup',
            voucherCount: 1,
            totalAmount: 0,
            dateRange: {},
            generatedAt: new Date().toISOString(),
          },
        }
      }

      return {
        xml,
        content: xml,
        contentType: 'application/xml; charset=utf-8',
        filename: `tally_company_setup_${dateSuffix}.xml`,
        summary: {
          exportType: 'company_setup',
          voucherCount: 1,
          totalAmount: 0,
          dateRange: {},
          generatedAt: new Date().toISOString(),
        },
      }
    }

    case 'batch_summary': {
      const items = await getBatchWiseStockSummary(targetBranchId)
      const totalAmount = items.reduce((sum, b) => sum + b.quantity * b.purchasePrice, 0)

      if (requestedFormat === 'csv') {
        const header =
          'Batch Number,Product Name,SKU,Unit,Mfg Date,Expiry Date,Stock Qty,Available,Purchase Rate,MRP,Status,Days to Expiry\n'
        const rows = items
          .map((b) =>
            [
              `"${b.batchNumber}"`,
              `"${b.productName.replace(/"/g, '""')}"`,
              `"${b.sku || ''}"`,
              `"${b.unitOfMeasure || 'Strip'}"`,
              `"${b.manufacturingDate ? format(new Date(b.manufacturingDate), 'dd-MMM-yyyy') : '-'}"`,
              `"${format(new Date(b.expiryDate), 'dd-MMM-yyyy')}"`,
              b.quantity,
              b.availableQuantity,
              b.purchasePrice.toFixed(2),
              b.mrp.toFixed(2),
              b.status,
              b.daysToExpiry,
            ].join(',')
          )
          .join('\n')

        const csv = header + rows
        return {
          xml: csv,
          content: csv,
          contentType: 'text/csv; charset=utf-8',
          filename: `batch_summary_${dateSuffix}.csv`,
          summary: {
            exportType: 'batch_summary',
            voucherCount: items.length,
            totalAmount,
            dateRange: {},
            generatedAt: new Date().toISOString(),
          },
        }
      }

      const xmlItems = items
        .map(
          (b) => `      <BATCHITEM>
        <BATCHNAME>${b.batchNumber}</BATCHNAME>
        <STOCKITEMNAME>${b.productName}</STOCKITEMNAME>
        <EXPIRYDATE>${format(new Date(b.expiryDate), 'yyyyMMdd')}</EXPIRYDATE>
        ${b.manufacturingDate ? `<MFGDATE>${format(new Date(b.manufacturingDate), 'yyyyMMdd')}</MFGDATE>` : ''}
        <QUANTITY>${b.quantity}</QUANTITY>
        <AVAILABLE>${b.availableQuantity}</AVAILABLE>
        <RATE>${b.purchasePrice.toFixed(2)}</RATE>
        <STATUS>${b.status}</STATUS>
      </BATCHITEM>`
        )
        .join('\n')

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Report</TALLYREQUEST>
    <REPORTNAME>Batch-Wise Stock Summary</REPORTNAME>
  </HEADER>
  <BODY>
    <DATA>
${xmlItems}
    </DATA>
  </BODY>
</ENVELOPE>`

      return {
        xml,
        content: xml,
        contentType: 'application/xml; charset=utf-8',
        filename: `batch_summary_${dateSuffix}.xml`,
        summary: {
          exportType: 'batch_summary',
          voucherCount: items.length,
          totalAmount,
          dateRange: {},
          generatedAt: new Date().toISOString(),
        },
      }
    }
  }
}

// ─── Batch-Wise Stock Summary (Gateway of Tally > Batch) ──────

export async function getBatchWiseStockSummary(
  branchId?: string,
  _actor?: AuthUser
): Promise<BatchSummaryItem[]> {
  const batches = await prisma.batch.findMany({
    where: {
      ...(branchId ? { branchId } : {}),
    },
    orderBy: [{ expiryDate: 'asc' }, { batchNumber: 'asc' }],
    include: {
      product: {
        select: {
          id: true,
          name: true,
          genericName: true,
          sku: true,
          unitOfMeasure: true,
          hsnCode: true,
        },
      },
    },
  })

  const now = Date.now()
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000

  return batches.map((b) => {
    const expTime = b.expiryDate.getTime()
    const daysToExpiry = Math.ceil((expTime - now) / (1000 * 60 * 60 * 24))
    const isExpired = daysToExpiry <= 0
    const isNearExpiry = daysToExpiry > 0 && expTime - now <= ninetyDaysMs
    const avail = b.quantity - b.reservedQuantity - b.soldQuantity

    return {
      id: b.id,
      productId: b.productId,
      productName: b.product.name,
      genericName: b.product.genericName,
      sku: b.product.sku,
      unitOfMeasure: b.product.unitOfMeasure,
      hsnCode: b.product.hsnCode,
      batchNumber: b.batchNumber,
      manufacturingDate: b.manufacturingDate,
      expiryDate: b.expiryDate,
      quantity: b.quantity,
      availableQuantity: Math.max(0, avail),
      mrp: Number(b.mrp),
      purchasePrice: Number(b.purchasePrice),
      status: isExpired && b.status === 'ACTIVE' ? 'EXPIRED' : b.status,
      daysToExpiry,
      isExpired,
      isNearExpiry,
    }
  })
}
