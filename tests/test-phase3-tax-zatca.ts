/**
 * Metapharsic Rx — Phase 3 Test Suite: Sovereign Tax Pipeline & ZATCA Phase 2 E-Invoicing
 * Validates:
 * 1. ZATCA Phase 2 TLV Base64 Generator (Tags 1–8) & SHA-256 Canonical Hashing
 * 2. OASIS UBL 2.1 XML E-Invoice Generator (Simplified Tax Invoice 388 / 0200000)
 * 3. Sovereign Tax Engine across 6 territories (SA, OM, QA, BH, MV, IN)
 * 4. High-Precision 2- vs 3-Decimal Currency Rounding (OMR & BHD strict 3 decimals)
 * 5. Concurrent 5-Thread Execution Pipeline with Microsecond Telemetry
 */

import { generateZatcaTlv, encodeTlvTag } from '../src/lib/tax/zatca-tlv-service'
import {
  calculateSovereignInvoiceTax,
  SovereignLineItemInput,
} from '../src/lib/tax/sovereign-tax-engine'
import { executeMultiThreadTaxPipeline } from '../src/lib/tax/multi-thread-tax-engine'
import { TERRITORIES, TerritoryCode } from '../src/lib/territory/territory-config'
import { formatCurrency } from '../src/lib/territory/currency-service'

async function runPhase3Tests() {
  console.log('======================================================================')
  console.log(' METAPHARSIC RX — PHASE 3: SOVEREIGN TAX & ZATCA E-INVOICING VERIFIER')
  console.log('======================================================================\n')

  let passed = 0
  let failed = 0

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`)
      if (detail) console.log(`     └─ ${detail}`)
      passed++
    } else {
      console.error(`  ❌ FAIL: ${testName}`)
      if (detail) console.error(`     └─ ${detail}`)
      failed++
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST SECTION 1: ZATCA Phase 2 TLV (Tags 1–8) & SHA-256 Hashing
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- [TEST GROUP 1]: ZATCA Phase 2 TLV & SHA-256 Hash Engine ---')
  {
    const samplePayload = {
      sellerName: 'Metapharsic Pharmacare KSA',
      vatRegistrationNumber: '310123456700003',
      invoiceTimestamp: '2026-11-19T14:30:00Z',
      invoiceTotalWithVat: 115.0,
      vatTotal: 15.0,
      invoiceNumber: 'INV-SA-2026-0001',
    }

    const tlvResult = await generateZatcaTlv(samplePayload)

    assert(Boolean(tlvResult.base64Tlv), 'Base64 TLV output generated', `Base64 length: ${tlvResult.base64Tlv.length} chars`)
    assert(tlvResult.invoiceHashHex.length === 64, 'SHA-256 Invoice Hash is 64 hex characters', `Hash: ${tlvResult.invoiceHashHex}`)
    assert(Boolean(tlvResult.qrCodeDataUrl.startsWith('data:image/png;base64,')), 'QR Code DataURL image successfully synthesized')
    assert(tlvResult.tags.tag1_sellerName === samplePayload.sellerName, 'Tag 1 Seller Name matches payload')
    assert(tlvResult.tags.tag2_vatNumber === samplePayload.vatRegistrationNumber, 'Tag 2 VAT Registration Number matches (15 digits)')
    assert(tlvResult.tags.tag4_totalWithVat === '115.00', 'Tag 4 Invoice Total with VAT correctly formatted')
    assert(tlvResult.tags.tag5_vatTotal === '15.00', 'Tag 5 VAT Total correctly formatted')
    assert(Boolean(tlvResult.tags.tag6_hash), 'Tag 6 Cryptographic Digest present for Phase 2')
    assert(Boolean(tlvResult.tags.tag7_publicKey), 'Tag 7 ECDSA Public Key present for Phase 2')
    assert(Boolean(tlvResult.tags.tag8_signature), 'Tag 8 ECDSA Signature present for Phase 2')

    // Validate binary TLV structure
    const decodedBuf = Buffer.from(tlvResult.base64Tlv, 'base64')
    assert(decodedBuf[0] === 1, 'First byte is Tag 1 (0x01)')
    const tag1Len = decodedBuf[1]
    const tag1Val = decodedBuf.subarray(2, 2 + tag1Len).toString('utf-8')
    assert(tag1Val === samplePayload.sellerName, `Tag 1 value matches decoded UTF-8: "${tag1Val}"`)
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST SECTION 2: OASIS UBL 2.1 XML E-Invoice Schema Compliance
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- [TEST GROUP 2]: OASIS UBL 2.1 XML E-Invoice Compliance ---')
  {
    const ublPayload = {
      sellerName: 'Metapharsic Central Pharmacy',
      vatRegistrationNumber: '310987654300003',
      invoiceTimestamp: '2026-11-19T14:30:00Z',
      invoiceTotalWithVat: 200.0,
      vatTotal: 0.0, // SFDA Zero-rated prescription
      invoiceNumber: 'INV-SFDA-8849',
      items: [
        {
          name: 'Atorvastatin 20mg Lipitor',
          quantity: 2,
          unitPrice: 100.0,
          subtotal: 200.0,
          vatRate: 0.0,
          vatAmount: 0.0,
          isZeroRated: true,
          exemptionReason: 'SFDA Registered Human Pharmaceuticals (0% Zero-Rated)',
        },
      ],
    }

    const tlvResult = await generateZatcaTlv(ublPayload)
    const xml = tlvResult.ublXml

    assert(xml.includes('<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"'), 'Root Invoice element with UBL 2.1 namespace')
    assert(xml.includes('<cbc:ProfileID>reporting:1.0</cbc:ProfileID>'), 'ProfileID is reporting:1.0 (ZATCA Simplified)')
    assert(xml.includes('<cbc:InvoiceTypeCode name="0200000">388</cbc:InvoiceTypeCode>'), 'InvoiceTypeCode is 388 with subtype 0200000 (Simplified Tax Invoice)')
    assert(xml.includes('<cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">'), 'Embedded QR Code TLV binary attachment present')
    assert(xml.includes('<cbc:ID>Z</cbc:ID>'), 'ClassifiedTaxCategory is Z (Zero-Rated)')
    assert(xml.includes('VATEX-SA-HEALTH'), 'Tax Exemption code VATEX-SA-HEALTH present for SFDA human pharmaceuticals')
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST SECTION 3: Sovereign Multi-Territory Tax Calculation & Precision
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- [TEST GROUP 3]: Sovereign Multi-Territory Tax Engine & Decimals ---')
  {
    const items: SovereignLineItemInput[] = [
      {
        name: 'Augmentin 625mg Prescription Antibiotic',
        quantity: 2,
        unitPrice: 30.0,
        isPrescription: true,
        category: 'MEDICINE',
        hsnCode: '3004',
      },
      {
        name: 'Dermocosmetic Sunscreen Cream SPF 50+',
        quantity: 1,
        unitPrice: 40.0,
        isPrescription: false,
        category: 'COSMETIC',
        hsnCode: '3304',
      },
    ]

    // 1. Saudi Arabia (KSA)
    const ksaBreakdown = calculateSovereignInvoiceTax(items, 'SA')
    assert(ksaBreakdown.currencyCode === 'SAR', 'KSA currency is SAR')
    assert(ksaBreakdown.currencyDecimals === 2, 'KSA precision is 2 decimals')
    assert(ksaBreakdown.taxableZeroRatedBase === 60.0, 'KSA prescription drug is 0% Zero-Rated (SAR 60.00)', `Zero-rated base: SAR ${ksaBreakdown.taxableZeroRatedBase}`)
    assert(ksaBreakdown.taxableStandardBase === 40.0, 'KSA cosmetic is 15% Standard VAT (SAR 40.00)', `Standard base: SAR ${ksaBreakdown.taxableStandardBase}`)
    assert(ksaBreakdown.totalTax === 6.0, 'KSA total VAT is SAR 6.00 (15% of 40)', `Tax total: SAR ${ksaBreakdown.totalTax}`)
    assert(ksaBreakdown.grandTotal === 106.0, 'KSA grand total is SAR 106.00', `Grand total: SAR ${ksaBreakdown.grandTotal}`)

    // 2. Oman (OM) - 3 Decimals, 5% standard VAT, 0% MoH medicine
    const omanItems: SovereignLineItemInput[] = [
      {
        name: 'Augmentin 625mg',
        quantity: 1,
        unitPrice: 4.5,
        isPrescription: true,
        category: 'MEDICINE',
      },
      {
        name: 'Cosmetic Cream',
        quantity: 1,
        unitPrice: 2.125,
        isPrescription: false,
        category: 'COSMETIC',
      },
    ]
    const omanBreakdown = calculateSovereignInvoiceTax(omanItems, 'OM')
    assert(omanBreakdown.currencyCode === 'OMR', 'Oman currency is OMR')
    assert(omanBreakdown.currencyDecimals === 3, 'Oman precision is strictly 3 decimals (Baisa)')
    assert(omanBreakdown.taxableZeroRatedBase === 4.5, 'Oman prescription drug is 0% Zero-Rated (OMR 4.500)')
    assert(omanBreakdown.taxableStandardBase === 2.125, 'Oman cosmetic taxable base is OMR 2.125')
    const expectedOmanVat = Math.round((2.125 * 0.05 + Number.EPSILON) * 1000) / 1000
    assert(omanBreakdown.totalTax === expectedOmanVat, `Oman 5% VAT calculated to 3 decimals (OMR ${expectedOmanVat.toFixed(3)})`)
    assert(omanBreakdown.formattedGrandTotalEn.includes('OMR'), 'Formatted string contains OMR symbol')

    // 3. Bahrain (BH) - 3 Decimals, 10% standard VAT, 0% NHRA medicine
    const bahrainItems: SovereignLineItemInput[] = [
      {
        name: 'Prescription Insulin Pen',
        quantity: 1,
        unitPrice: 8.75,
        isPrescription: true,
        category: 'MEDICINE',
      },
      {
        name: 'Vitamin C Effervescent',
        quantity: 1,
        unitPrice: 3.5,
        isPrescription: false,
        category: 'SUPPLEMENT',
      },
    ]
    const bhBreakdown = calculateSovereignInvoiceTax(bahrainItems, 'BH')
    assert(bhBreakdown.currencyCode === 'BHD', 'Bahrain currency is BHD')
    assert(bhBreakdown.currencyDecimals === 3, 'Bahrain precision is strictly 3 decimals (Fils)')
    assert(bhBreakdown.taxableZeroRatedBase === 8.75, 'Bahrain NHRA medicine is 0% Zero-Rated (BHD 8.750)')
    assert(bhBreakdown.totalTax === 0.35, 'Bahrain 10% VAT on supplement is BHD 0.350', `Total VAT: BHD ${bhBreakdown.totalTax.toFixed(3)}`)

    // 4. Qatar (QA) - 0% standard regime
    const qatarBreakdown = calculateSovereignInvoiceTax(items, 'QA')
    assert(qatarBreakdown.currencyCode === 'QAR', 'Qatar currency is QAR')
    assert(qatarBreakdown.totalTax === 0.0, 'Qatar total VAT is 0.00 (MoPH Healthcare Regime)')

    // 5. Maldives (MV) - 8% GGST + Aasandha Health Scheme
    const maldivesItems: SovereignLineItemInput[] = [
      {
        name: 'Essential Antihypertensive Amlodipine',
        quantity: 1,
        unitPrice: 120.0,
        isPrescription: true,
        category: 'MEDICINE',
        aasandhaCovered: true,
        aasandhaCopayPercent: 0, // Fully covered by national insurance
      },
      {
        name: 'Sun Care Face Gel',
        quantity: 1,
        unitPrice: 80.0,
        isPrescription: false,
        category: 'COSMETIC',
      },
    ]
    const mvBreakdown = calculateSovereignInvoiceTax(maldivesItems, 'MV')
    assert(mvBreakdown.currencyCode === 'MVR', 'Maldives currency is MVR')
    assert(mvBreakdown.aasandhaTotalCoverage === 120.0, 'Aasandha government subsidy separated (MVR 120.00)')
    assert(mvBreakdown.totalTax === 6.4, 'Maldives 8% GGST on cosmetic is MVR 6.40 (8% of 80)')
    assert(mvBreakdown.patientNetPayable === 86.4, 'Patient net payable is only MVR 86.40 (80 + 6.40 tax, medicine covered)')

    // 6. India (IN) - Multi-Slab GST
    const inBreakdown = calculateSovereignInvoiceTax(items, 'IN')
    assert(inBreakdown.currencyCode === 'INR', 'India currency is INR')
    assert(inBreakdown.regime === 'GST', 'India regime is GST')
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST SECTION 4: Multi-Thread Invoicing Pipeline (5 Parallel Threads)
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- [TEST GROUP 4]: 5-Thread Concurrent Pipeline & Telemetry ---')
  {
    const pipelineInput = {
      invoiceNumber: 'INV-GCC-2026-9041',
      saleDate: '2026-11-19T15:00:00Z',
      territoryCode: 'SA' as TerritoryCode,
      seller: {
        name: 'Metapharsic Rx Hospital Pharmacy',
        vatRegistrationNumber: '310123456700003',
        city: 'Riyadh',
      },
      customer: {
        name: 'Sovereign Patient Audit Test',
      },
      items: [
        {
          name: 'Augmentin 1g SFDA Registered Human Antibiotic',
          nameAr: 'أوجمنتين ١ غرام مضاد حيوي بشري مسجل',
          quantity: 2,
          unitPrice: 45.0,
          isPrescription: true,
          category: 'MEDICINE' as const,
        },
        {
          name: 'Medical Grade Hand Sanitizer 500ml',
          nameAr: 'معقم يدين طبي ٥٠٠ مل',
          quantity: 1,
          unitPrice: 20.0,
          isPrescription: false,
          category: 'DEVICE' as const,
        },
      ],
    }

    const pipelineResult = await executeMultiThreadTaxPipeline(pipelineInput)

    assert(pipelineResult.success === true, 'Pipeline executed successfully')
    assert(pipelineResult.threads.length === 5, 'Dispatched exactly 5 concurrent worker threads')
    assert(pipelineResult.totalDurationMs < 40.0, `Total pipeline latency is ${pipelineResult.totalDurationMs}ms (< 40ms SLA)`)

    const threadCodes = pipelineResult.threads.map((t) => t.code)
    assert(threadCodes.includes('THREAD_TAX_CALC'), 'Thread 1: THREAD_TAX_CALC executed')
    assert(threadCodes.includes('THREAD_TLV_QR'), 'Thread 2: THREAD_TLV_QR executed')
    assert(threadCodes.includes('THREAD_UBL_XML'), 'Thread 3: THREAD_UBL_XML executed')
    assert(threadCodes.includes('THREAD_ZERO_RATING_AUDIT'), 'Thread 4: THREAD_ZERO_RATING_AUDIT executed')
    assert(threadCodes.includes('THREAD_ERP_SYNC'), 'Thread 5: THREAD_ERP_SYNC executed')

    console.log('\n  Live Microsecond Telemetry Table:')
    for (const t of pipelineResult.threads) {
      console.log(`    • [${t.code}] ${t.name}: ${t.status} in ${t.durationMs}ms — ${t.details}`)
    }

    assert(pipelineResult.regulatoryAudit.compliant === true, 'Regulatory audit verified 100% compliance')
    assert(pipelineResult.erpPayload.tallyXmlReady === true, 'ERP sync Tally/Marg XML payload compiled')
    assert(Boolean(pipelineResult.tlvResult?.qrCodeDataUrl), 'ZATCA Phase 2 high-res QR DataURL generated in pipeline')
  }

  // ─────────────────────────────────────────────────────────────────
  // FINAL BENCHMARK SUMMARY
  // ─────────────────────────────────────────────────────────────────
  console.log('\n======================================================================')
  console.log(` TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`)
  console.log('======================================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runPhase3Tests().catch((err) => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
