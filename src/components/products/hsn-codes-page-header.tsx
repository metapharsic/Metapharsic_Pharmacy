'use client'

import React from 'react'
import { useI18n } from '@/lib/i18n/i18n-context'
import { getTerritoryTaxProfile } from '@/lib/territory/sovereign-tax-service'
import { Badge } from '@/components/ui/badge'

export function HsnCodesPageHeader() {
  const { territory, territoryDef, isAr } = useI18n()
  const taxProfile = getTerritoryTaxProfile(territory)
  const isIndia = territory === 'IN'

  return (
    <div className="flex flex-col gap-1 border-b border-border/60 pb-3">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {isIndia
            ? 'HSN / SAC & Statutory Tax Classification'
            : isAr
              ? `رموز التعريفة الجمركية والضرائب (${taxProfile.authorityNameAr})`
              : `${taxProfile.authorityNameEn} — Tariff & Regulatory Classification`}
        </h1>
        <Badge variant="outline" className="font-mono text-xs uppercase bg-primary/10 text-primary border-primary/30">
          {taxProfile.regime} • {taxProfile.currency}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        {isIndia
          ? 'Statutory tariff codes for pharmaceutical medicaments, healthcare preparations, and medical devices (GST Compliance)'
          : isAr
            ? `رموز التعريفة المعتمدة للأدوية البشرية والمستحضرات الطبية وفق لوائح ${taxProfile.authorityNameAr}.`
            : `Statutory tariff and regulatory classifications for pharmaceutical medicaments under ${taxProfile.authorityNameEn} (${territoryDef.nameEn}).`}
      </p>
    </div>
  )
}
