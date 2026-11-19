/**
 * Metapharsic Rx — Sovereign Multi-Territory Tax Calculation Engine
 * Pure dynamic sovereign tax engine covering:
 * - Saudi Arabia (SA): ZATCA 15% standard VAT, 0% Zero-Rated for SFDA Registered Human Medicines.
 * - Oman (OM): OTA 5% standard VAT, 0% Zero-Rated for MoH Registered Basic Medicines (3-decimal precision).
 * - Bahrain (BH): NBR 10% standard VAT, 0% Zero-Rated for NHRA Registered Medicines (3-decimal precision).
 * - Qatar (QA): MoPH 0% standard regime.
 * - Maldives (MV): MIRA 8% GGST with Aasandha National Health Scheme co-payment separation.
 * - India (IN): Multi-slab CGST/SGST/IGST + HSN statutory matrix.
 */

import {
  CurrencyCode,
  TerritoryCode,
  getTerritory,
  TERRITORIES,
} from '@/lib/territory/territory-config'
import {
  formatCurrency,
  getCurrencyMetadata,
  roundCurrency,
} from '@/lib/territory/currency-service'

export interface SovereignLineItemInput {
  id?: string
  productId?: string
  name: string
  nameAr?: string
  quantity: number
  unitPrice: number
  mrp?: number
  discountPercent?: number
  discountAmount?: number
  isPrescription?: boolean
  isControlled?: boolean // Narcotic, Schedule H1, CD
  category?: 'MEDICINE' | 'COSMETIC' | 'SUPPLEMENT' | 'DEVICE' | 'GENERAL'
  hsnCode?: string
  customTaxRate?: number // Override tax rate if explicitly specified
  aasandhaCovered?: boolean // Maldives Aasandha Health Scheme
  aasandhaCopayPercent?: number // e.g. 0% (fully covered) or 15%
}

export interface SovereignLineItemOutput {
  id?: string
  productId?: string
  name: string
  nameAr: string
  quantity: number
  unitPrice: number
  grossAmount: number
  discountAmount: number
  netAmount: number
  taxRatePercent: number
  taxAmount: number
  totalAmount: number
  isZeroRated: boolean
  isExempt: boolean
  taxExemptionCode?: string
  taxExemptionReasonEn?: string
  taxExemptionReasonAr?: string
  aasandhaSubsidyAmount?: number
  patientPayableAmount: number
  formattedTotalEn: string
  formattedTotalAr: string
}

export interface SovereignTaxBreakdown {
  territoryCode: TerritoryCode
  currencyCode: CurrencyCode
  currencyDecimals: 2 | 3
  regime: string
  taxAuthorityNameEn: string
  taxAuthorityNameAr: string
  vatIdLabelEn: string
  vatIdLabelAr: string
  invoiceHeadingEn: string
  invoiceHeadingAr: string
  subtotalGross: number
  totalDiscounts: number
  taxableStandardBase: number
  taxableZeroRatedBase: number
  taxableExemptBase: number
  vatStandardTotal: number
  vatZeroRatedTotal: number
  totalTax: number
  roundOff: number
  grandTotal: number
  aasandhaTotalCoverage?: number
  patientNetPayable: number
  formattedGrandTotalEn: string
  formattedGrandTotalAr: string
  lines: SovereignLineItemOutput[]
}

/**
 * Calculates complete sovereign tax breakdown for an invoice cart across any of the 6 supported territories.
 */
export function calculateSovereignInvoiceTax(
  items: SovereignLineItemInput[],
  territoryCode: TerritoryCode = 'SA',
  options: {
    roundOffToInteger?: boolean
    defaultTaxRate?: number
  } = {}
): SovereignTaxBreakdown {
  const territory = getTerritory(territoryCode)
  const currencyMeta = getCurrencyMetadata(territoryCode)
  const decimals = currencyMeta.decimals
  const currency = currencyMeta.code

  let subtotalGross = 0
  let totalDiscounts = 0
  let taxableStandardBase = 0
  let taxableZeroRatedBase = 0
  let taxableExemptBase = 0
  let vatStandardTotal = 0
  let totalAasandhaCoverage = 0

  const lines: SovereignLineItemOutput[] = items.map((item, index) => {
    const qty = item.quantity > 0 ? item.quantity : 1
    const price = item.unitPrice || item.mrp || 0
    const gross = roundCurrency(price * qty, currency)
    subtotalGross = roundCurrency(subtotalGross + gross, currency)

    // Calculate line discount
    let discAmt = 0
    if (item.discountAmount && item.discountAmount > 0) {
      discAmt = roundCurrency(item.discountAmount, currency)
    } else if (item.discountPercent && item.discountPercent > 0) {
      discAmt = roundCurrency((gross * item.discountPercent) / 100, currency)
    }
    discAmt = Math.min(discAmt, gross)
    totalDiscounts = roundCurrency(totalDiscounts + discAmt, currency)

    const net = roundCurrency(gross - discAmt, currency)

    // Determine Sovereign Tax Classification
    let isZeroRated = false
    let isExempt = false
    let taxRate = territory.tax.standardVatRate
    let taxExemptionCode: string | undefined = undefined
    let taxExemptionReasonEn: string | undefined = undefined
    let taxExemptionReasonAr: string | undefined = undefined
    let aasandhaSubsidyAmount = 0
    let patientPayable = net

    // Territory-Specific Sovereign Rules
    switch (territoryCode) {
      case 'SA': {
        // ZATCA: SFDA registered human pharmaceuticals are 0% Zero-Rated
        const isMed = item.isPrescription || item.category === 'MEDICINE' || (!item.category && item.hsnCode?.startsWith('3004'))
        if (isMed) {
          isZeroRated = true
          taxRate = 0.0
          taxExemptionCode = 'VATEX-SA-HEALTH'
          taxExemptionReasonEn = 'SFDA Registered Human Pharmaceuticals (0% Zero-Rated Healthcare)'
          taxExemptionReasonAr = 'أدوية بشرية مسجلة لدى هيئة الغذاء والدواء (خاضعة للنسبة الصفرية)'
        } else {
          taxRate = item.customTaxRate !== undefined ? item.customTaxRate : 15.0
        }
        break
      }

      case 'OM': {
        // OTA: MoH registered essential medicines are 0% Zero-Rated
        const isMed = item.isPrescription || item.category === 'MEDICINE' || (!item.category && item.hsnCode?.startsWith('3004'))
        if (isMed) {
          isZeroRated = true
          taxRate = 0.0
          taxExemptionCode = 'OTA-MED-ZERO'
          taxExemptionReasonEn = 'MoH Basic & Essential Human Medicines (0% Zero-Rated)'
          taxExemptionReasonAr = 'الأدوية والمستلزمات الطبية الأساسية المسجلة لدى وزارة الصحة (نسبة صفرية)'
        } else {
          taxRate = item.customTaxRate !== undefined ? item.customTaxRate : 5.0
        }
        break
      }

      case 'BH': {
        // NBR: NHRA registered human medicines are 0% Zero-Rated
        const isMed = item.isPrescription || item.category === 'MEDICINE' || (!item.category && item.hsnCode?.startsWith('3004'))
        if (isMed) {
          isZeroRated = true
          taxRate = 0.0
          taxExemptionCode = 'NHRA-MED-ZERO'
          taxExemptionReasonEn = 'NHRA Approved Medical Supplies & Pharmaceuticals (0% Zero-Rated)'
          taxExemptionReasonAr = 'الأدوية المعتمدة من الهيئة الوطنية لتنظيم المهن والخدمات الصحية (نسبة صفرية)'
        } else {
          taxRate = item.customTaxRate !== undefined ? item.customTaxRate : 10.0
        }
        break
      }

      case 'QA': {
        // Qatar MoPH: 0% standard regime on retail pharmaceuticals
        isZeroRated = true
        taxRate = 0.0
        taxExemptionCode = 'QA-MOPH-ZERO'
        taxExemptionReasonEn = 'Qatar MoPH Healthcare Regime (0% VAT)'
        taxExemptionReasonAr = 'نظام الرعاية الصحية بدولة قطر (بدون ضريبة قيمة مضافة)'
        break
      }

      case 'MV': {
        // Maldives MIRA GGST: 8% standard. Essential medicines under Aasandha are subsidised.
        if (item.aasandhaCovered) {
          isZeroRated = true
          taxRate = 0.0
          taxExemptionCode = 'MIRA-AASANDHA-SUB'
          taxExemptionReasonEn = 'Maldives Aasandha Universal Health Scheme'
          taxExemptionReasonAr = 'مخطط أساندها للضمان الصحي الوطني بجزر المالديف'
          const copayPct = item.aasandhaCopayPercent !== undefined ? item.aasandhaCopayPercent : 0
          patientPayable = roundCurrency((net * copayPct) / 100, currency)
          aasandhaSubsidyAmount = roundCurrency(net - patientPayable, currency)
          totalAasandhaCoverage = roundCurrency(totalAasandhaCoverage + aasandhaSubsidyAmount, currency)
        } else {
          taxRate = item.customTaxRate !== undefined ? item.customTaxRate : 8.0
        }
        break
      }

      case 'IN':
      default: {
        // India GST: 0%, 5%, 12%, 18% based on item or default
        if (item.category === 'MEDICINE' || item.isPrescription) {
          taxRate = item.customTaxRate !== undefined ? item.customTaxRate : 5.0
        } else {
          taxRate = item.customTaxRate !== undefined ? item.customTaxRate : 12.0
        }
        if (taxRate === 0) {
          isZeroRated = true
          taxExemptionCode = 'GST-DPCO-EXEMPT'
          taxExemptionReasonEn = 'DPCO / Life Saving Medicine 0% GST'
          taxExemptionReasonAr = 'أدوية منقذة للحياة معفاة من ضريبة السلع والخدمات'
        }
        break
      }
    }

    // Compute Tax Amount
    const taxAmt = roundCurrency((net * taxRate) / 100, currency)
    const lineTotal = roundCurrency(net + taxAmt, currency)

    if (isZeroRated) {
      taxableZeroRatedBase = roundCurrency(taxableZeroRatedBase + net, currency)
    } else if (isExempt) {
      taxableExemptBase = roundCurrency(taxableExemptBase + net, currency)
    } else {
      taxableStandardBase = roundCurrency(taxableStandardBase + net, currency)
      vatStandardTotal = roundCurrency(vatStandardTotal + taxAmt, currency)
    }

    return {
      id: item.id,
      productId: item.productId,
      name: item.name,
      nameAr: item.nameAr || item.name,
      quantity: qty,
      unitPrice: price,
      grossAmount: gross,
      discountAmount: discAmt,
      netAmount: net,
      taxRatePercent: taxRate,
      taxAmount: taxAmt,
      totalAmount: lineTotal,
      isZeroRated,
      isExempt,
      taxExemptionCode,
      taxExemptionReasonEn,
      taxExemptionReasonAr,
      aasandhaSubsidyAmount: aasandhaSubsidyAmount > 0 ? aasandhaSubsidyAmount : undefined,
      patientPayableAmount: roundCurrency(patientPayable + taxAmt, currency),
      formattedTotalEn: formatCurrency(lineTotal, { currency, locale: 'en' }),
      formattedTotalAr: formatCurrency(lineTotal, { currency, locale: 'ar' }),
    }
  })

  const totalTax = vatStandardTotal
  const rawGrandTotal = roundCurrency(
    taxableStandardBase + taxableZeroRatedBase + taxableExemptBase + totalTax,
    currency
  )

  let roundOff = 0
  let finalGrandTotal = rawGrandTotal

  if (options.roundOffToInteger) {
    const roundedInt = Math.round(rawGrandTotal)
    roundOff = roundCurrency(roundedInt - rawGrandTotal, currency)
    finalGrandTotal = roundedInt
  }

  const patientNetPayable = roundCurrency(finalGrandTotal - totalAasandhaCoverage, currency)

  // Sovereign statutory titles and labels
  const headings = getSovereignHeadings(territoryCode)

  return {
    territoryCode,
    currencyCode: currency,
    currencyDecimals: decimals,
    regime: territory.tax.regime,
    taxAuthorityNameEn: territory.tax.taxAuthorityNameEn,
    taxAuthorityNameAr: territory.tax.taxAuthorityNameAr,
    vatIdLabelEn: territory.tax.vatIdLabelEn,
    vatIdLabelAr: territory.tax.vatIdLabelAr,
    invoiceHeadingEn: headings.en,
    invoiceHeadingAr: headings.ar,
    subtotalGross,
    totalDiscounts,
    taxableStandardBase,
    taxableZeroRatedBase,
    taxableExemptBase,
    vatStandardTotal,
    vatZeroRatedTotal: 0.0,
    totalTax,
    roundOff,
    grandTotal: finalGrandTotal,
    aasandhaTotalCoverage: totalAasandhaCoverage > 0 ? totalAasandhaCoverage : undefined,
    patientNetPayable,
    formattedGrandTotalEn: formatCurrency(finalGrandTotal, { currency, locale: 'en' }),
    formattedGrandTotalAr: formatCurrency(finalGrandTotal, { currency, locale: 'ar' }),
    lines,
  }
}

function getSovereignHeadings(code: TerritoryCode): { en: string; ar: string } {
  switch (code) {
    case 'SA':
      return {
        en: 'Simplified Tax Invoice (ZATCA Fatoora Phase 2)',
        ar: 'فاتورة ضريبية مبسطة (هيئة الزكاة والضريبة والجمارك - المرحلة الثانية)',
      }
    case 'OM':
      return {
        en: 'Sovereign Tax Invoice (Oman OTA)',
        ar: 'فاتورة ضريبية معتمدة (جهاز الضرائب بسلطنة عُمان)',
      }
    case 'BH':
      return {
        en: 'Sovereign Tax Invoice (Bahrain NBR)',
        ar: 'فاتورة ضريبية قانونية (الجهاز الوطني للإيرادات بمملكة البحرين)',
      }
    case 'QA':
      return {
        en: 'Pharmacy Dispensing Cash Memo (Qatar MoPH)',
        ar: 'مذكرة صرف وصرفيات صيدلانية (وزارة الصحة العامة بدولة قطر)',
      }
    case 'MV':
      return {
        en: 'Tax Invoice & Aasandha Scheme Copay Slip (Maldives MIRA)',
        ar: 'فاتورة ضريبية وقسيمة دفع مشتركة أساندها (هيئة الإيرادات الداخلية بجزر المالديف)',
      }
    case 'IN':
    default:
      return {
        en: 'Tax Invoice / Retail Cash Memo (India GST & Drugs Act)',
        ar: 'فاتورة ضريبية / مذكرة بيع معتمدة بالتجزئة',
      }
  }
}
