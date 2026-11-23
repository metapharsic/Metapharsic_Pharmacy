import {
  SOVEREIGN_TAX_PROFILES,
  getTerritoryTaxProfile,
  processSovereignTaxData,
  generateSovereignTaxCsv,
  generateSovereignTaxJson,
} from '../src/lib/territory/sovereign-tax-service'
import type { SaleForTally } from '../src/lib/tally/tally-xml-builder'

async function runTests() {
  console.log('--- Testing Sovereign Regional Tax & VAT Implementation ---')

  // 1. Verify all 6 territories have complete tax profiles
  const territories = ['OM', 'SA', 'BH', 'QA', 'MV', 'IN'] as const
  for (const t of territories) {
    const profile = getTerritoryTaxProfile(t)
    console.log(`[OK] Territory ${t}: Regime = ${profile.regime}, Form = ${profile.formCode}, Currency = ${profile.currency} (${profile.decimals} dec), Rate = ${profile.standardRate}%`)
    if (!profile.authorityNameEn || !profile.formTitleEn || !profile.reportTabLabelEn) {
      throw new Error(`Profile for ${t} is missing essential fields`)
    }
  }

  // 2. Test Oman (OM) OTA VAT calculations
  const mockSales: SaleForTally[] = [
    {
      id: 'sale-1',
      invoiceNumber: 'OM-INV-001',
      saleDate: new Date('2026-11-23'),
      totalAmount: 105.000,
      taxAmount: 5.000,
      customer: { name: 'Sultan Hospital', gstin: 'OM12345678', state: 'Muscat' },
      items: [
        {
          product: { name: 'Standard Medical Equipment', sku: 'MED-01', unitOfMeasure: 'PCS' },
          quantity: 1,
          unitPrice: 100.000,
          totalAmount: 105.000,
          taxAmount: 5.000,
        },
      ],
      payments: [{ method: 'CASH', amount: 105.000 }],
    },
    {
      id: 'sale-2',
      invoiceNumber: 'OM-INV-002',
      saleDate: new Date('2026-11-23'),
      totalAmount: 50.000,
      taxAmount: 0.000, // 0% zero-rated human prescription medicine
      customer: { name: 'Ahmed Al-Balushi', state: 'Muscat' },
      items: [
        {
          product: { name: 'Amoxicillin 500mg (MoH Registered)', sku: 'AMX-500', unitOfMeasure: 'BOX' },
          quantity: 2,
          unitPrice: 25.000,
          totalAmount: 50.000,
          taxAmount: 0.000,
        },
      ],
      payments: [{ method: 'CASH', amount: 50.000 }],
    },
  ]

  const omanData = processSovereignTaxData(mockSales, [], 'OM')
  console.log('\nOman (OM) Tax Breakdown:')
  console.log(`  Total Gross Sales: ${omanData.totalGrossSales} OMR`)
  console.log(`  Box 1 Standard 5% Taxable: ${omanData.box1StandardTaxable} OMR, Tax: ${omanData.box1StandardTax} OMR`)
  console.log(`  Box 2 Zero-Rated Medicines (0%): ${omanData.box2ZeroRatedTaxable} OMR`)
  console.log(`  Box 4 Total Output VAT: ${omanData.totalOutputTax} OMR`)
  console.log(`  Box 6 Net VAT Payable to OTA: ${omanData.netTaxPayable} OMR`)

  if (omanData.box1StandardTaxable !== 100 || omanData.box1StandardTax !== 5) {
    throw new Error('Oman Box 1 calculation mismatch')
  }
  if (omanData.box2ZeroRatedTaxable !== 50) {
    throw new Error('Oman Box 2 zero-rated medicine calculation mismatch')
  }
  if (omanData.netTaxPayable !== 5) {
    throw new Error('Oman Net VAT payable mismatch')
  }

  // 3. Test Oman CSV generation
  const omanCsv = generateSovereignTaxCsv(omanData, { startDate: '2026-11-01', endDate: '2026-11-23' })
  if (!omanCsv.includes('Oman Tax Authority (OTA)') || !omanCsv.includes('Form 101') || !omanCsv.includes('OMR')) {
    throw new Error('Oman CSV format missing key statutory headers')
  }
  console.log('[OK] Oman CSV generated successfully with OTA Form 101 header and OMR currency!')

  // 4. Test Oman JSON generation
  const omanJsonStr = generateSovereignTaxJson(omanData, { startDate: '2026-11-01', endDate: '2026-11-23' })
  const omanJson = JSON.parse(omanJsonStr)
  if (omanJson.metadata.regime !== 'OTA' || omanJson.metadata.currency !== 'OMR') {
    throw new Error('Oman JSON format missing regime or currency metadata')
  }
  console.log('[OK] Oman JSON generated successfully with OTA metadata schema!')

  console.log('\nALL SOVEREIGN REGIONAL TAX & VAT TESTS PASSED!')
}

runTests().catch((err) => {
  console.error(err)
  process.exit(1)
})
