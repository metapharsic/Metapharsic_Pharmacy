// ─────────────────────────────────────────────────────────────
// METAPHARSIC LIFESCIENCES — Statutory Discount Exemption Engine
//
// Identifies price-controlled, DPCO ceiling, Schedule X, NDPS,
// and hospital-restricted medicines that are legally or policy
// exempted from retail discounts.
// ─────────────────────────────────────────────────────────────

export interface DiscountExemptCheckInput {
  id?: string
  name?: string
  sku?: string
  drugSchedule?: string | null
  dpcoCeiling?: number | string | null
  isDiscountable?: boolean | null
  isDiscountExempt?: boolean | null
  categoryName?: string | null
  tags?: string[] | null
}

export interface DiscountExemptionResult {
  isExempt: boolean
  reason: string | null
  badgeText: string | null
  statutoryCategory: 'DPCO' | 'SCHEDULE_X' | 'NARCOTIC_NDPS' | 'POLICY_EXEMPT' | 'NONE'
}

/**
 * Checks whether a product or medicine is legally or administratively exempt from discounts.
 */
export function checkDiscountExemption(
  item: DiscountExemptCheckInput | null | undefined
): DiscountExemptionResult {
  if (!item) {
    return {
      isExempt: false,
      reason: null,
      badgeText: null,
      statutoryCategory: 'NONE',
    }
  }

  // 1. Explicitly flagged as non-discountable or discount-exempt
  if (item.isDiscountable === false || item.isDiscountExempt === true) {
    return {
      isExempt: true,
      reason: 'Product is flagged as non-discountable in dispensary catalog',
      badgeText: 'Non-Discountable',
      statutoryCategory: 'POLICY_EXEMPT',
    }
  }

  // 2. DPCO Ceiling Price Drugs (National List of Essential Medicines / Drug Price Control Order)
  const dpcoNum = item.dpcoCeiling != null ? Number(item.dpcoCeiling) : 0
  if (!isNaN(dpcoNum) && dpcoNum > 0) {
    return {
      isExempt: true,
      reason: `DPCO ceiling controlled (₹${dpcoNum.toFixed(2)} cap). Statutory 0% discount.`,
      badgeText: 'DPCO Price-Capped',
      statutoryCategory: 'DPCO',
    }
  }

  // 3. Schedule X (Narcotics, Psychotropics, Special Controlled Substances)
  const schedule = (item.drugSchedule || '').toUpperCase()
  if (schedule === 'X' || schedule === 'SCHEDULE_X') {
    return {
      isExempt: true,
      reason: 'Schedule X restricted substance — statutory discount exemption enforced',
      badgeText: 'Schedule X (Exempt)',
      statutoryCategory: 'SCHEDULE_X',
    }
  }

  // 4. NDPS Narcotic Register
  if (schedule === 'NARCOTIC_NDPS' || schedule === 'NDPS') {
    return {
      isExempt: true,
      reason: 'NDPS Act controlled medication — anti-discounting protocol strictly applied',
      badgeText: 'NDPS Regulated',
      statutoryCategory: 'NARCOTIC_NDPS',
    }
  }

  // 5. Category-based exemption keywords
  const category = (item.categoryName || '').toLowerCase()
  if (
    category.includes('dpco') ||
    category.includes('price control') ||
    category.includes('nlem') ||
    category.includes('vaccine (govt)') ||
    category.includes('non-discountable')
  ) {
    return {
      isExempt: true,
      reason: `Category "${item.categoryName}" is protected from promotional discounting`,
      badgeText: 'Exempt Category',
      statutoryCategory: 'POLICY_EXEMPT',
    }
  }

  return {
    isExempt: false,
    reason: null,
    badgeText: null,
    statutoryCategory: 'NONE',
  }
}

export interface BillItemForDiscount {
  id?: string
  grossAmount: number
  isDiscountExempt?: boolean
  drugSchedule?: string | null
  dpcoCeiling?: number | string | null
  isDiscountable?: boolean | null
  categoryName?: string | null
}

export interface IntelligentDiscountCalculation {
  totalGrossAmount: number
  eligibleGrossAmount: number
  exemptGrossAmount: number
  billDiscountPercent: number
  billDiscountAmount: number
  effectiveDiscountPercent: number
  exemptCount: number
  eligibleCount: number
}

/**
 * Intelligent bill discount calculator.
 * Applies the requested bill discount percentage strictly against the DISCOUNT-ELIGIBLE
 * portion of the bill, safeguarding DPCO and statutory exempt medicines.
 */
export function calculateIntelligentBillDiscount(
  items: BillItemForDiscount[],
  requestedDiscountPercent: number
): IntelligentDiscountCalculation {
  const safePercent = Math.max(0, Math.min(100, Number(requestedDiscountPercent) || 0))

  let totalGross = 0
  let eligibleGross = 0
  let exemptGross = 0
  let exemptCount = 0
  let eligibleCount = 0

  for (const item of items) {
    const gross = Math.max(0, Number(item.grossAmount) || 0)
    totalGross += gross

    const status = checkDiscountExemption(item)
    if (status.isExempt) {
      exemptGross += gross
      exemptCount++
    } else {
      eligibleGross += gross
      eligibleCount++
    }
  }

  // Round gross amounts to 2 decimals
  totalGross = Math.round((totalGross + Number.EPSILON) * 100) / 100
  eligibleGross = Math.round((eligibleGross + Number.EPSILON) * 100) / 100
  exemptGross = Math.round((exemptGross + Number.EPSILON) * 100) / 100

  // Calculate discount amount ONLY on eligible items
  const billDiscountAmount =
    Math.round(((eligibleGross * safePercent) / 100 + Number.EPSILON) * 100) / 100

  const effectiveDiscountPercent =
    totalGross > 0
      ? Math.round(((billDiscountAmount / totalGross) * 100 + Number.EPSILON) * 100) / 100
      : 0

  return {
    totalGrossAmount: totalGross,
    eligibleGrossAmount: eligibleGross,
    exemptGrossAmount: exemptGross,
    billDiscountPercent: safePercent,
    billDiscountAmount,
    effectiveDiscountPercent,
    exemptCount,
    eligibleCount,
  }
}

