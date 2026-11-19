/**
 * Metapharsic Rx — Phase 5 Sovereign Multi-Cloud & ZATCA Pilot Test Suite
 * Validates:
 * 1. Sovereign Cloud Topologies across 6 nations (SA, OM, BH, QA, MV, IN)
 * 2. Strict In-Country Data Residency Enforcement & Cross-Border Leakage Prevention
 * 3. ZATCA Phase 2 Sandbox Clearance Simulator & Cryptographic Hash Chaining
 * 4. 5-Thread Concurrent Regional Cloud & Pilot Orchestration (< 30ms latency SLA)
 */

import {
  SOVEREIGN_CLOUD_TOPOLOGIES,
  getSovereignCloudTopology,
  listAllSovereignCloudNodes,
  verifyDataResidencyCompliance,
} from '../src/lib/cloud/sovereign-cloud-topology'
import { runZatcaSandboxBenchmark } from '../src/lib/cloud/zatca-sandbox-simulator'
import { executeMultiThreadCloudPilot } from '../src/lib/cloud/multi-thread-cloud-pilot-engine'

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`)
    process.exit(1)
  }
  console.log(`  ✓ ${msg}`)
}

async function runTests() {
  console.log('\n======================================================================')
  console.log('🚀 RUNNING PHASE 5: SOVEREIGN CLOUD & ZATCA PILOT VALIDATION')
  console.log('======================================================================\n')

  // ── TEST GROUP 1: SOVEREIGN CLOUD TOPOLOGY RESOLUTION ──
  console.log('📋 Test Group 1: Sovereign Regional Cloud Topologies (6 Nations)')
  const allNodes = listAllSovereignCloudNodes()
  assert(allNodes.length === 6, 'Exactly 6 sovereign national cloud nodes registered')

  const saNode = getSovereignCloudTopology('SA')
  assert(saNode.cloudProvider === 'Oracle Cloud (OCI)', 'Saudi Arabia running on sovereign OCI / AWS local zone')
  assert(saNode.cloudRegionCode.includes('me-central-1'), 'Saudi cloud region code is me-central-1')
  assert(saNode.inCountryStorageGuaranteed === true, 'Saudi Arabia guarantees 100% in-country data residency')
  assert(saNode.dataResidencyLaw.includes('NDMO') && saNode.dataResidencyLaw.includes('PDPL'), 'Saudi Arabia strictly enforces NDMO & PDPL')

  const omNode = getSovereignCloudTopology('OM')
  assert(omNode.cloudProvider === 'Oman Data Park', 'Oman running on Oman Data Park (ODP)')
  assert(omNode.dataResidencyLaw.includes('Royal Decree 6/2022'), 'Oman enforces Royal Decree 6/2022')
  assert(omNode.datacenterCity.includes('Muscat'), 'Oman datacenter in Muscat')

  const bhNode = getSovereignCloudTopology('BH')
  assert(bhNode.cloudRegionCode.includes('me-south-1'), 'Bahrain running on me-south-1 (Manama)')
  assert(bhNode.dataResidencyLaw.includes('Law No. 30 of 2018'), 'Bahrain enforces Law No. 30 of 2018 NHRA standard')

  const qaNode = getSovereignCloudTopology('QA')
  assert(qaNode.datacenterCity.includes('Doha'), 'Qatar datacenter located in Doha')
  assert(qaNode.dataResidencyLaw.includes('Law No. 13 of 2016'), 'Qatar enforces Law No. 13 of 2016 MoPH standard')

  const mvNode = getSovereignCloudTopology('MV')
  assert(mvNode.cloudProvider === 'Dhiraagu Edge', 'Maldives running on sovereign Dhiraagu Edge (Greater Malé Hub)')
  assert(mvNode.dataResidencyLaw.includes('Aasandha'), 'Maldives enforces Aasandha / MIRA Health Data Protocol')

  const inNode = getSovereignCloudTopology('IN')
  assert(inNode.cloudRegionCode.includes('ap-south-1'), 'India running on ap-south-1 (Mumbai)')
  assert(inNode.dataResidencyLaw.includes('DPDPA 2023'), 'India enforces DPDPA 2023')

  // ── TEST GROUP 2: DATA RESIDENCY COMPLIANCE & CROSS-BORDER LEAKAGE PREVENTION ──
  console.log('\n🔒 Test Group 2: Data Residency Verification & Cross-Border Leakage Prevention')
  const validSARoute = verifyDataResidencyCompliance('SA', 'sa-central-node-01.metapharsic.cloud')
  assert(validSARoute.compliant === true, 'Sovereign Saudi node routing approved')

  const invalidSARoute = verifyDataResidencyCompliance('SA', 'foreign-us-east-bucket.s3.amazonaws.com')
  assert(invalidSARoute.compliant === false, 'Cross-border exfiltration to non-sovereign host blocked by Saudi NDMO')
  assert(Boolean(invalidSARoute.reason?.includes('violates')), 'Reason specifically cites violation of sovereign data residency')

  const validOMRoute = verifyDataResidencyCompliance('OM', 'om-muscat-node-01.metapharsic.cloud')
  assert(validOMRoute.compliant === true, 'Oman sovereign ODP routing approved')

  const invalidOMRoute = verifyDataResidencyCompliance('OM', 'external-eu-central-storage.azure.com')
  assert(invalidOMRoute.compliant === false, 'Cross-border exfiltration blocked by Oman RD 6/2022')

  // ── TEST GROUP 3: ZATCA PHASE 2 SANDBOX CLEARANCE & HASH CHAINING ──
  console.log('\n⚡ Test Group 3: ZATCA Phase 2 Sandbox Clearance & Cryptographic Hash Chaining')
  const benchmarkReport = await runZatcaSandboxBenchmark({
    batchSize: 30,
    territoryCode: 'SA',
    invoiceType: 'SIMPLIFIED',
  })

  assert(benchmarkReport.totalInvoices === 30, 'Simulated batch generated 30 invoices')
  assert(benchmarkReport.passedCount === 30, 'All 30 invoices cleared with 100% pass rate')
  assert(benchmarkReport.failedCount === 0, 'Zero clearance failures')
  assert(benchmarkReport.passRatePercent === 100, 'Pass rate is exactly 100%')
  assert(benchmarkReport.cryptographicChainValid === true, 'Cryptographic hash chain validated unbroken')
  assert(benchmarkReport.throughputInvoicesPerSec > 50, `High throughput clearance: ${benchmarkReport.throughputInvoicesPerSec} inv/sec`)
  assert(benchmarkReport.averageLatencyPerInvoiceMs < 20, `Ultra-low latency: ${benchmarkReport.averageLatencyPerInvoiceMs} ms/invoice`)

  // Verify hash-chain continuity in sample invoices
  const samples = benchmarkReport.sampleInvoices
  assert(samples.length >= 5, 'Sample invoices collected for audit ledger')
  assert(samples[0].invoiceHashHex.length === 64, 'SHA-256 invoice hash is 64 hex characters')
  assert(samples[0].previousInvoiceHash.length > 0, 'Previous invoice hash present on first invoice')
  assert(samples[0].ublValidated === true, 'UBL 2.1 XML structure validated')
  assert(samples[0].qrValidated === true, 'Base64 TLV and QR code payload verified')

  // ── TEST GROUP 4: 5-THREAD CONCURRENT REGIONAL CLOUD & PILOT ENGINE ──
  console.log('\n🧵 Test Group 4: 5-Thread Concurrent Regional Cloud & Pilot Orchestration')
  const pilotResult = await executeMultiThreadCloudPilot({
    territoryCode: 'SA',
    sandboxBatchSize: 25,
    invoiceType: 'SIMPLIFIED',
  })

  assert(pilotResult.success === true, 'Multi-thread orchestrator finished successfully')
  assert(pilotResult.threads.length === 5, 'Dispatched exactly 5 concurrent worker threads')

  const threadCodes = pilotResult.threads.map((t) => t.code)
  assert(threadCodes.includes('THREAD_DATA_RESIDENCY'), 'Thread 1: THREAD_DATA_RESIDENCY executed')
  assert(threadCodes.includes('THREAD_ZATCA_CLEARANCE'), 'Thread 2: THREAD_ZATCA_CLEARANCE executed')
  assert(threadCodes.includes('THREAD_PILOT_STRESS'), 'Thread 3: THREAD_PILOT_STRESS executed')
  assert(threadCodes.includes('THREAD_DISPENSARY_HEALTH'), 'Thread 4: THREAD_DISPENSARY_HEALTH executed')
  assert(threadCodes.includes('THREAD_SOVEREIGN_BACKUP'), 'Thread 5: THREAD_SOVEREIGN_BACKUP executed')

  for (const t of pilotResult.threads) {
    assert(t.status === 'SUCCESS', `Thread ${t.code} exited with SUCCESS in ${t.durationMs}ms`)
  }

  // Verify Retail Dispensary Nodes
  assert(pilotResult.pilotDispensaryNodes.length === 6, 'Handshake established with all 6 pilot retail dispensary counters')
  const cities = pilotResult.pilotDispensaryNodes.map((s) => s.city)
  assert(cities.includes('Riyadh') && cities.includes('Muscat') && cities.includes('Doha'), 'Riyadh, Muscat, Doha retail counters monitored')

  // Verify Sovereign Cold Backup Snapshot
  assert(pilotResult.backupSnapshot.status === 'ENCRYPTED', 'Sovereign backup snapshot encrypted')
  assert(pilotResult.backupSnapshot.snapshotId.startsWith('SNAP-SA'), 'Backup snapshot tagged with sovereign territory prefix')

  console.log('\n======================================================================')
  console.log('🎉 ALL PHASE 5 TESTS PASSED WITH 100% SOVEREIGN COMPLIANCE!')
  console.log('======================================================================\n')
}

runTests().catch((err) => {
  console.error('Fatal error during test run:', err)
  process.exit(1)
})
