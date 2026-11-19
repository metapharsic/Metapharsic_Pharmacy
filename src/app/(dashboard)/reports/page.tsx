import { Package, ShieldAlert, Truck } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { OwnerWhatsAppDigestCard } from '@/components/reports/owner-whatsapp-digest-card'
import { ReportsHubClient } from '@/components/reports/reports-hub-client'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Reports & Analytics Hub | PharmaCare' }

const specializedReports = [
  {
    title: 'Daily Stock Position & Valuation',
    description: 'Batches, current stock balances, and FEFO expiry risk',
    href: '/reports/inventory',
    icon: Package,
  },
  {
    title: 'Supplier Performance',
    description: 'Procurement fulfillment rates and ledger balances',
    href: '/reports/supplier',
    icon: Truck,
  },
  {
    title: 'Narcotics & Schedule H1 Register',
    description: 'Statutory compliance log for Schedule X and H1 drugs',
    href: '/reports/narcotics',
    icon: ShieldAlert,
  },
]

export default function ReportsAnalyticsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 border-b border-border/60 pb-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Dispensary Reports &amp; Analytics
        </h1>
        <p className="text-xs text-muted-foreground">
          Comprehensive business intelligence for sales, prescriptions, doctors, and regulatory
          compliance with interactive view and download options
        </p>
      </div>

      {/* Automated 11:30 PM Owner WhatsApp Closing Digest */}
      <OwnerWhatsAppDigestCard />

      {/* Main Unified Reports Hub */}
      <ReportsHubClient />

      {/* Specialized Regulatory & Supply Chain Reports */}
      <div className="space-y-3 border-t border-border/60 pt-4">
        <h3 className="text-sm font-semibold text-foreground">Specialized Regulatory Registers</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {specializedReports.map((report) => (
            <Link key={report.href} href={report.href}>
              <Card className="h-full cursor-pointer transition-all hover:border-teal-500/50 hover:bg-muted/30">
                <CardHeader className="space-y-1.5 p-4">
                  <div className="flex items-center gap-2">
                    <report.icon className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                    <CardTitle className="text-sm font-semibold text-foreground">
                      {report.title}
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs">{report.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
