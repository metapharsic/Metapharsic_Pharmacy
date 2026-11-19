import type { Metadata } from 'next'

import type { SalesRow } from '@/components/sales/sales-table'
import { SalesView } from '@/components/sales/sales-view'
import { can, getSession } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { resolveBranchScope } from '@/lib/inventory/branch-access'
import { listSales } from '@/lib/sales/sales-service'

export const metadata: Metadata = { title: 'Sales History — PharmaCare' }

export default async function SalesHistoryPage() {
  const [canRead, session] = await Promise.all([can(PERMISSIONS.SALES_READ), getSession()])

  if (!canRead || !session?.user) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales History</h1>
          <p className="text-muted-foreground">View all completed sales and invoices</p>
        </div>
        <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-muted">
          <p className="text-muted-foreground">You do not have permission to view sales.</p>
        </div>
      </div>
    )
  }

  const userRoles = session.user.roles ?? []
  const isAdmin = userRoles.some((r: string) =>
    ['owner', 'admin', 'super_admin'].includes(r.toLowerCase())
  )

  const scope = await resolveBranchScope(session.user)
  const firstPage = await listSales(
    { page: 1, limit: 20 },
    scope
  )

  const rawRows: SalesRow[] = firstPage.data.map((s) => ({
    id: s.id,
    invoiceNumber: s.invoiceNumber,
    saleDate: (s.saleDate instanceof Date ? s.saleDate.toISOString() : String(s.saleDate)),
    status: s.status,
    paymentStatus: s.paymentStatus,
    totalAmount: s.totalAmount.toString(),
    amountPaid: s.amountPaid.toString(),
    balanceDue: s.balanceDue.toString(),
    purchaseCost: isAdmin ? s.purchaseCost : undefined,
    profitAmount: isAdmin ? s.profitAmount : undefined,
    profitPct: isAdmin ? s.profitPct : undefined,
    purchaseCostComplete: isAdmin ? s.purchaseCostComplete : undefined,
    purchaseUnpricedUnits: isAdmin ? s.purchaseUnpricedUnits : undefined,
    customer: s.customer
      ? { id: s.customer.id, name: s.customer.name, phone: s.customer.phone }
      : null,
    createdBy: s.createdBy ? { id: s.createdBy.id, name: s.createdBy.name } : null,
    items: s.items?.map((it) => ({
      id: it.id,
      productName: it.productName,
      productSku: it.productSku,
      quantity: it.quantity,
      returnedQuantity: it.returnedQuantity,
      unitPrice: it.unitPrice.toString(),
      totalAmount: it.totalAmount.toString(),
      purchaseCost: isAdmin ? it.purchaseCost : undefined,
      profitAmount: isAdmin ? it.profitAmount : undefined,
      profitPct: isAdmin ? it.profitPct : undefined,
      costBasis: isAdmin ? it.costBasis : undefined,
      itemBatches: it.itemBatches?.map((ib) => ({
        id: ib.id,
        quantity: ib.quantity,
        batch: {
          id: ib.batch.id,
          batchNumber: ib.batch.batchNumber,
          expiryDate: (ib.batch.expiryDate instanceof Date ? ib.batch.expiryDate.toISOString() : String(ib.batch.expiryDate)),
          purchasePrice: isAdmin ? ib.batch.purchasePrice?.toString() : undefined,
        },
      })),
    })),
    payments: s.payments?.map((p) => ({
      id: p.id,
      method: p.method,
      amount: p.amount.toString(),
      reference: p.reference,
    })),
  }))

  const sanitizedSummary = isAdmin
    ? firstPage.summary
    : {
        billsCount: firstPage.summary.billsCount,
        salesValue: firstPage.summary.salesValue,
        amountReceived: firstPage.summary.amountReceived,
        outstanding: firstPage.summary.outstanding,
      }

  return (
    <SalesView
      initialRows={rawRows}
      initialPagination={firstPage.pagination}
      initialSummary={sanitizedSummary}
      isAdmin={isAdmin}
      ownerPhone={process.env.WHATSAPP_OWNER_PHONE || '+919876543210'}
    />
  )
}
