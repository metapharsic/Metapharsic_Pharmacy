import type { Metadata } from 'next'

import {
  ReceiptVoucherForm,
  type BranchOption,
  type CustomerOption,
  type LedgerOption,
  type ReceiptVoucherItem,
} from '@/components/vouchers/receipt-voucher-form'
import { can, getSession } from '@/lib/auth/auth-helpers'
import { getTenantContext } from '@/lib/auth/tenant-context'
import { PERMISSIONS } from '@/lib/constants/permissions'
import prisma from '@/lib/db/prisma'
import { getAccessibleBranches } from '@/lib/inventory/branch-access'
import { getEligibleReceiptLedgers, getReceiptVouchers } from '@/lib/vouchers/voucher-service'

export const metadata: Metadata = {
  title: 'Receipt Voucher (F6) — PharmaCare Accounting',
  description: 'Tally-style double-entry receipt voucher with bill-by-bill FIFO allocation and XML sync',
}

export default async function ReceiptVouchersPage() {
  const [canRead, session, tenant] = await Promise.all([
    can(PERMISSIONS.FINANCE_READ),
    getSession(),
    getTenantContext(),
  ])

  if (!canRead || !session?.user) {
    return (
      <div className="space-y-4 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Receipt Voucher (F6)</h1>
          <p className="text-muted-foreground">Double-entry receipt accounting and bill settlements</p>
        </div>
        <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-muted">
          <p className="text-muted-foreground">
            You do not have permission to access financial vouchers.
          </p>
        </div>
      </div>
    )
  }

  const organizationId = tenant?.organizationId ?? session.user.organizationId ?? undefined
  const branchIdForVouchers =
    (session.user.branchId && (!tenant || tenant.orgBranchIds.includes(session.user.branchId)))
      ? session.user.branchId
      : (tenant?.branchId ?? (tenant?.orgBranchIds?.[0] ?? '__no_such_branch__'))

  // Fetch branches, eligible Dr ledgers, customers, and recent vouchers in parallel
  const [accessibleBranches, eligibleLedgers, customers, vouchersResult] = await Promise.all([
    getAccessibleBranches({
      id: session.user.id,
      branchId: session.user.branchId,
      organizationId,
    }),
    getEligibleReceiptLedgers(session.user.branchId ?? undefined),
    prisma.customer.findMany({
      where: {
        ...(organizationId ? { organizationId } : {}),
        isActive: true,
      },
      take: 100,
      orderBy: [{ outstandingBalance: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        phone: true,
        outstandingBalance: true,
        _count: {
          select: {
            sales: {
              where: {
                status: { not: 'CANCELLED' },
                balanceDue: { gt: 0 },
              },
            },
          },
        },
      },
    }),
    getReceiptVouchers({
      limit: 25,
      branchId: branchIdForVouchers,
    }),
  ])

  const branches: BranchOption[] = accessibleBranches.map((b) => ({
    id: b.id,
    name: b.name,
    code: b.code,
  }))

  const initialLedgers: LedgerOption[] = eligibleLedgers.map((l) => ({
    id: l.id,
    code: l.code,
    name: l.name,
    group: l.group,
    balance: Number(l.balance),
  }))

  const initialCustomers: CustomerOption[] = customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    outstandingBalance: Number(c.outstandingBalance),
    unpaidInvoicesCount: c._count.sales,
  }))

  const initialVouchers: ReceiptVoucherItem[] = vouchersResult.items.map((v) => ({
    id: v.id,
    voucherNumber: v.voucherNumber,
    date: v.date,
    narration: v.narration,
    amount: v.amount,
    debitLedgerName: v.debitLedgerName,
    customerName: v.customerName,
    customerPhone: v.customerPhone,
    allocationsCount: v.allocationsCount,
    branchName: v.branchName,
    createdByName: v.createdByName,
    createdAt: v.createdAt,
  }))

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <ReceiptVoucherForm
        branches={branches}
        initialLedgers={initialLedgers}
        initialCustomers={initialCustomers}
        initialVouchers={initialVouchers}
        defaultBranchId={branchIdForVouchers !== '__no_such_branch__' ? branchIdForVouchers : (branches[0]?.id ?? '')}
      />
    </div>
  )
}
