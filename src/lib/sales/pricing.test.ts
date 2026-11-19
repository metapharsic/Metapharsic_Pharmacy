import {
  computeItemPricing,
  computeItemProfit,
  computeSaleProfit,
  computeSaleTotals,
  round2,
} from '@/lib/sales/pricing'

describe('round2', () => {
  it('rounds to 2 decimal places', () => {
    expect(round2(0)).toBe(0)
    expect(round2(1.005)).toBe(1.01)
    expect(round2(31.5)).toBe(31.5)
    expect(round2(2.345)).toBe(2.35)
  })
})

describe('computeItemPricing (GST exclusive — default)', () => {
  const base = {
    mrp: 100,
    gstRate: 12,
    cgstRate: 6,
    sgstRate: 6,
    igstRate: 0,
    isGstExempt: false,
    taxInclusive: false,
  }

  it('computes gross, tax split and final total for a line', () => {
    const line = computeItemPricing({ ...base, quantity: 2 })
    expect(line).toMatchObject({
      unitPrice: 100,
      grossAmount: 200,
      discountAmount: 0,
      lineAmount: 200,
      taxableAmount: 200,
      cgstAmount: 12,
      sgstAmount: 12,
      igstAmount: 0,
      taxAmount: 24,
      totalAmount: 224,
    })
  })

  it('applies discount on the MRP before GST', () => {
    const line = computeItemPricing({ ...base, quantity: 1, discountPercent: 10 })
    expect(line.grossAmount).toBe(100)
    expect(line.discountAmount).toBe(10)
    expect(line.lineAmount).toBe(90)
    expect(line.taxableAmount).toBe(90)
    expect(line.cgstAmount).toBe(5.4)
    expect(line.sgstAmount).toBe(5.4)
    expect(line.taxAmount).toBe(10.8)
    expect(line.totalAmount).toBe(100.8)
  })

  it('zeroes tax for GST-exempt products', () => {
    const line = computeItemPricing({ ...base, isGstExempt: true, quantity: 1 })
    expect(line.taxAmount).toBe(0)
    expect(line.cgstAmount).toBe(0)
    expect(line.totalAmount).toBe(100)
  })

  it('zeroes tax when the stored GST rate is 0', () => {
    const line = computeItemPricing({ ...base, cgstRate: 0, sgstRate: 0, gstRate: 0, quantity: 3 })
    expect(line.taxPercent).toBe(0)
    expect(line.totalAmount).toBe(300)
  })
})

describe('computeItemPricing (IGST — inter-state)', () => {
  it('uses igstRate when supplied (regression: igstPercent was hardcoded to 0)', () => {
    // Inter-state sale: CGST=0, SGST=0, IGST=18%
    const line = computeItemPricing({
      mrp: 100,
      gstRate: 18,
      cgstRate: 0,
      sgstRate: 0,
      igstRate: 18,
      isGstExempt: false,
      taxInclusive: false,
      quantity: 1,
    })
    expect(line.igstPercent).toBe(18)
    expect(line.igstAmount).toBe(18)
    expect(line.cgstAmount).toBe(0)
    expect(line.sgstAmount).toBe(0)
    expect(line.taxableAmount).toBe(100)
    expect(line.totalAmount).toBe(118)
  })
})

describe('computeItemPricing (tax inclusive)', () => {
  it('backs out the embedded tax without changing the line total', () => {
    const line = computeItemPricing({
      mrp: 112,
      gstRate: 12,
      cgstRate: 6,
      sgstRate: 6,
      igstRate: 0,
      isGstExempt: false,
      taxInclusive: true,
      quantity: 1,
    })
    expect(line.lineAmount).toBe(112)
    expect(line.taxableAmount).toBe(100)
    expect(line.taxAmount).toBe(12)
    expect(line.totalAmount).toBe(112)
  })
})

describe('computeSaleTotals', () => {
  const a = computeItemPricing({
    mrp: 100,
    gstRate: 12,
    cgstRate: 6,
    sgstRate: 6,
    igstRate: 0,
    isGstExempt: false,
    taxInclusive: false,
    quantity: 1,
  }) // 112
  const b = computeItemPricing({
    mrp: 50,
    gstRate: 0,
    cgstRate: 0,
    sgstRate: 0,
    igstRate: 0,
    isGstExempt: false,
    taxInclusive: false,
    quantity: 1,
  }) // 50

  it('aggregates line totals and tax', () => {
    const totals = computeSaleTotals([a, b], { taxInclusive: false, roundOffTotal: false })
    expect(totals.subtotal).toBe(150)
    expect(totals.taxAmount).toBe(12)
    expect(totals.cgstAmount).toBe(6)
    expect(totals.sgstAmount).toBe(6)
    expect(totals.rawTotalAmount).toBe(162)
    expect(totals.totalAmount).toBe(162)
    expect(totals.roundOffDifference).toBe(0)
  })

  it('rounds the final total to the nearest rupee when enabled', () => {
    const c = computeItemPricing({
      mrp: 10.5,
      gstRate: 0,
      cgstRate: 0,
      sgstRate: 0,
      igstRate: 0,
      isGstExempt: false,
      taxInclusive: false,
      quantity: 3,
    }) // 31.5
    const totals = computeSaleTotals([c], { taxInclusive: false, roundOffTotal: true })
    expect(totals.rawTotalAmount).toBe(31.5)
    expect(totals.totalAmount).toBe(32)
    expect(totals.roundOffDifference).toBe(0.5)
  })

  it('derives an informative aggregate discount percent', () => {
    const d = computeItemPricing({
      mrp: 100,
      gstRate: 12,
      cgstRate: 6,
      sgstRate: 6,
      igstRate: 0,
      isGstExempt: false,
      taxInclusive: false,
      quantity: 1,
      discountPercent: 10,
    })
    const totals = computeSaleTotals([d], { taxInclusive: false, roundOffTotal: false })
    expect(totals.discountAmount).toBe(10)
    expect(totals.discountPercent).toBe(10)
  })
})

describe('computeItemProfit', () => {
  it('computes line profit using batch purchase price', () => {
    const res = computeItemProfit({
      quantity: 10,
      totalAmount: 1000,
      itemBatches: [
        {
          quantity: 10,
          batch: { purchasePrice: 70 },
        },
      ],
    })
    expect(res.lineRevenue).toBe(1000)
    expect(res.lineCost).toBe(700)
    expect(res.lineProfit).toBe(300)
    expect(res.lineProfitPct).toBe(30)
    expect(res.effectiveCostBasis).toBe(70)
    expect(res.isComplete).toBe(true)
    expect(res.unpricedUnits).toBe(0)
  })

  it('handles multi-batch split allocation with different costs', () => {
    const res = computeItemProfit({
      quantity: 10,
      totalAmount: 1200,
      itemBatches: [
        { quantity: 6, batch: { purchasePrice: 60 } },
        { quantity: 4, batch: { purchasePrice: 75 } },
      ],
    })
    // 6 * 60 = 360, 4 * 75 = 300 => 660
    expect(res.lineCost).toBe(660)
    expect(res.lineProfit).toBe(540)
    expect(res.lineProfitPct).toBe(45)
    expect(res.effectiveCostBasis).toBe(66)
    expect(res.isComplete).toBe(true)
  })

  it('falls back to product costPrice or ptr when batch purchasePrice is missing', () => {
    const res = computeItemProfit({
      quantity: 5,
      totalAmount: 500,
      product: { costPrice: 60, ptr: 80 },
    })
    expect(res.lineCost).toBe(300)
    expect(res.lineProfit).toBe(200)
    expect(res.lineProfitPct).toBe(40)
    expect(res.isComplete).toBe(true)
  })

  it('flags unpriced units when no cost basis exists', () => {
    const res = computeItemProfit({
      quantity: 4,
      totalAmount: 400,
    })
    expect(res.lineCost).toBe(0)
    expect(res.lineProfit).toBe(400)
    expect(res.unpricedUnits).toBe(4)
    expect(res.isComplete).toBe(false)
  })

  it('calculates pro-rated per-tablet cost and profit for 1-tablet sale', () => {
    const res = computeItemProfit({
      quantity: 1,
      totalAmount: 2.24,
      isTabletSale: true,
      tabsPerStrip: 15,
      itemBatches: [
        {
          quantity: 1,
          batch: { purchasePrice: 21 },
        },
      ],
    })
    // 21 / 15 = 1.40 cost
    expect(res.lineRevenue).toBe(2.24)
    expect(res.lineCost).toBe(1.4)
    expect(res.lineProfit).toBe(0.84)
    expect(res.lineProfitPct).toBe(37.5)
    expect(res.effectiveCostBasis).toBe(1.4)
    expect(res.isComplete).toBe(true)
  })

  it('detects tablet sale from productName regex and computes tablet economics', () => {
    const res = computeItemProfit({
      quantity: 2,
      totalAmount: 4.48,
      productName: 'Dolo 650 Tablet (2 Tabs)',
      product: {
        costPrice: 21,
        tabsPerStrip: 15,
      },
    })
    // (21 / 15) * 2 = 2.80 cost
    expect(res.lineRevenue).toBe(4.48)
    expect(res.lineCost).toBe(2.8)
    expect(res.lineProfit).toBe(1.68)
    expect(res.lineProfitPct).toBe(37.5)
  })

  it('keeps full strip cost when not a tablet sale even if tabsPerStrip is set', () => {
    const res = computeItemProfit({
      quantity: 1,
      totalAmount: 33.6,
      productName: 'Dolo 650 Tablet',
      product: {
        costPrice: 21,
        tabsPerStrip: 15,
      },
    })
    expect(res.lineCost).toBe(21)
    expect(res.lineProfit).toBe(12.6)
  })
})


describe('computeSaleProfit', () => {
  it('aggregates sale items into invoice purchase cost and profit', () => {
    const sale = {
      totalAmount: 1500,
      items: [
        {
          quantity: 10,
          totalAmount: 1000,
          itemBatches: [{ quantity: 10, batch: { purchasePrice: 70 } }],
        },
        {
          quantity: 5,
          totalAmount: 500,
          itemBatches: [{ quantity: 5, batch: { purchasePrice: 40 } }],
        },
      ],
    }
    const res = computeSaleProfit(sale)
    expect(res.revenue).toBe(1500)
    expect(res.purchaseCost).toBe(900) // 700 + 200
    expect(res.profitAmount).toBe(600)
    expect(res.profitPct).toBe(40)
    expect(res.purchaseCostComplete).toBe(true)
    expect(res.purchaseUnpricedUnits).toBe(0)
  })
})
