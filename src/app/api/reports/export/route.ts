import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { prisma } from '@/lib/db/prisma'
import { resolveBranchScope } from '@/lib/inventory/branch-access'
import {
  generateExcelWorkbook,
  type ExcelSheetConfig,
  type ExcelWorkbookConfig,
} from '@/lib/reports/excel-export-service'
import { parseReportPeriod, parseDaysThreshold } from '@/lib/reports/report-params'
import { ReportService } from '@/lib/reports/report-service'

export const dynamic = 'force-dynamic'

function errStatus(msg: string) {
  if (msg === 'Unauthorized') return 401
  if (msg.startsWith('Forbidden') || msg.includes('lacks permission') || msg.includes('Must specify a branch')) return 403
  if (msg.startsWith('Not Found')) return 404
  if (msg.startsWith('Validation')) return 400
  return 500
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const query = Object.fromEntries(searchParams)
    const reportType = (query.reportType || 'sales').toLowerCase()

    // Determine required permission based on requested report type
    let user
    try {
      user = await requirePermission(PERMISSIONS.REPORTS_EXPORT)
    } catch {
      if (['stock', 'inventory', 'expiry', 'consumption'].includes(reportType)) {
        user = await requirePermission(PERMISSIONS.REPORTS_INVENTORY)
      } else if (['purchases', 'supplier'].includes(reportType)) {
        user = await requirePermission(PERMISSIONS.REPORTS_PURCHASES)
      } else {
        user = await requirePermission(PERMISSIONS.REPORTS_SALES)
      }
    }

    // Resolve branch scope to ensure users only see authorized branch data
    const branchId = await resolveBranchScope(user, query.branchId)
    if (!branchId && reportType !== 'doctors') {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Must specify a branch or lack permissions' },
        },
        { status: 403 }
      )
    }

    const { period, startDate, endDate, label } = parseReportPeriod(query)
    const dateStamp = startDate.toISOString().split('T')[0]

    let sheets: ExcelSheetConfig[] = []
    const baseFilename = `${reportType}_report_${period}_${dateStamp}`

    // ─────────────────────────────────────────────────────────────
    // 1. Sales & Financials Report (Multi-Sheet: Executive Summary + Detailed Ledger)
    // ─────────────────────────────────────────────────────────────
    if (reportType === 'sales' || reportType === 'detailed-sales') {
      const financials = await ReportService.getSalesFinancials(branchId!, startDate, endDate)

      // Sheet 1: Executive Summary
      const summarySheet: ExcelSheetConfig = {
        sheetName: 'Executive Summary',
        title: `Sales Financial Performance — ${label}`,
        subtitle: `Date Range: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
        metadata: {
          Period: period.toUpperCase(),
          'Total Revenue': `₹${financials.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          'Completed Invoices': financials.totalSalesCount,
          'Average Order Value': `₹${financials.averageOrderValue.toFixed(2)}`,
          'Total Tax Collected': `₹${financials.totalTax.toFixed(2)}`,
          'Total Discounts': `₹${financials.totalDiscount.toFixed(2)}`,
          'Generated On': new Date().toLocaleString(),
        },
        headers: [
          'Business Date',
          'Completed Orders',
          'Gross Revenue (₹)',
          'Tax Amount (₹)',
          'Discount (₹)',
          'Average Bill Value (₹)',
        ],
        data: financials.dailyBreakdown.map((d) => [
          d.date,
          d.salesCount,
          d.revenue,
          d.tax,
          d.discount,
          d.averageBillValue || 0,
        ]),
        summaryRow: [
          'Total / Average',
          financials.totalSalesCount,
          financials.totalRevenue,
          financials.totalTax,
          financials.totalDiscount,
          financials.averageOrderValue,
        ],
      }

      // Sheet 2: Detailed Sales Ledger
      const salesWhere: any = {
        createdAt: { gte: startDate, lte: endDate },
      }
      if (branchId) salesWhere.branchId = branchId
      if (query.status && query.status !== 'ALL') salesWhere.status = query.status

      let detailedSales: any[] = []
      try {
        detailedSales = await prisma.sale.findMany({
          where: salesWhere,
          orderBy: { createdAt: 'desc' },
          take: 1000,
          include: {
            customer: { select: { name: true, phone: true } },
            prescription: { select: { doctorName: true, doctorRegNumber: true } },
            items: { select: { quantity: true, unitPrice: true, totalAmount: true } },
          },
        })
      } catch {
        detailedSales = []
      }

      let ledgerTotalRevenue = 0
      let ledgerTotalTax = 0
      let ledgerTotalDiscount = 0
      let ledgerTotalItems = 0

      const ledgerData = detailedSales.map((s) => {
        const rev = Number(s.totalAmount) || 0
        const tax = Number(s.taxAmount) || 0
        const disc = Number(s.discountAmount) || 0
        const itemsCount = s.items ? s.items.reduce((acc: number, it: any) => acc + (it.quantity || 1), 0) : 0

        ledgerTotalRevenue += rev
        ledgerTotalTax += tax
        ledgerTotalDiscount += disc
        ledgerTotalItems += itemsCount

        return [
          s.invoiceNumber || s.id,
          s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '',
          s.customer?.name || 'Walk-in Customer',
          s.doctorName || s.prescription?.doctorName || 'General',
          s.paymentMethod || 'CASH',
          itemsCount,
          Number(s.subtotal) || rev - tax + disc,
          disc,
          tax,
          rev,
          s.status || 'COMPLETED',
        ]
      })

      const ledgerSheet: ExcelSheetConfig = {
        sheetName: 'Detailed Ledger',
        title: `Detailed Sales Transaction Register — ${label}`,
        subtitle: `Audited sales transactions recorded between ${startDate.toLocaleDateString()} and ${endDate.toLocaleDateString()}`,
        headers: [
          'Invoice Number',
          'Date',
          'Customer Name',
          'Doctor / Prescriber',
          'Payment Mode',
          'Items Count',
          'Subtotal (₹)',
          'Discount (₹)',
          'Tax (₹)',
          'Total Amount (₹)',
          'Status',
        ],
        data: ledgerData,
        summaryRow: [
          'Total / Summary',
          '',
          '',
          '',
          '',
          ledgerTotalItems,
          Math.round((ledgerTotalRevenue - ledgerTotalTax + ledgerTotalDiscount) * 100) / 100,
          Math.round(ledgerTotalDiscount * 100) / 100,
          Math.round(ledgerTotalTax * 100) / 100,
          Math.round(ledgerTotalRevenue * 100) / 100,
          `${detailedSales.length} Invoices`,
        ],
      }

      sheets = [summarySheet, ledgerSheet]
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Stock / Inventory Position Report
    // ─────────────────────────────────────────────────────────────
    else if (reportType === 'stock' || reportType === 'inventory') {
      const stock = await ReportService.getDailyStockPosition(branchId!)
      let totalQty = 0
      let totalValuation = 0

      const data = stock.data.map((row: any) => {
        const qty = Number(row.availableQuantity) || 0
        const val = Number(row.stockValueAtCost || row.stockValue) || 0
        totalQty += qty
        totalValuation += val
        return [
          row.productName || row.name,
          row.sku || row.productSku || '',
          row.category || 'General',
          qty,
          Number(row.mrp) || 0,
          Number(row.purchasePrice || row.costPrice) || 0,
          val,
          row.reorderLevel || 10,
          row.isLowStock ? 'LOW STOCK' : 'OPTIMAL',
        ]
      })

      sheets = [
        {
          sheetName: 'Stock Position',
          title: 'Daily Stock & Inventory Valuation Register',
          subtitle: `Current as of ${new Date().toLocaleDateString()}`,
          metadata: {
            'Total Active SKUs': stock.total,
            'Total Available Quantity': totalQty,
            'Valuation at Cost': `₹${totalValuation.toFixed(2)}`,
          },
          headers: [
            'Product Name',
            'SKU',
            'Category',
            'Available Qty',
            'MRP (₹)',
            'Cost Price (₹)',
            'Stock Valuation (₹)',
            'Reorder Level',
            'Stock Status',
          ],
          data,
          summaryRow: ['Total / Summary', '', '', totalQty, '', '', totalValuation, '', `${stock.total} SKUs`],
        },
      ]
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Near-Expiry & Expired Stock Report
    // ─────────────────────────────────────────────────────────────
    else if (reportType === 'expiry') {
      const daysThreshold = parseDaysThreshold(query.daysThreshold)
      const expiry = await ReportService.getNearExpiry(branchId!, daysThreshold)

      let totalVal = 0
      let totalUnits = 0

      const data = expiry.data.map((row: any) => {
        const qty = Number(row.availableQuantity) || 0
        const val = Number(row.stockValue) || 0
        totalUnits += qty
        totalVal += val
        return [
          row.productName,
          row.sku,
          row.batchNumber,
          row.expiryDate ? new Date(row.expiryDate).toLocaleDateString() : '',
          row.daysUntilExpiry,
          qty,
          Number(row.mrp) || 0,
          val,
          row.daysUntilExpiry <= 0 ? 'EXPIRED' : 'EXPIRING SOON',
        ]
      })

      sheets = [
        {
          sheetName: 'Near-Expiry Batches',
          title: `Near-Expiry & Expired Stock Register (Threshold: ${daysThreshold} Days)`,
          headers: [
            'Medicine Name',
            'SKU',
            'Batch Number',
            'Expiry Date',
            'Days Left',
            'Available Units',
            'Unit MRP (₹)',
            'Risk Value (₹)',
            'Status',
          ],
          data,
          summaryRow: ['Total Risk / Units', '', '', '', '', totalUnits, '', totalVal, `${expiry.total} Batches`],
        },
      ]
    }

    // ─────────────────────────────────────────────────────────────
    // 4. Consumption Report
    // ─────────────────────────────────────────────────────────────
    else if (reportType === 'consumption') {
      const consumption = await ReportService.getConsumptionReport(branchId!, startDate, endDate)
      let totalConsumed = 0
      let totalSales = 0

      const data = consumption.data.map((row: any) => {
        const cons = Number(row.totalConsumed) || 0
        const sls = Number(row.salesConsumed) || 0
        totalConsumed += cons
        totalSales += sls
        return [
          row.productName,
          row.sku,
          sls,
          Number(row.otherConsumed) || 0,
          cons,
        ]
      })

      sheets = [
        {
          sheetName: 'Consumption Register',
          title: `Product Consumption Register — ${label}`,
          headers: [
            'Medicine Name',
            'SKU',
            'Dispensed via Sales',
            'Adjustments / Internal',
            'Total Consumed Units',
          ],
          data,
          summaryRow: ['Total / Summary', '', totalSales, totalConsumed - totalSales, totalConsumed],
        },
      ]
    }

    // ─────────────────────────────────────────────────────────────
    // 5. Supplier Performance Report
    // ─────────────────────────────────────────────────────────────
    else if (reportType === 'supplier') {
      const supplier = await ReportService.getSupplierPerformance(branchId!, startDate, endDate)
      let totalSpend = 0
      let totalOrders = 0

      const data = supplier.data.map((row: any) => {
        const spend = Number(row.totalSpend) || 0
        const ords = Number(row.totalOrders) || 0
        totalSpend += spend
        totalOrders += ords
        return [
          row.supplierName,
          row.gstin || '—',
          ords,
          Number(row.fulfilledOrders) || 0,
          `${Number(row.fulfillmentRate || 0).toFixed(1)}%`,
          spend,
          Number(row.outstandingBalance || 0),
        ]
      })

      sheets = [
        {
          sheetName: 'Supplier Performance',
          title: `Supplier Procurement & Fulfillment Register — ${label}`,
          headers: [
            'Supplier Name',
            'GSTIN',
            'Total Orders',
            'Fulfilled Orders',
            'Fulfillment Rate',
            'Total Spend (₹)',
            'Outstanding (₹)',
          ],
          data,
          summaryRow: ['Total / Summary', '', totalOrders, '', '', totalSpend, ''],
        },
      ]
    }

    // ─────────────────────────────────────────────────────────────
    // 6. Schedule H & H1 Register (Regulatory Compliance)
    // ─────────────────────────────────────────────────────────────
    else if (reportType === 'schedule-h' || reportType === 'compliance') {
      const scheduleH = await ReportService.getScheduleHRegister(branchId!, {
        scheduleType: (query.schedule || 'ALL') as any,
        startDate,
        endDate,
      })

      let totalQty = 0
      let totalRevenue = 0

      const data = scheduleH.data.map((row: any) => {
        const qty = Number(row.quantity) || 0
        const rev = Number(row.totalAmount) || 0
        totalQty += qty
        totalRevenue += rev
        return [
          row.date ? new Date(row.date).toLocaleDateString() : '',
          row.invoiceNumber,
          row.patientName,
          row.patientPhone || '—',
          row.doctorName,
          row.doctorRegNumber || '—',
          row.productName,
          row.composition || '—',
          row.schedule,
          row.batchNumber,
          row.expiryDate ? new Date(row.expiryDate).toLocaleDateString() : '—',
          qty,
          rev,
        ]
      })

      sheets = [
        {
          sheetName: 'Schedule H Register',
          title: `Drug Inspector Statutory Register (Schedule H & H1 Drugs) — ${label}`,
          subtitle: 'Mandatory statutory audit register logging doctor reg. no, batch, and dispensing details.',
          headers: [
            'Date',
            'Invoice #',
            'Patient Name',
            'Patient Phone',
            'Doctor Name',
            'Doctor Reg #',
            'Medicine Name',
            'Composition',
            'Schedule',
            'Batch Number',
            'Expiry Date',
            'Quantity',
            'Total Amount (₹)',
          ],
          data,
          summaryRow: ['Total Dispensed', '', '', '', '', '', '', '', '', '', '', totalQty, totalRevenue],
        },
      ]
    }

    // ─────────────────────────────────────────────────────────────
    // 7. Gross Profit Analytics Report
    // ─────────────────────────────────────────────────────────────
    else if (reportType === 'gross-profit') {
      const profit = await ReportService.getGrossProfitReport(branchId!, {
        startDate,
        endDate,
      })

      const data = profit.items.map((row: any) => [
        row.productName,
        row.category || 'General',
        Number(row.quantity) || 0,
        Number(row.saleRevenue) || 0,
        Number(row.purchaseCost) || 0,
        Number(row.grossProfit) || 0,
        `${Number(row.profitMargin || 0).toFixed(2)}%`,
      ])

      sheets = [
        {
          sheetName: 'Gross Profit Breakdown',
          title: `Gross Profit & Margin Analytics — ${label}`,
          metadata: {
            'Total Revenue': `₹${profit.summary.totalRevenue.toLocaleString('en-IN')}`,
            'Cost of Goods Sold (COGS)': `₹${profit.summary.totalCogs.toLocaleString('en-IN')}`,
            'Total Gross Profit': `₹${profit.summary.grossProfit.toLocaleString('en-IN')}`,
            'Profit Margin': `${profit.summary.profitMarginPercent}%`,
          },
          headers: [
            'Medicine Name',
            'Category',
            'Units Sold',
            'Revenue (₹)',
            'Batch Cost (₹)',
            'Gross Profit (₹)',
            'Profit Margin',
          ],
          data,
          summaryRow: [
            'Total / Summary',
            '',
            profit.items.reduce((acc, it) => acc + (it.quantity || 0), 0),
            profit.summary.totalRevenue,
            profit.summary.totalCogs,
            profit.summary.grossProfit,
            `${profit.summary.profitMarginPercent}%`,
          ],
        },
      ]
    }

    // ─────────────────────────────────────────────────────────────
    // 8. Doctor Performance & Referrals Report
    // ─────────────────────────────────────────────────────────────
    else if (reportType === 'doctors') {
      const doctors = await ReportService.getDoctorPerformanceReport(query.search)
      let totalSales = 0
      let totalComm = 0

      const data = doctors.map((row: any) => {
        const sRev = Number(row.totalSalesRevenue) || 0
        const comm = Number(row.totalCommission) || 0
        totalSales += sRev
        totalComm += comm
        return [
          row.name,
          row.regNumber || '—',
          row.qualification || '—',
          row.clinicName || '—',
          row.phone || '—',
          Number(row.prescriptionsCount) || 0,
          Number(row.salesCount) || 0,
          sRev,
          comm,
          Number(row.paidCommission) || 0,
          Number(row.pendingCommission) || 0,
        ]
      })

      sheets = [
        {
          sheetName: 'Doctor Referrals',
          title: 'Doctor Referral & Commission Register',
          headers: [
            'Doctor Name',
            'Registration No',
            'Qualification',
            'Clinic / Hospital',
            'Phone',
            'Prescriptions Count',
            'Sales Count',
            'Referred Revenue (₹)',
            'Total Commission (₹)',
            'Paid Commission (₹)',
            'Pending (₹)',
          ],
          data,
          summaryRow: ['Total / Summary', '', '', '', '', '', '', totalSales, totalComm, '', ''],
        },
      ]
    }

    // Fallback: Default to empty workbook if unrecognized
    if (sheets.length === 0) {
      sheets = [
        {
          sheetName: 'Report',
          title: `Pharmacy Management Report — ${reportType}`,
          headers: ['Message'],
          data: [['No records found for the selected criteria.']],
        },
      ]
    }

    const workbookConfig: ExcelWorkbookConfig = {
      filename: `${baseFilename}.xlsx`,
      organizationName: 'Metapharsic Pharmacy',
      sheets,
    }

    const excelBuffer = generateExcelWorkbook(workbookConfig)

    return new NextResponse(new Uint8Array(excelBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${baseFilename}.xlsx"`,
        'Content-Length': excelBuffer.length.toString(),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = errStatus(message)
    const code = status === 400 ? 'VALIDATION' : 'ERROR'
    return NextResponse.json({ success: false, error: { code, message } }, { status })
  }
}
