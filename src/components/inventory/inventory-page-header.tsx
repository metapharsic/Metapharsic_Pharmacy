'use client'

import React from 'react'
import { useI18n } from '@/lib/i18n/i18n-context'
import { Badge } from '@/components/ui/badge'

export function InventoryPageHeader() {
  const { locale, territoryDef } = useI18n()

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <span>{locale === 'ar' ? 'إدارة المخزون الدوائي السيادي' : 'Inventory Management'}</span>
          <Badge variant="teal" className="text-xs font-mono uppercase">
            {territoryDef.code} • {territoryDef.currency.code}
          </Badge>
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          {locale === 'ar'
            ? 'متابعة الرصيد اللحظي، تقييم رأس مال المخزون، رادار الصلاحية FEFO وتتبع التشغيلات المعتمدة'
            : 'Real-time enterprise stock tracking, valuation, FEFO expiry radar & AI packaging ingest'}
        </p>
      </div>
    </div>
  )
}
