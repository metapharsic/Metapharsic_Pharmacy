import type { Metadata } from 'next'

import { ComplianceReportsView } from '@/components/reports/compliance-reports-view'
import { can, getSession } from '@/lib/auth/auth-helpers'
import { getTenantContext } from '@/lib/auth/tenant-context'
import { PERMISSIONS } from '@/lib/constants/permissions'
import prisma from '@/lib/db/prisma'

export const metadata: Metadata = {
  title: 'Statutory Compliance Registers & Analytics — PharmaCare',
  description:
    'Drug Inspector Schedule H/H1 registers, near-expiry stock surveillance, doctor commission audits, and gross margin analytics.',
}

export default async function ComplianceReportsPage() {
  const [canReadReports, session, tenant] = await Promise.all([
    can(PERMISSIONS.REPORTS_SALES),
    getSession(),
    getTenantContext(),
  ])

  if (!canReadReports || !session?.user) {
    return (
      <div className="space-y-4 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Statutory Pharmacy Compliance</h1>
          <p className="text-muted-foreground">Drug Inspector Schedule Registers & Margin Analytics</p>
        </div>
        <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-muted">
          <p className="text-muted-foreground">You do not have permission to view compliance registers.</p>
        </div>
      </div>
    )
  }

  let branchId: string | undefined = undefined
  if (session.user.branchId && tenant?.orgBranchIds.includes(session.user.branchId)) {
    branchId = session.user.branchId
  } else if (tenant?.branchId && tenant.orgBranchIds.includes(tenant.branchId)) {
    branchId = tenant.branchId
  } else if (tenant?.orgBranchIds && tenant.orgBranchIds.length > 0) {
    branchId = tenant.orgBranchIds[0]
  } else if (tenant?.organizationId) {
    const defaultBranch = await prisma.branch.findFirst({
      where: { organizationId: tenant.organizationId, isActive: true },
      orderBy: { isHeadOffice: 'desc' },
      select: { id: true },
    })
    branchId = defaultBranch?.id ?? '__no_such_branch__'
  } else {
    branchId = '__no_such_branch__'
  }

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <ComplianceReportsView branchId={branchId} />
    </div>
  )
}
