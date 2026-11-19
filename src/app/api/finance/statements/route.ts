import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth/auth-helpers'
import { getTerritory, TerritoryCode } from '@/lib/territory/territory-config'

function checkAdminRole(user: { roles?: string[]; isSuperAdmin?: boolean }) {
  if (user.isSuperAdmin) return true
  const roles = user.roles?.map((r) => r.toLowerCase()) || []
  return roles.includes('admin') || roles.includes('owner') || roles.includes('manager')
}

const statementQuerySchema = z.object({
  type: z.enum(['CUSTOMER_ACCOUNT', 'STATUTORY_TAX_VAT', 'CASH_DRAWER_SHIFT']),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  customerId: z.string().optional(),
  branchId: z.string().optional(),
})

// GET /api/finance/statements — Admin Statutory Statement Generator
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()

    if (!checkAdminRole(user)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Generating statutory statements is restricted to Store Administrators.',
          },
        },
        { status: 403 }
      )
    }

    const orgId = user.organizationId
    if (!orgId) {
      return NextResponse.json(
        { success: false, error: { message: 'Organization not found' } },
        { status: 404 }
      )
    }

    const url = new URL(req.url)
    const type = url.searchParams.get('type') || 'STATUTORY_TAX_VAT'
    const startDateParam = url.searchParams.get('startDate')
    const endDateParam = url.searchParams.get('endDate')
    const customerId = url.searchParams.get('customerId') || undefined
    const branchId = url.searchParams.get('branchId') || user.branchId || undefined

    const startDate = startDateParam ? new Date(startDateParam) : new Date(Date.now() - 30 * 24 * 3600 * 1000)
    startDate.setHours(0, 0, 0, 0)
    const endDate = endDateParam ? new Date(endDateParam) : new Date()
    endDate.setHours(23, 59, 59, 999)

    // Fetch Organization details to resolve country and statutory tax regime
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        legalName: true,
        country: true,
        currency: true,
        gstin: true,
        dlNumber: true,
        city: true,
        state: true,
        address: true,
      },
    })

    if (!org) {
      return NextResponse.json(
        { success: false, error: { message: 'Organization not found' } },
        { status: 404 }
      )
    }

    // Resolve territory rule
    const countryLower = org.country?.toLowerCase() || ''
    const currencyUpper = org.currency?.toUpperCase() || ''
    let territoryCode: TerritoryCode = 'SA'
    if (currencyUpper === 'OMR' || countryLower.includes('oman')) territoryCode = 'OM'
    else if (currencyUpper === 'SAR' || countryLower.includes('saudi')) territoryCode = 'SA'
    else if (currencyUpper === 'BHD' || countryLower.includes('bahrain')) territoryCode = 'BH'
    else if (currencyUpper === 'QAR' || countryLower.includes('qatar')) territoryCode = 'QA'
    else if (currencyUpper === 'MVR' || countryLower.includes('maldives')) territoryCode = 'MV'
    else if (currencyUpper === 'INR' || countryLower.includes('india')) territoryCode = 'IN'

    const territory = getTerritory(territoryCode)

    // ─────────────────────────────────────────────────────────────
    // TYPE 1: STATUTORY TAX & VAT STATEMENT (Country Rules)
    // ─────────────────────────────────────────────────────────────
    if (type === 'STATUTORY_TAX_VAT') {
      const sales = await prisma.sale.findMany({
        where: {
          branch: { organizationId: orgId },
          createdAt: { gte: startDate, lte: endDate },
          status: 'COMPLETED',
          ...(branchId ? { branchId } : {}),
        },
        include: {
          items: true,
          payments: true,
          customer: { select: { name: true, phone: true } },
          branch: { select: { name: true, code: true } },
        },
        orderBy: { createdAt: 'asc' },
      })

      let totalGrossSales = 0
      let totalDiscount = 0
      let totalTaxCollected = 0
      let totalNetPayable = 0
      let totalCashTendered = 0
      let totalCardElectronic = 0

      const rows = sales.map((s) => {
        const gross = Number(s.subtotal)
        const disc = Number(s.discountAmount)
        const tax = Number(s.taxAmount)
        const net = Number(s.totalAmount)

        totalGrossSales += gross
        totalDiscount += disc
        totalTaxCollected += tax
        totalNetPayable += net

        const cashPay = s.payments.filter((p) => p.method === 'CASH').reduce((acc, p) => acc + Number(p.amount), 0)
        const elecPay = s.payments.filter((p) => p.method !== 'CASH').reduce((acc, p) => acc + Number(p.amount), 0)
        totalCashTendered += cashPay
        totalCardElectronic += elecPay

        return {
          id: s.id,
          invoiceNumber: s.invoiceNumber,
          date: s.createdAt.toISOString(),
          customerName: s.customer?.name || 'Walk-in Patient',
          grossAmount: gross,
          discountAmount: disc,
          taxAmount: tax,
          netAmount: net,
          taxRatePercent: territory.tax.standardVatRate,
          paymentMethod: s.payments[0]?.method || 'CASH',
        }
      })

      return NextResponse.json({
        success: true,
        statementType: 'STATUTORY_TAX_VAT',
        generatedAt: new Date().toISOString(),
        generatedBy: user.name,
        organization: org,
        territory: {
          code: territory.code,
          countryNameEn: territory.nameEn,
          countryNameAr: territory.nameAr,
          currency: territory.currency.code,
          taxName: territory.tax.taxAuthorityNameEn,
          standardRate: territory.tax.standardVatRate,
          vatIdLabel: territory.tax.vatIdLabelEn,
          vatNumber: org.gstin || 'OM-VAT-11002233',
        },
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        summary: {
          invoicesCount: sales.length,
          totalGrossSales,
          totalDiscount,
          totalTaxCollected,
          totalNetPayable,
          totalCashTendered,
          totalCardElectronic,
        },
        rows,
      })
    }

    // ─────────────────────────────────────────────────────────────
    // TYPE 2: CUSTOMER / PATIENT ACCOUNT STATEMENT (Khata Ledger)
    // ─────────────────────────────────────────────────────────────
    if (type === 'CUSTOMER_ACCOUNT') {
      const customer = customerId
        ? await prisma.customer.findUnique({
            where: { id: customerId },
            include: {
              sales: {
                where: {
                  createdAt: { gte: startDate, lte: endDate },
                  status: 'COMPLETED',
                },
                include: { payments: true },
                orderBy: { createdAt: 'asc' },
              },
            },
          })
        : null

      if (!customer) {
        return NextResponse.json(
          { success: false, error: { message: 'Customer not specified or not found' } },
          { status: 400 }
        )
      }

      let runningBalance = Number(customer.outstandingBalance) || 0
      const ledgerEntries = customer.sales.map((sale) => {
        const billTotal = Number(sale.totalAmount)
        const amountPaid = Number(sale.amountPaid)
        const debit = billTotal
        const credit = amountPaid

        return {
          id: sale.id,
          date: sale.createdAt.toISOString(),
          invoiceNumber: sale.invoiceNumber,
          description: `Dispensary Medication Invoice #${sale.invoiceNumber}`,
          debit,
          credit,
          balance: runningBalance,
        }
      })

      return NextResponse.json({
        success: true,
        statementType: 'CUSTOMER_ACCOUNT',
        generatedAt: new Date().toISOString(),
        generatedBy: user.name,
        organization: org,
        customer: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          currentBalance: Number(customer.outstandingBalance),
          creditLimit: customer.creditLimit ? Number(customer.creditLimit) : null,
        },
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        entries: ledgerEntries,
      })
    }

    // ─────────────────────────────────────────────────────────────
    // TYPE 3: CASH DRAWER SHIFT & RECONCILIATION STATEMENT
    // ─────────────────────────────────────────────────────────────
    if (type === 'CASH_DRAWER_SHIFT') {
      const drawerEvents = await prisma.cashDrawerEvent.findMany({
        where: {
          organizationId: orgId,
          createdAt: { gte: startDate, lte: endDate },
          ...(branchId ? { branchId } : {}),
        },
        include: {
          user: { select: { name: true } },
          branch: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
      })

      const totalOpens = drawerEvents.length
      const autoCashOpens = drawerEvents.filter((e) => e.eventType === 'AUTO_CASH_COLLECTED').length
      const manualOpens = drawerEvents.filter((e) => e.eventType === 'MANUAL_ADMIN_OPEN').length
      const totalCashLogged = drawerEvents.reduce((acc, e) => acc + Number(e.cashAmount), 0)

      return NextResponse.json({
        success: true,
        statementType: 'CASH_DRAWER_SHIFT',
        generatedAt: new Date().toISOString(),
        generatedBy: user.name,
        organization: org,
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        summary: {
          totalOpens,
          autoCashOpens,
          manualOpens,
          totalCashLogged,
        },
        events: drawerEvents.map((e) => ({
          id: e.id,
          date: e.openedAt.toISOString(),
          eventType: e.eventType,
          invoiceNumber: e.invoiceNumber,
          cashAmount: Number(e.cashAmount),
          userName: e.user.name,
          notes: e.notes,
        })),
      })
    }

    return NextResponse.json(
      { success: false, error: { message: `Unknown statement type: ${type}` } },
      { status: 400 }
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ success: false, error: { message: msg } }, { status: 500 })
  }
}
