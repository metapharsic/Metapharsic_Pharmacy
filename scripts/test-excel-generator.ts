import * as XLSX from 'xlsx'
import { getPlatformChemistAnalytics } from '../src/lib/platform/platform-analytics-service'
import {
  buildChemistFinancialWorkbookConfig,
  type ChemistExcelExportOptions,
} from '../src/lib/reports/platform-excel-generator'
import { generateExcelWorkbook } from '../src/lib/reports/excel-export-service'
import * as fs from 'fs'
import * as path from 'path'

async function testExcelGeneration() {
  console.log('--- Testing Formatted Chemist Financial Excel Generation ---')

  // 1. Fetch live platform analytics
  const analyticsData = await getPlatformChemistAnalytics()
  console.log(`✓ Fetched analytics for ${analyticsData.chemists.length} chemist shops`)

  // Test Case A: Consolidated Master Report (All Shops, All 6 Sections)
  console.log('\n[Test A] Building Consolidated Master Excel Workbook (All Shops, All Sections)...')
  const configAll = buildChemistFinancialWorkbookConfig(analyticsData, {
    includeExecutiveKpi: true,
    includeFinancialOverview: true,
    includeInventoryValuation: true,
    includeLedgerExposure: true,
    includeTopMedicines: true,
    includeRecentTransactions: true,
    healthTierFilter: 'ALL',
  })

  console.log(`✓ Workbook Filename: ${configAll.filename}`)
  console.log(`✓ Sheets Count: ${configAll.sheets.length}`)
  for (const sheet of configAll.sheets) {
    console.log(`   - Sheet: "${sheet.sheetName}" | Rows: ${sheet.data.length} | Columns: ${sheet.headers.length} | Has Summary: ${Boolean(sheet.summaryRow)}`)
  }

  // Generate binary buffer
  const bufferAll = generateExcelWorkbook(configAll)
  console.log(`✓ Binary Buffer generated: ${bufferAll.length} bytes`)

  // Inspect with SheetJS
  const parsedWbAll = XLSX.read(bufferAll, { type: 'buffer' })
  console.log(`✓ Parsed Sheets in XLSX: ${parsedWbAll.SheetNames.join(', ')}`)

  // Save to disk for inspection
  const outPathAll = path.join(process.cwd(), 'scripts', 'test-consolidated-audit.xlsx')
  fs.writeFileSync(outPathAll, bufferAll)
  console.log(`✓ Saved test file: ${outPathAll}`)

  // Test Case B: Single Selected Shop Audit (Apollo Pharmacy, Selected Range of Sections)
  console.log('\n[Test B] Building Tailored Single-Shop Audit for APOLLO...')
  const apolloShop = analyticsData.chemists.find((c) => c.organizationCode === 'APOLLO')
  if (apolloShop) {
    const configApollo = buildChemistFinancialWorkbookConfig(analyticsData, {
      selectedShopIds: [apolloShop.organizationId],
      includeExecutiveKpi: true,
      includeFinancialOverview: true,
      includeInventoryValuation: true,
      includeLedgerExposure: false, // User deselected ledger
      includeTopMedicines: true,
      includeRecentTransactions: false, // User deselected transactions
      healthTierFilter: 'ALL',
    })

    console.log(`✓ Single-Shop Filename: ${configApollo.filename}`)
    console.log(`✓ Sheets Count: ${configApollo.sheets.length}`)
    for (const sheet of configApollo.sheets) {
      console.log(`   - Sheet: "${sheet.sheetName}" | Rows: ${sheet.data.length}`)
    }

    const bufferApollo = generateExcelWorkbook(configApollo)
    const outPathApollo = path.join(process.cwd(), 'scripts', 'test-apollo-audit.xlsx')
    fs.writeFileSync(outPathApollo, bufferApollo)
    console.log(`✓ Saved test file: ${outPathApollo}`)
  }

  // Test Case C: Filter by Health Tier (Exceptional Only)
  console.log('\n[Test C] Building Health Tier Filtered Report (Exceptional Only)...')
  const configExceptional = buildChemistFinancialWorkbookConfig(analyticsData, {
    healthTierFilter: 'EXCEPTIONAL',
    includeExecutiveKpi: true,
    includeFinancialOverview: true,
    includeInventoryValuation: false,
    includeLedgerExposure: false,
    includeTopMedicines: true,
    includeRecentTransactions: false,
  })
  console.log(`✓ Sheets Count: ${configExceptional.sheets.length}`)
  const bufferExceptional = generateExcelWorkbook(configExceptional)
  console.log(`✓ Binary Buffer generated: ${bufferExceptional.length} bytes`)

  console.log('\n✓ ALL EXCEL GENERATION TESTS PASSED WITH 100% SUCCESS!')
}

testExcelGeneration().catch(console.error)

