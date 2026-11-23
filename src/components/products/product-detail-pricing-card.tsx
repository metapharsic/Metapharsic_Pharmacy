'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useI18n } from '@/lib/i18n/i18n-context'
import { getTerritoryTaxProfile } from '@/lib/territory/sovereign-tax-service'

interface ProductPricingProps {
  product: {
    mrp: any
    ptr?: any
    costPrice?: any
    hsnCode?: string | null
    gstRate: any
    cgstRate: any
    sgstRate: any
    igstRate: any
    isGstExempt?: boolean
  }
}

function DetailRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium">{value ?? '—'}</dd>
    </div>
  )
}

export function ProductDetailPricingCard({ product }: ProductPricingProps) {
  const { territory, territoryDef, isAr, formatPrice } = useI18n()
  const taxProfile = getTerritoryTaxProfile(territory)
  const isIndia = territory === 'IN'

  const mrpNum = Number(product.mrp) || 0
  const ptrNum = product.ptr !== null && product.ptr !== undefined ? Number(product.ptr) : null
  const costNum = product.costPrice !== null && product.costPrice !== undefined ? Number(product.costPrice) : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>{isIndia ? 'Pricing & GST' : (isAr ? 'الأسعار وضريبة القيمة المضافة' : 'Pricing & VAT')}</span>
          {!isIndia && (
            <Badge variant="outline" className="text-[10px] font-mono uppercase bg-primary/10 text-primary border-primary/30">
              {taxProfile.regime} • {taxProfile.currency}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y">
          <DetailRow label={isAr ? 'سعر الجمهور (MRP)' : 'MRP'} value={formatPrice(mrpNum)} />
          <DetailRow
            label={isAr ? 'سعر الشراء للصيدلية (PTR)' : 'PTR'}
            value={ptrNum !== null ? formatPrice(ptrNum) : undefined}
          />
          <DetailRow
            label={isAr ? 'سعر التكلفة' : 'Cost Price'}
            value={costNum !== null ? formatPrice(costNum) : undefined}
          />
          <DetailRow
            label={isIndia ? 'HSN Code' : (isAr ? 'رمز التعريفة الجمركية' : 'Tariff / Regulatory Code')}
            value={product.hsnCode}
          />
          <DetailRow
            label={isIndia ? 'GST Rate' : (isAr ? 'نسبة الضريبة' : 'VAT Rate')}
            value={
              product.isGstExempt
                ? (isIndia ? 'Exempt' : (isAr ? 'نسبة الصفر (0%) معفى' : 'Zero-Rated (0%)'))
                : `${product.gstRate.toString()}%`
            }
          />
          {isIndia ? (
            <>
              <DetailRow
                label="CGST / SGST"
                value={
                  product.isGstExempt
                    ? '—'
                    : `${product.cgstRate.toString()}% / ${product.sgstRate.toString()}%`
                }
              />
              <DetailRow
                label="IGST"
                value={product.isGstExempt ? '—' : `${product.igstRate.toString()}%`}
              />
            </>
          ) : (
            <DetailRow
              label={isAr ? 'الهيئة الضريبية المعتمدة' : 'Tax Authority'}
              value={isAr ? taxProfile.authorityNameAr : taxProfile.authorityNameEn}
            />
          )}
        </dl>
      </CardContent>
    </Card>
  )
}
