/**
 * Metapharsic Rx — Global Sovereign Currency Formatter Utility
 * Seamlessly formats currencies across 🇸🇦 SAR, 🇴🇲 OMR (3-decimals), 🇧🇭 BHD (3-decimals),
 * 🇶🇦 QAR, 🇲🇻 MVR, and 🇮🇳 INR with automatic language script alignment (LTR / RTL).
 */

import {
  formatCurrency as formatSovereignCurrency,
  roundCurrency as roundSovereignCurrency,
  FormatCurrencyOptions,
  getCurrencyMetadata,
} from '@/lib/territory/currency-service'
import { TerritoryCode } from '@/lib/territory/territory-config'

/**
 * Format a number according to active sovereign territory and language.
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  overrideOptions?: FormatCurrencyOptions
): string {
  if (amount === null || amount === undefined || amount === '') {
    amount = 0
  }
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return '0.00'

  let activeTerritory: TerritoryCode = 'SA'
  let activeLocale: 'en' | 'ar' = 'ar'

  if (typeof window !== 'undefined') {
    try {
      const storedTerritory = localStorage.getItem('mpharm_territory') as TerritoryCode
      if (storedTerritory && ['SA', 'OM', 'BH', 'QA', 'MV', 'IN'].includes(storedTerritory)) {
        activeTerritory = storedTerritory
      }
      const storedLocale = localStorage.getItem('mpharm_locale') as 'en' | 'ar'
      if (storedLocale && ['en', 'ar'].includes(storedLocale)) {
        activeLocale = storedLocale
      }
    } catch {
      // localStorage fallback
    }
  }

  // If territory is India and locale is English, use standard INR formatter
  if (activeTerritory === 'IN' && activeLocale === 'en' && !overrideOptions?.currency) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)
  }

  return formatSovereignCurrency(num, {
    territory: activeTerritory,
    locale: activeLocale,
    ...overrideOptions,
  })
}

/**
 * Format a number with localized number system
 */
export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '0'
  return new Intl.NumberFormat().format(num)
}

/**
 * Parse currency string to number
 */
export function parseCurrency(value: string): number {
  return parseFloat(value.replace(/[^0-9.-]/g, '')) || 0
}

/**
 * Round according to sovereign precision (2 vs 3 decimals)
 */
export function roundCurrency(amount: number, territoryCode?: TerritoryCode | string): number {
  return roundSovereignCurrency(amount, territoryCode as any)
}

/**
 * Calculate tax amounts dynamically according to sovereign tax rules
 */
export function calculateGst(
  taxableAmount: number,
  taxRate: number,
  isInterState = false
): { cgst: number; sgst: number; igst: number; total: number } {
  const totalTax = Math.round((taxableAmount * (taxRate / 100) + Number.EPSILON) * 100) / 100
  if (isInterState) {
    return { cgst: 0, sgst: 0, igst: totalTax, total: totalTax }
  }
  const halfTax = Math.round((totalTax / 2 + Number.EPSILON) * 100) / 100
  return { cgst: halfTax, sgst: totalTax - halfTax, igst: 0, total: totalTax }
}
