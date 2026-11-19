import type { Metadata } from 'next'
import { HsnCodesTable } from '@/components/products/hsn-codes-table'

export const metadata: Metadata = {
  title: 'HSN & Tax Codes | PharmaCare',
  description: 'Manage statutory pharmaceutical HSN/SAC codes and GST tax rates',
}

export default function HsnCodesPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 border-b border-border/60 pb-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          HSN / SAC &amp; Statutory Tax Classification
        </h1>
        <p className="text-xs text-muted-foreground">
          Statutory tariff codes for pharmaceutical medicaments, healthcare preparations, and medical devices (GST Compliance)
        </p>
      </div>

      <HsnCodesTable />
    </div>
  )
}
