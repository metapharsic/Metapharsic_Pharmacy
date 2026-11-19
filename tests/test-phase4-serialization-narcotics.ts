/**
 * Metapharsic Rx — Phase 4 Test Suite: Pharmaceutical Serialization & Sovereign Narcotics
 * Validates:
 * 1. GS1 2D DataMatrix Parser (Human-Readable & Raw FNC1 Strings)
 * 2. GTIN-14 Modulo 10 Checksum Validation
 * 3. Sovereign Narcotic Validation Gates (KSA SFDA, Oman MoH, Bahrain NHRA, Qatar MoPH, Maldives, India)
 * 4. ESC/POS Arabic Letter Shaping & Bilingual Receipt Byte-Stream Builder
 * 5. Concurrent 5-Thread Serialization & Dispensing Preflight Pipeline (< 30ms SLA)
 */

import {
  parseGs1DataMatrix,
  validateGtinCheckDigit,
  calculateGtinCheckDigit,
  parseGs1Date,
  encodeGs1String,
} from '../src/lib/serialization/gs1-parser'
import {
  validateNarcoticDispensing,
  createSovereignNarcoticRecord,
  resolveDrugClassification,
} from '../src/lib/narcotics/sovereign-narcotics-service'
import {
  shapeArabicText,
  buildEscPosBilingualReceipt,
} from '../src/lib/printing/escpos-arabic-raster'
import { executeMultiThreadSerialization } from '../src/lib/serialization/multi-thread-serialization-engine'

async function runPhase4Tests() {
  console.log('======================================================================')
  console.log(' METAPHARSIC RX — PHASE 4: PHARMACEUTICAL SERIALIZATION & NARCOTICS')
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
  // TEST SECTION 1: GS1 2D DataMatrix Barcode Parser
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- [TEST GROUP 1]: GS1 2D DataMatrix Decomposition & Checksums ---')
  {
    // Test 1: Human-readable parentheses format
    const hrBarcode = '(01)06285000000018(17)261231(10)LOT789A(21)SN12345678'
    const parsed1 = parseGs1DataMatrix(hrBarcode)

    assert(parsed1.isGs1 === true, 'Detected as valid GS1 barcode')
    assert(parsed1.format === 'PARENTHESES', 'Recognized PARENTHESES format')
    assert(parsed1.gtin === '06285000000018', `Extracted GTIN-14: ${parsed1.gtin}`)
    assert(parsed1.gtin13 === '6285000000018', `Derived GTIN-13: ${parsed1.gtin13}`)
    assert(parsed1.batchNumber === 'LOT789A', `Extracted Batch Number: ${parsed1.batchNumber}`)
    assert(parsed1.serialNumber === 'SN12345678', `Extracted Serial Number: ${parsed1.serialNumber}`)
    assert(parsed1.expiryDateString === '2026-12-31', `Extracted Expiry Date: ${parsed1.expiryDateString}`)
    assert(parsed1.isExpired === false, 'Correctly flagged as not expired')
    assert(parsed1.tatmeenPayload?.sn === 'SN12345678', 'SFDA Tatmeen serialization payload compiled')
    assert(parsed1.munshaatPayload?.lot === 'LOT789A', 'NHRA Munsha\'at serialization payload compiled')

    // Test 2: Raw Scanner string with ASCII 29 <GS> FNC1 delimiter
    const GS = '\x1D'
    const rawBarcode = `]d201062850000000181726123110LOT789A${GS}21SN998877`
    const parsed2 = parseGs1DataMatrix(rawBarcode)

    assert(parsed2.isGs1 === true, 'Parsed raw DataMatrix with ]d2 symbology header and <GS>')
    assert(parsed2.gtin === '06285000000018', 'GTIN-14 extracted from raw FNC1')
    assert(parsed2.batchNumber === 'LOT789A', 'Batch extracted from variable AI 10 before <GS>')
    assert(parsed2.serialNumber === 'SN998877', 'Serial number extracted after <GS>')

    // Test 3: GTIN-14 Check Digit Modulo 10
    const validGtin = '06285000000012'
    const isValid = validateGtinCheckDigit(validGtin)
    assert(isValid === true, 'GTIN-14 check digit modulo 10 algorithm verified valid')

    const calculatedDigit = calculateGtinCheckDigit('0628500000001')
    assert(calculatedDigit === 2, `Calculated check digit is 2 (expected 2)`)

    // Test 4: GS1 YYMMDD Date Parser (including month end DD=00 rule)
    const date1 = parseGs1Date('261231')
    assert(date1?.dateString === '2026-12-31', 'Standard date parsed correctly (2026-12-31)')

    const dateMonthEnd = parseGs1Date('260200') // February leap year / month end
    assert(dateMonthEnd?.dateString === '2026-02-28', 'GS1 DD=00 correctly resolves to last day of February (2026-02-28)')

    // Test 5: Encoder round-trip
    const encoded = encodeGs1String({
      gtin: '6285000000018',
      expiryDate: '2026-12-31',
      batch: 'BATCH42',
      serial: 'SER99',
    })
    assert(encoded.humanReadable === '(01)06285000000018(17)261231(10)BATCH42(21)SER99', 'Encoder generated exact GS1 string')
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST SECTION 2: Sovereign Controlled Substances & Narcotic Gates
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- [TEST GROUP 2]: Sovereign Narcotic Regulatory Gates ---')
  {
    // Test 1: Non-controlled substance passes through freely
    const nonControlled = validateNarcoticDispensing({
      territoryCode: 'SA',
      drugClassification: 'NON_CONTROLLED',
      productName: 'Paracetamol 500mg',
      quantity: 1,
      patient: { name: 'Ali Al-Salem' },
      prescriber: { name: 'Dr. Mohammed' },
      prescription: { prescriptionNumber: 'RX-1001' },
    })
    assert(nonControlled.isControlled === false, 'Standard medicine marked non-controlled')
    assert(nonControlled.allowed === true, 'Dispensing allowed without narcotic registry')

    // Test 2: Saudi Arabia SFDA Controlled Drug Gate (Missing Iqama / National ID)
    const ksaBlocked = validateNarcoticDispensing({
      territoryCode: 'SA',
      drugClassification: 'SFDA_CONTROLLED',
      productName: 'Morphine Sulfate 10mg',
      quantity: 1,
      patient: { name: 'Ahmed' }, // Missing nationalId
      prescriber: { name: 'Dr. Faisal', licenseNumber: 'SCFHS-49912' },
      prescription: { prescriptionNumber: 'RX-SFDA-99' },
    })
    assert(ksaBlocked.isControlled === true, 'Morphine identified as SFDA_CONTROLLED')
    assert(ksaBlocked.allowed === false, 'Dispensing BLOCKED when Saudi National ID/Iqama is missing')
    assert(ksaBlocked.missingRequirements.some((r) => r.includes('هوية وطنية / إقامة')), 'SFDA Arabic/English Iqama requirement flagged')

    // Test 3: Saudi Arabia SFDA Controlled Drug Gate (Valid 10-digit Iqama & SCFHS Doctor)
    const ksaAllowed = validateNarcoticDispensing({
      territoryCode: 'SA',
      drugClassification: 'SFDA_CONTROLLED',
      productName: 'Morphine Sulfate 10mg',
      quantity: 1,
      patient: { name: 'Ahmed Al-Ghamdi', nationalId: '1098765432' }, // Valid Saudi citizen ID starting with 1
      prescriber: { name: 'Dr. Faisal', licenseNumber: 'SCFHS-49912' },
      prescription: { prescriptionNumber: 'RX-SFDA-99' },
    })
    assert(ksaAllowed.allowed === true, 'Dispensing ALLOWED with valid 10-digit National ID & SCFHS License')
    assert(Boolean(ksaAllowed.auditChecksum), `Tamper-proof SHA-256 audit checksum generated: ${ksaAllowed.auditChecksum?.substring(0, 16)}...`)

    // Test 4: Oman MoH Controlled Medicines Form
    const omanAllowed = validateNarcoticDispensing({
      territoryCode: 'OM',
      drugClassification: 'MOH_CONTROLLED_1',
      productName: 'Fentanyl Transdermal 25mcg',
      quantity: 1,
      patient: { name: 'Salim Al-Busaidi', nationalId: '12345678' }, // 8-digit Oman Civil ID
      prescriber: { name: 'Dr. Khalid Al-Hinai', licenseNumber: 'MOH-OM-883' },
      prescription: { prescriptionNumber: 'RX-OM-402' },
    })
    assert(omanAllowed.allowed === true, 'Oman MoH controlled drug cleared with 8-digit Civil ID & MoH license')

    // Test 5: Bahrain NHRA Controlled Ledger (CPR check)
    const bhBlocked = validateNarcoticDispensing({
      territoryCode: 'BH',
      drugClassification: 'NHRA_SCHEDULE_I',
      productName: 'Oxycodone 20mg',
      quantity: 1,
      patient: { name: 'Isa Al-Khalifa', nationalId: '123' }, // Invalid CPR (not 9 digits)
      prescriber: { name: 'Dr. Salman', licenseNumber: 'NHRA-LIC-77' },
      prescription: { prescriptionNumber: 'RX-BH-99' },
    })
    assert(bhBlocked.allowed === false, 'Bahrain NHRA blocked invalid CPR length (not 9 digits)')

    // Test 6: India Schedule H1 / Schedule X Register
    const inAllowed = validateNarcoticDispensing({
      territoryCode: 'IN',
      drugClassification: 'SCHEDULE_H1',
      productName: 'Alprazolam 0.5mg',
      quantity: 10,
      patient: { name: 'Ramesh Gupta', address: '42 MG Road, Bangalore - 560001' },
      prescriber: { name: 'Dr. A. K. Sen', licenseNumber: 'KMC-48892' },
      prescription: { prescriptionNumber: 'RX-BLR-884' },
    })
    assert(inAllowed.allowed === true, 'Indian Schedule H1 compliant with Form 35 patient address & reg no')
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST SECTION 3: ESC/POS Arabic Letter Shaping & Bilingual Stream
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- [TEST GROUP 3]: ESC/POS Arabic Raster & Letter Shaping ---')
  {
    const sampleArabic = 'صيدلية ميتافارسيك'
    const shaped = shapeArabicText(sampleArabic)

    assert(Boolean(shaped), 'Arabic text shaped successfully')
    assert(shaped !== sampleArabic, 'Arabic character codes converted to Presentation Forms-B connecting glyphs')

    // Test bilingual ESC/POS thermal receipt compiler
    const escposStream = buildEscPosBilingualReceipt({
      pharmacyNameEn: 'Metapharsic Pharmacare Intl',
      pharmacyNameAr: 'صيدلية ميتافارسيك الدولية',
      vatId: '310123456700003',
      invoiceNumber: 'INV-2026-88',
      timestamp: '2026-11-19 16:00',
      lines: [
        {
          nameEn: 'Augmentin 625mg',
          nameAr: 'أوجمنتين ٦٢٥ ملغ',
          qty: 1,
          rate: '45.00',
          amount: '45.00',
        },
      ],
      subtotal: '45.00',
      taxAmount: '0.00',
      grandTotal: '45.00',
      currencySymbol: 'SAR',
    })

    assert(Buffer.isBuffer(escposStream), 'Generated standard ESC/POS binary Buffer')
    assert(escposStream.length > 100, `ESC/POS byte-stream size: ${escposStream.length} bytes`)
    assert(escposStream[0] === 0x1b && escposStream[1] === 0x40, 'Begins with ESC @ (0x1B 0x40 Init Printer)')
    // Ends with cut command GS V 66 0
    const cutSlice = escposStream.subarray(escposStream.length - 4)
    assert(cutSlice[0] === 0x1d && cutSlice[1] === 0x56, 'Ends with GS V (Paper Cut Command)')
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST SECTION 4: 5-Thread Concurrent Serialization Pipeline
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- [TEST GROUP 4]: 5-Thread Concurrent Preflight Engine ---')
  {
    const pipelineInput = {
      scannedCode: '(01)06285000000018(17)261231(10)LOT789A(21)SN9814421',
      territoryCode: 'SA' as const,
      productName: 'Augmentin 625mg SFDA Pack',
      drugClassification: 'NON_CONTROLLED',
    }

    const pipelineResult = await executeMultiThreadSerialization(pipelineInput)

    assert(pipelineResult.success === true, 'Pipeline executed successfully')
    assert(pipelineResult.threads.length === 5, 'Dispatched exactly 5 concurrent worker threads')
    assert(pipelineResult.totalDurationMs < 30.0, `Total serialization latency is ${pipelineResult.totalDurationMs}ms (< 30ms SLA)`)

    const threadCodes = pipelineResult.threads.map((t) => t.code)
    assert(threadCodes.includes('THREAD_GS1_PARSER'), 'Thread 1: THREAD_GS1_PARSER executed')
    assert(threadCodes.includes('THREAD_FEFO_BATCH_RESOLVE'), 'Thread 2: THREAD_FEFO_BATCH_RESOLVE executed')
    assert(threadCodes.includes('THREAD_NARCOTIC_AUDIT'), 'Thread 3: THREAD_NARCOTIC_AUDIT executed')
    assert(threadCodes.includes('THREAD_TRACK_TRACE'), 'Thread 4: THREAD_TRACK_TRACE executed')
    assert(threadCodes.includes('THREAD_BILINGUAL_RECEIPT'), 'Thread 5: THREAD_BILINGUAL_RECEIPT executed')

    console.log('\n  Live Microsecond Serialization Telemetry:')
    for (const t of pipelineResult.threads) {
      console.log(`    • [${t.code}] ${t.name}: ${t.status} in ${t.durationMs}ms — ${t.details}`)
    }

    assert(pipelineResult.fefoStatus.fefoEligible === true, 'FEFO batch verified active and eligible for dispensing')
    assert(pipelineResult.trackAndTracePayload.system.includes('SFDA Tatmeen'), 'SFDA Tatmeen track and trace packet prepared')
    assert(pipelineResult.bilingualReceiptSample.escposByteLength > 0, 'ESC/POS bilingual stream synthesized')
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

runPhase4Tests().catch((err) => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
