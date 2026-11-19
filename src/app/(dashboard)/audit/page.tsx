import type { Metadata } from 'next'
import { AuditLogClient } from '@/components/audit/audit-log-client'

export const metadata: Metadata = { title: 'Audit Trail & Compliance | PharmaCare' }

export default function AuditCompliancePage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 border-b border-border/60 pb-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Audit & Compliance Trail</h1>
        <p className="text-xs text-muted-foreground">
          Full regulatory audit trail of dispensary operations, user access, and inventory adjustments
        </p>
      </div>

      <AuditLogClient />
    </div>
  )
}
