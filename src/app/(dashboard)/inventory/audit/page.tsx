import type { Metadata } from 'next'
import { InventoryAuditClient } from '@/components/inventory/inventory-audit-client'

export const metadata: Metadata = {
  title: 'Inventory Audit & Stock Reconciliation | PharmaCare',
  description: 'Enterprise multi-threaded physical inventory audit, Schedule H1/X compliance, and cryptographic integrity verification.',
}

export default function InventoryAuditPage() {
  return (
    <div className="space-y-4">
      <InventoryAuditClient />
    </div>
  )
}

