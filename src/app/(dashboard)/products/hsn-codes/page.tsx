import type { Metadata } from 'next'
import { HsnCodesTable } from '@/components/products/hsn-codes-table'
import { HsnCodesPageHeader } from '@/components/products/hsn-codes-page-header'

export const metadata: Metadata = {
  title: 'Tariff & Tax Codes | PharmaCare',
  description: 'Manage statutory pharmaceutical tariff codes and sovereign tax rates',
}

export default function HsnCodesPage() {
  return (
    <div className="space-y-4">
      <HsnCodesPageHeader />
      <HsnCodesTable />
    </div>
  )
}
