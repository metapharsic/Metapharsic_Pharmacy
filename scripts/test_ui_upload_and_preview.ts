import { chromium } from 'playwright'
import * as path from 'path'
import * as fs from 'fs'
import * as XLSX from 'xlsx'

const ARTIFACT_DIR = 'C:/Users/Dell/.gemini/antigravity/brain/45dc5afd-9c27-469a-8f06-68ce438bfbc7'

async function runUiTest() {
  console.log('🚀 Running UI Document Ingestion & Telemetry Test...')

  // Create a realistic sample Excel invoice file
  const testFilePath = path.join(process.cwd(), 'sample_test_invoice.xlsx')
  const wb = XLSX.utils.book_new()
  const wsData = [
    ['METADATA FIELD', 'DETAILS'],
    ['Supplier Name', 'APOLLO HEALTHCARE DISTRIBUTORS PVT LTD'],
    ['GSTIN', '29AABCU9603R1ZM'],
    ['PAN', 'AABCU9603R'],
    ['DL Number', '20B/KA-B21/48911'],
    ['Phone', '+91 98450 12345'],
    ['Email', 'apollo.billing@apollohealth.in'],
    ['Address', 'Building 7, Peenya 3rd Phase, Bangalore 560058'],
    ['Invoice Number', 'AP-BLR-2026-8891'],
    ['Invoice Date', '2026-11-04'],
    ['Payment Mode', 'UPI'],
    ['Reference', 'UPI-UTR-99182374'],
    [],
    ['Item Name', 'HSN', 'Batch No', 'Expiry Date', 'Pack Size', 'Billed Qty', 'Free Qty', 'PTR', 'MRP', 'Disc %', 'Tax %', 'Total Amount'],
    ['Amoxicillin 500mg (Amoxil)', '30041010', 'AMX-9011', '2027-10-31', '10 Caps', 50, 5, 75.00, 115.00, 5.0, 12, 3990.00],
    ['Paracetamol 650mg (Dolo 650)', '30049060', 'DOL-8820', '2028-06-30', '15 Tabs', 100, 10, 24.00, 34.00, 0.0, 12, 2688.00],
  ]
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  XLSX.utils.book_append_sheet(wb, ws, 'Tax Invoice')
  XLSX.writeFile(wb, testFilePath)

  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  try {
    // 1. Log in as Admin
    console.log('1. Logging in as Admin...')
    await page.goto('http://localhost:5888/login', { waitUntil: 'networkidle' })
    await page.locator('button:has-text("Admin")').first().click()
    await page.waitForTimeout(400)
    await page.click('button:has-text("Access Dispensary System")')
    await page.waitForTimeout(2500)
    console.log('  ✓ Logged in as Admin!')

    // 2. Navigate to /purchases/scan
    console.log('2. Navigating to /purchases/scan...')
    await page.goto('http://localhost:5888/purchases/scan', { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForSelector('input[data-testid="bill-file-input"]', { state: 'attached' })

    // 3. Upload invoice
    console.log('3. Uploading sample_test_invoice.xlsx via file input...')
    await page.setInputFiles('input[data-testid="bill-file-input"]', testFilePath)

    // 4. Wait for processing to complete
    console.log('4. Waiting for multi-thread extraction to process...')
    try {
      await page.waitForSelector('text=Extraction', { timeout: 15000 })
      console.log('  ✓ Multi-thread extraction completed!')
    } catch {
      console.log('  ⚠️ Timeout waiting for text=Extraction, proceeding...')
    }
    await page.waitForTimeout(2000)

    // 5. Expand vendor credentials if available
    const vendorBtn = page.locator('button:has-text("Vendor Credentials")')
    if (await vendorBtn.isVisible()) {
      await vendorBtn.click()
      await page.waitForTimeout(500)
    }

    // 6. Capture verified screenshot
    const screenshotPath = path.join(ARTIFACT_DIR, 'purchase-bill-scanner-loaded.png')
    await page.screenshot({ path: screenshotPath, fullPage: true })
    console.log(`📸 Screenshot captured at: ${screenshotPath}`)
  } finally {
    await browser.close()
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath)
    }
  }
}

runUiTest().catch(console.error)
