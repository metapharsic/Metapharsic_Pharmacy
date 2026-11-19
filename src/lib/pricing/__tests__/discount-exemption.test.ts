import {
  checkDiscountExemption,
  calculateIntelligentBillDiscount,
} from '@/lib/pricing/discount-exemption'

describe('Statutory Discount Exemption Engine', () => {
  it('correctly identifies DPCO ceiling medicines as exempt', () => {
    const res = checkDiscountExemption({
      name: 'Paracetamol 650mg Tab',
      dpcoCeiling: 2.15,
      drugSchedule: 'NONE',
    })
    expect(res.isExempt).toBe(true)
    expect(res.statutoryCategory).toBe('DPCO')
    expect(res.badgeText).toBe('DPCO Price-Capped')
  })

  it('correctly identifies Schedule X narcotics as exempt', () => {
    const res = checkDiscountExemption({
      name: 'Methylphenidate 10mg',
      drugSchedule: 'SCHEDULE_X',
    })
    expect(res.isExempt).toBe(true)
    expect(res.statutoryCategory).toBe('SCHEDULE_X')
  })

  it('correctly identifies NDPS drugs as exempt', () => {
    const res = checkDiscountExemption({
      name: 'Morphine Sulphate 10mg',
      drugSchedule: 'NARCOTIC_NDPS',
    })
    expect(res.isExempt).toBe(true)
    expect(res.statutoryCategory).toBe('NARCOTIC_NDPS')
  })

  it('correctly identifies items explicitly flagged isDiscountable: false', () => {
    const res = checkDiscountExemption({
      name: 'Special Serum',
      isDiscountable: false,
    })
    expect(res.isExempt).toBe(true)
    expect(res.statutoryCategory).toBe('POLICY_EXEMPT')
  })

  it('allows discounts on regular non-exempt medicines', () => {
    const res = checkDiscountExemption({
      name: 'Amoxicillin 500mg',
      dpcoCeiling: null,
      drugSchedule: 'H',
      isDiscountable: true,
    })
    expect(res.isExempt).toBe(false)
    expect(res.statutoryCategory).toBe('NONE')
  })

  it('calculates intelligent bill discount by exempting DPCO and controlled items', () => {
    const items = [
      {
        id: '1',
        name: 'Regular Vitamin C',
        grossAmount: 500,
        dpcoCeiling: null,
        drugSchedule: 'NONE',
      },
      {
        id: '2',
        name: 'DPCO Essential Drug',
        grossAmount: 300,
        dpcoCeiling: 15.0, // DPCO exempt
        drugSchedule: 'NONE',
      },
      {
        id: '3',
        name: 'Schedule X Drug',
        grossAmount: 200,
        dpcoCeiling: null,
        drugSchedule: 'X', // Schedule X exempt
      },
    ]

    // 10% discount requested on ₹1000 total bill
    const result = calculateIntelligentBillDiscount(items, 10)

    expect(result.totalGrossAmount).toBe(1000)
    expect(result.eligibleGrossAmount).toBe(500)
    expect(result.exemptGrossAmount).toBe(500)
    // 10% of 500 = 50 (NOT 10% of 1000 which would be 100)
    expect(result.billDiscountAmount).toBe(50)
    expect(result.exemptCount).toBe(2)
    expect(result.eligibleCount).toBe(1)
    expect(result.effectiveDiscountPercent).toBe(5)
  })
})

