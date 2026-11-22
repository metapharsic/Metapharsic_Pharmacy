import { describe, it, expect } from 'vitest'
import {
  calculateProRataPricing,
} from '../strip-counter-engine'
import { checkLasaSafety } from '../lasa-safety-guard'
import { MultiItemDetector } from '../multi-item-detector'

describe('AI Vision Camera-to-Bill: Cut-Strip Pro-Rata Math', () => {
  it('accurately calculates pro-rata pricing for 7 tablets remaining out of 10s strip', () => {
    const pricing = calculateProRataPricing(33.60, 10, 7, 12)
    expect(pricing.pricePerTab).toBe(3.36)
    expect(pricing.lineTotal).toBe(23.52)
    expect(pricing.dispenseCount).toBe(7)
    expect(pricing.tabsPerStrip).toBe(10)
    expect(pricing.taxableAmount + pricing.taxAmount).toBeCloseTo(23.52, 1)
  })

  it('accurately calculates pro-rata pricing for 4 tablets remaining out of 15s strip', () => {
    const pricing = calculateProRataPricing(150.00, 15, 4, 12)
    expect(pricing.pricePerTab).toBe(10.00)
    expect(pricing.lineTotal).toBe(40.00)
    expect(pricing.dispenseCount).toBe(4)
    expect(pricing.tabsPerStrip).toBe(15)
  })

  it('handles safe minimum boundaries when tabsPerStrip or count is missing', () => {
    const pricing = calculateProRataPricing(100.00, 0, 0, 12)
    expect(pricing.tabsPerStrip).toBe(10) // Fallback default
    expect(pricing.dispenseCount).toBe(1)
    expect(pricing.lineTotal).toBe(10.00)
  })
})

describe('AI Vision Camera-to-Bill: LASA Safety Guard', () => {
  it('detects strength conflict between detected Dolo 500 and catalog Dolo 650', () => {
    const check = checkLasaSafety('DOLO', '500mg', '650mg', 0.96)
    expect(check.hasConflict).toBe(true)
    expect(check.requiresPharmacistConfirmation).toBe(true)
    expect(check.warningMessage).toContain('LASA Alert')
  })

  it('flags High-Risk antibiotics (Augmentin) if visual confidence is borderline', () => {
    const check = checkLasaSafety('Augmentin 625 Duo', '625 Duo', '625 Duo', 0.92)
    expect(check.hasConflict).toBe(true)
    expect(check.requiresPharmacistConfirmation).toBe(true)
  })

  it('passes high-confidence non-LASA OTC drugs without blocking checkout', () => {
    const check = checkLasaSafety('Benadryl Cough Syrup', '100ml', '100ml', 0.98)
    expect(check.hasConflict).toBe(false)
    expect(check.requiresPharmacistConfirmation).toBe(false)
  })
})

describe('AI Vision Camera-to-Bill: MultiItemDetector Fixtures', () => {
  it('returns correctly segmented Dolo cut strip from calibrated demo key', async () => {
    const res = await MultiItemDetector.detectCounterItems(Buffer.alloc(0), 'dolo-cut-strip')
    expect(res.totalItemsCount).toBe(1)
    expect(res.hasCutStrips).toBe(true)
    const item = res.items[0]
    expect(item.brandName).toBe('Dolo 650')
    expect(item.itemType).toBe('BLISTER_CUT_STRIP')
    expect(item.blisterDetails?.filledCount).toBe(7)
    expect(item.blisterDetails?.cutCount).toBe(3)
    expect(item.proRataPricing?.lineTotal).toBe(23.52)
  })

  it('correctly classifies Schedule H1 prescription restrictions for Augmentin', async () => {
    const res = await MultiItemDetector.detectCounterItems(Buffer.alloc(0), 'augmentin-schedule-h1')
    expect(res.hasPrescriptionDrugs).toBe(true)
    const item = res.items[0]
    expect(item.drugSchedule).toBe('H1')
    expect(item.isPrescriptionRequired).toBe(true)
    expect(item.requiresConfirmation).toBe(true)
  })

  it('detects multiple mixed items on checkout tray simultaneously', async () => {
    const res = await MultiItemDetector.detectCounterItems(Buffer.alloc(0), 'multi-item-tray')
    expect(res.totalItemsCount).toBe(3)
    expect(res.hasCutStrips).toBe(true)
    expect(res.hasPrescriptionDrugs).toBe(true)
    expect(res.estimatedTotal).toBeGreaterThan(200)
  })
})
