'use client'

import React from 'react'
import { useI18n } from '@/lib/i18n/i18n-context'
import { Badge } from '@/components/ui/badge'

export function ProductsPageHeader() {
  const { locale, territoryDef } = useI18n()

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <span>{locale === 'ar' ? 'دليل الأدوية والمستحضرات المعتمدة' : 'Product Catalog'}</span>
          <Badge variant="teal" className="text-xs font-mono uppercase">
            {territoryDef.code} • {territoryDef.currency.code}
          </Badge>
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          {locale === 'ar'
            ? 'إدارة قاعدة بيانات الأدوية الوطنية، الأسماء العلمية، التصنيفات الدوائية، والأسعار المعتمدة'
            : 'Manage your pharmaceutical product master database, generic salts, and price schedules'}
        </p>
      </div>
    </div>
  )
}
