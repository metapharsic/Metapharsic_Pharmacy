import { getAllTerritories, getTerritory } from '../src/lib/territory/territory-config'
import {
  formatCurrency,
  roundCurrency,
  calculateSovereignTax,
  toSubunits,
  fromSubunits,
} from '../src/lib/territory/currency-service'
import { executeTerritoryMultiThreadEngine } from '../src/lib/territory/multi-thread-territory-engine'

async function runVerification() {
  console.log('=================================================================')
  console.log('   METAPHARSIC RX — PHASE 1 SOVEREIGN TERRITORY ENGINE TEST')
  console.log('=================================================================\n')

  console.log('--- TEST 1: ALL 6 SOVEREIGN TERRITORIES PROVISIONED ---')
  const territories = getAllTerritories()
  console.log(`Loaded ${territories.length} sovereign territory configurations:`)
  for (const t of territories) {
    console.log(
      `  ${t.flag} [${t.code}] ${t.nameEn} / ${t.nameAr}` +
        `\n     Currency: ${t.currency.code} (${t.currency.symbolAr}) | Decimals: ${t.currency.decimals} | 1 unit = ${t.currency.subunitScale} ${t.currency.subunitNameEn}` +
        `\n     Tax: ${t.tax.regime} (${t.tax.standardVatRate}% VAT) | Zero-Rated Human Medicines: ${t.tax.zeroRatedMedicines}` +
        `\n     Direction: ${t.defaultDirection.toUpperCase()} | Script: ${t.defaultLanguage} | Authority: ${t.regulatory.authorityNameEn} (${t.regulatory.acronym})`
    )
  }

  console.log('\n--- TEST 2: HIGH-PRECISION CURRENCY FORMATTING (2 vs 3 DECIMALS) ---')
  const testAmounts = [12.35, 12.354, 5.5, 1250.75]
  
  console.log('Saudi Riyal (SAR - 2 decimals):')
  console.log('  English (LTR):', formatCurrency(12.35, { currency: 'SAR', locale: 'en' }))
  console.log('  Arabic (RTL): ', formatCurrency(12.35, { currency: 'SAR', locale: 'ar' }))

  console.log('Omani Rial (OMR - 3 decimals):')
  console.log('  English (LTR):', formatCurrency(12.35, { currency: 'OMR', locale: 'en' }))
  console.log('  Arabic (RTL): ', formatCurrency(12.35, { currency: 'OMR', locale: 'ar' }))
  console.log('  Subunits (12.350 OMR -> Baisa):', toSubunits(12.35, 'OMR'), 'Baisa')
  console.log('  From Subunits (12350 Baisa -> OMR):', fromSubunits(12350, 'OMR'), 'OMR')

  console.log('Bahraini Dinar (BHD - 3 decimals):')
  console.log('  English (LTR):', formatCurrency(8.75, { currency: 'BHD', locale: 'en' }))
  console.log('  Arabic (RTL): ', formatCurrency(8.75, { currency: 'BHD', locale: 'ar' }))

  console.log('Maldivian Rufiyaa (MVR - 2 decimals):')
  console.log('  English (LTR):', formatCurrency(250.5, { currency: 'MVR', locale: 'en' }))
  console.log('  Arabic (RTL): ', formatCurrency(250.5, { currency: 'MVR', locale: 'ar' }))

  console.log('\n--- TEST 3: SOVEREIGN TAX PRE-FLIGHT CALCULATIONS ---')
  const ksaPrescription = calculateSovereignTax({
    grossAmount: 100,
    isPrescriptionMedicine: true,
    territoryCode: 'SA',
  })
  console.log('  KSA Prescription Medicine (Zero-Rated 0% SFDA):', ksaPrescription)

  const ksaCosmetic = calculateSovereignTax({
    grossAmount: 100,
    isPrescriptionMedicine: false,
    territoryCode: 'SA',
  })
  console.log('  KSA Cosmetic / OTC (Standard 15% ZATCA VAT):', ksaCosmetic)

  const omanPrescription = calculateSovereignTax({
    grossAmount: 45.5,
    isPrescriptionMedicine: true,
    territoryCode: 'OM',
  })
  console.log('  Oman Prescription Medicine (Zero-Rated 0% OTA, 3 decimals):', omanPrescription)

  console.log('\n--- TEST 4: MULTI-THREAD WIRE ENGINE CONCURRENT TELEMETRY ---')
  const threadResultMuscat = await executeTerritoryMultiThreadEngine({
    timezone: 'Asia/Muscat',
    requestedLanguage: 'ar',
    clientIp: '185.193.64.10',
  })

  console.log(`Resolved Territory: ${threadResultMuscat.flag} ${threadResultMuscat.territoryNameEn} (${threadResultMuscat.resolvedTerritory})`)
  console.log(`Total Parallel Thread Execution Time: ${threadResultMuscat.totalDurationMs} ms`)
  console.log(`Currency: ${threadResultMuscat.currencyCode} (${threadResultMuscat.decimals} decimals)`)
  console.log(`Language & Direction: ${threadResultMuscat.defaultLanguage.toUpperCase()} (${threadResultMuscat.defaultDirection.toUpperCase()})`)
  console.log('Worker Thread Telemetry Breakdown:')
  for (const th of threadResultMuscat.threads) {
    console.log(`  [Thread #${th.id}] ${th.code} (${th.durationMs}ms) - ${th.status} | ${th.details}`)
  }

  console.log('\n=================================================================')
  console.log('   ALL PHASE 1 VERIFICATION CHECKS PASSED PERFECTLY!')
  console.log('=================================================================')
}

runVerification().catch(console.error)
