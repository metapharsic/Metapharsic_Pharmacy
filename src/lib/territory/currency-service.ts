/**
 * Metapharsic Rx — Multi-Territory Currency & High-Precision Financial Engine
 * Handles 2-decimal (SAR, QAR, MVR, INR) and 3-decimal (OMR, BHD) sovereign precision.
 * Native bidirectional formatting for both English (LTR) and Arabic (RTL).
 */

import {
  CurrencyCode,
  TerritoryCode,
  getTerritory,
  TERRITORIES,
} from './territory-config'

export interface FormatCurrencyOptions {
  territory?: TerritoryCode
  currency?: CurrencyCode
  locale?: 'en' | 'ar'
  showSymbol?: boolean
  showCode?: boolean
  useArabicNumerals?: boolean // e.g. ١ ٢ ٣ vs 1 2 3
}

export interface CurrencyMetadata {
  code: CurrencyCode
  symbolEn: string
  symbolAr: string
  decimals: 2 | 3
  subunitScale: 100 | 1000
  subunitNameEn: string
  subunitNameAr: string
}

/**
 * Returns metadata for any given currency or territory.
 */
export function getCurrencyMetadata(
  currencyOrTerritory?: CurrencyCode | TerritoryCode | string | null
): CurrencyMetadata {
  if (!currencyOrTerritory) {
    return TERRITORIES.SA.currency
  }

  const upper = currencyOrTerritory.toUpperCase()

  // Match by territory code
  if (upper in TERRITORIES) {
    return TERRITORIES[upper as TerritoryCode].currency
  }

  // Match by currency code
  const matchedTerritory = Object.values(TERRITORIES).find(
    (t) => t.currency.code === upper
  )
  if (matchedTerritory) {
    return matchedTerritory.currency
  }

  // Default fallback to SAR
  return TERRITORIES.SA.currency
}

/**
 * Rounds a financial amount strictly to the sovereign decimal precision.
 * Prevents floating point inaccuracy by using Number.EPSILON.
 */
export function roundCurrency(
  amount: number | string,
  currencyOrTerritory?: CurrencyCode | TerritoryCode | string | null
): number {
  const num = typeof amount === 'string' ? parseFloat(amount) || 0 : amount
  const meta = getCurrencyMetadata(currencyOrTerritory)
  const factor = Math.pow(10, meta.decimals)
  return Math.round((num + Number.EPSILON) * factor) / factor
}

/**
 * Converts a decimal amount to sovereign subunits (e.g. OMR -> Baisa, SAR -> Halalas).
 */
export function toSubunits(
  amount: number | string,
  currencyOrTerritory?: CurrencyCode | TerritoryCode | string | null
): number {
  const num = typeof amount === 'string' ? parseFloat(amount) || 0 : amount
  const meta = getCurrencyMetadata(currencyOrTerritory)
  return Math.round(num * meta.subunitScale)
}

/**
 * Converts sovereign subunits back to the primary currency unit.
 */
export function fromSubunits(
  subunits: number,
  currencyOrTerritory?: CurrencyCode | TerritoryCode | string | null
): number {
  const meta = getCurrencyMetadata(currencyOrTerritory)
  return roundCurrency(subunits / meta.subunitScale, meta.code)
}

/**
 * Converts Western digits 0-9 to Eastern Arabic numerals (٠-٩) if requested.
 */
export function toEasternArabicDigits(str: string): string {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']
  return str.replace(/[0-9]/g, (w) => arabicDigits[parseInt(w, 10)])
}

/**
 * Formats a numeric amount according to sovereign territory precision and language script.
 * 
 * Examples:
 * - formatCurrency(12.35, { currency: 'SAR', locale: 'en' }) => "SAR 12.50"
 * - formatCurrency(12.35, { currency: 'SAR', locale: 'ar' }) => "12.50 ر.س"
 * - formatCurrency(12.35, { currency: 'OMR', locale: 'en' }) => "OMR 12.350" (3 decimals)
 * - formatCurrency(12.35, { currency: 'BHD', locale: 'ar' }) => "12.350 د.ب" (3 decimals)
 */
export function formatCurrency(
  amount: number | string,
  options: FormatCurrencyOptions = {}
): string {
  const num = typeof amount === 'string' ? parseFloat(amount) || 0 : amount
  const territoryCode = options.territory
  const currencyCode = options.currency
  const meta = getCurrencyMetadata(currencyCode || territoryCode)
  const locale = options.locale ?? (options.territory ? getTerritory(options.territory).defaultLanguage : 'en')
  const showSymbol = options.showSymbol !== false
  const showCode = options.showCode ?? false

  // Format with strict decimal precision (2 or 3)
  const formattedNumber = num.toLocaleString('en-US', {
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
    useGrouping: true,
  })

  const finalDigits = options.useArabicNumerals && locale === 'ar'
    ? toEasternArabicDigits(formattedNumber)
    : formattedNumber

  if (!showSymbol && !showCode) {
    return finalDigits
  }

  if (locale === 'ar') {
    // In Arabic RTL, display: [Number] [Symbol] e.g. "١٢٫٣٥٠ ر.ع." or "12.350 ر.ع."
    const symbol = showCode ? meta.code : meta.symbolAr
    return `${finalDigits} ${symbol}`
  } else {
    // In English LTR, display: [Symbol] [Number] e.g. "OMR 12.350" or "SAR 12.50"
    const symbol = showCode ? meta.code : meta.symbolEn
    return `${symbol} ${finalDigits}`
  }
}

/**
 * Returns formatted tax calculation breakdown for a medicine sale.
 * Accurately determines if the item qualifies for 0% zero-rated healthcare or standard VAT.
 */
export function calculateSovereignTax({
  grossAmount,
  isPrescriptionMedicine,
  territoryCode,
}: {
  grossAmount: number
  isPrescriptionMedicine: boolean
  territoryCode?: TerritoryCode | null
}): {
  taxableAmount: number
  taxRatePercent: number
  taxAmount: number
  totalWithTax: number
  isZeroRated: boolean
  regime: string
  taxAuthorityName: string
} {
  const territory = getTerritory(territoryCode)
  const isZeroRated = territory.tax.zeroRatedMedicines && isPrescriptionMedicine
  const taxRate = isZeroRated ? 0.0 : territory.tax.standardVatRate

  const netAmount = roundCurrency(grossAmount, territory.currency.code)
  const taxAmount = roundCurrency((netAmount * taxRate) / 100, territory.currency.code)
  const totalWithTax = roundCurrency(netAmount + taxAmount, territory.currency.code)

  return {
    taxableAmount: netAmount,
    taxRatePercent: taxRate,
    taxAmount,
    totalWithTax,
    isZeroRated,
    regime: territory.tax.regime,
    taxAuthorityName: territory.tax.taxAuthorityNameEn,
  }
}
