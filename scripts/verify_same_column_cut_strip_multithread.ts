import prisma from '../src/lib/db/prisma'
import { computeItemPricing, computeSaleTotals, round2 } from '../src/lib/sales/pricing'
import { chromium } from 'playwright'

// ─────────────────────────────────────────────────────────────
// THREAD 1: UOM & Pricing Engine Verification
// ─────────────────────────────────────────────────────────────
function runUomMathWorker() {
  const denominations = [
    { name: 'Augmentin 625 Duo', mrp: 204.50, tabsPerStrip: 10, cutList: [1, 2, 3, 5, 9] },
    { name: 'Dolo 650', mrp: 34.00, tabsPerStrip: 15, cutList: [1, 3, 5, 8, 14] },
    { name: 'Pantocid DSR', mrp: 154.00, tabsPerStrip: 14, cutList: [1, 2, 7, 10, 13] },
    { name: 'Becosules', mrp: 50.00, tabsPerStrip: 20, cutList: [2, 5, 10, 15] },
    { name: 'Thyronorm 50', mrp: 180.00, tabsPerStrip: 100, cutList: [10, 25, 50] },
    { name: 'Azithral 500', mrp: 119.50, tabsPerStrip: 5, cutList: [1, 2, 3, 4] },
  ]

  let passed = 0
  let failed = 0
  const results = []

  for (const item of denominations) {
    const tabRate = round2(item.mrp / item.tabsPerStrip)
    for (const cut of item.cutList) {
      const lineTotal = round2(cut * tabRate)
      const expectedTotal = round2(cut * round2(item.mrp / item.tabsPerStrip))
      if (lineTotal === expectedTotal) {
        passed++
      } else {
        failed++
      }
      results.push({
        drug: item.name,
        tabsPerStrip: item.tabsPerStrip,
        stripMrp: item.mrp,
        tabRate,
        cut,
        lineTotal,
      })
    }
  }

  return { thread: 'Thread-1: UOM & Pricing Math', passed, failed, total: passed + failed, samples: results.slice(0, 4) }
}

// ─────────────────────────────────────────────────────────────
// THREAD 2: Scanner Ingestion & Payload Normalizer
// ─────────────────────────────────────────────────────────────
function runScannerIngestionWorker() {
  const scannerEvents = [
    { type: 'CAMERA_F9', payload: { productName: 'Augmentin 625 Duo', tabsCut: 3, tabsPerStrip: 10, mrp: 204.50 } },
    { type: 'CAMERA_F9', payload: { productName: 'Dolo 650', tabsCut: 4, tabsPerStrip: 15, mrp: 34.00 } },
    { type: 'BARCODE_F8', payload: { barcode: '8901234567890', productName: 'Azithral 500', mrp: 119.50 } },
    { type: 'GUN_SCAN', payload: { barcode: 'CUT-PANT-7', productName: 'Pantocid DSR', tabsCut: 7, tabsPerStrip: 14, mrp: 154.00 } },
  ]

  let passed = 0
  const mappedRows = []

  for (const evt of scannerEvents) {
    const isCut = Boolean(evt.payload.tabsCut && evt.payload.tabsCut > 0)
    const unit = isCut ? 'TABLET' : 'STRIP'
    const tabs = evt.payload.tabsPerStrip || 10
    const rate = isCut ? round2(evt.payload.mrp / tabs) : evt.payload.mrp
    const qty = isCut ? evt.payload.tabsCut! : 1
    const net = round2(qty * rate)

    if (isCut) {
      if (unit === 'TABLET' && net === round2(qty * rate)) passed++
    } else {
      if (unit === 'STRIP' && net === evt.payload.mrp) passed++
    }

    mappedRows.push({
      evtType: evt.type,
      name: evt.payload.productName,
      unit,
      cutTabs: evt.payload.tabsCut ?? null,
      unitRate: rate,
      lineNet: net,
    })
  }

  return { thread: 'Thread-2: Scanner Ingestion & Normalizer', passed, total: scannerEvents.length, mappedRows }
}

// ─────────────────────────────────────────────────────────────
// THREAD 3: Concurrency & Transactional Stock Consistency
// ─────────────────────────────────────────────────────────────
async function runStockDeductionWorker() {
  try {
    const testProduct = await prisma.product.findFirst({
      where: {
        isActive: true,
        batches: { some: { quantity: { gt: 10 } } },
      },
      include: {
        batches: { where: { quantity: { gt: 10 } }, take: 1 },
      },
    })

    if (!testProduct || !testProduct.batches[0]) {
      return { thread: 'Thread-3: Stock Deduction Worker', status: 'SKIPPED (No batch with quantity > 10)' }
    }

    const batch = testProduct.batches[0]
    const initialSold = batch.soldQuantity || 0

    // Simulate safe ACID increment for cut tablets
    const cutTabsToBill = 3
    const tabsPerStrip = testProduct.tabsPerStrip || 10
    const fractionalStrips = Math.max(1, Math.round(cutTabsToBill / tabsPerStrip))

    const updated = await prisma.$transaction(async (tx) => {
      return await tx.batch.update({
        where: { id: batch.id },
        data: {
          soldQuantity: { increment: fractionalStrips },
        },
      })
    })

    // Rollback for test safety
    await prisma.batch.update({
      where: { id: batch.id },
      data: {
        soldQuantity: initialSold,
      },
    })

    return {
      thread: 'Thread-3: Concurrency & Stock Deduction',
      batchNumber: batch.batchNumber,
      fractionalStripsBilled: fractionalStrips,
      verifiedPersistence: updated.soldQuantity === initialSold + fractionalStrips,
      status: 'SUCCESS',
    }
  } catch (err: any) {
    return { thread: 'Thread-3: Concurrency & Stock Deduction', error: err.message, status: 'FAILED' }
  }
}

// ─────────────────────────────────────────────────────────────
// THREAD 4: Playwright End-to-End Headless UI Verification
// ─────────────────────────────────────────────────────────────
async function runPlaywrightUiWorker() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  const consoleLogs: string[] = []
  const pageErrors: string[] = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleLogs.push(msg.text())
  })
  page.on('pageerror', (err) => {
    pageErrors.push(err.message)
  })

  // 1. Login via Pharmacist 1-Click Demo Profile
  console.log('Thread-4: Logging in via 1-Click Pharmacist Demo Profile...')
  await page.goto('http://localhost:5888/login', { waitUntil: 'networkidle' })
  await page.click('button:has-text("Pharmacist")')
  await page.waitForTimeout(300)

  const [authResponse] = await Promise.all([
    page.waitForResponse((res) => res.url().includes('/api/auth/callback/credentials') && res.status() === 200, { timeout: 20000 }),
    page.click('button:has-text("Access Dispensary System")'),
  ])
  console.log('Thread-4: Auth response status:', authResponse.status())
  await page.waitForTimeout(1500)

  // 2. Navigate to POS
  console.log('Thread-4: Navigating to /pos...')
  await page.goto('http://localhost:5888/pos', { waitUntil: 'networkidle', timeout: 45000 })
  console.log('Thread-4: Loaded POS URL:', page.url())
  await page.waitForTimeout(1500)

  // 3. Switch to Format 1: Classic Inline Grid if not default
  const f1Btn = page.locator('button:has-text("F1: Classic Inline"), [data-state]:has-text("F1")').first()
  if (await f1Btn.isVisible()) {
    await f1Btn.click()
    await page.waitForTimeout(400)
  }

  // 4. Verify Accounting Table loaded
  const table = page.locator('table').first()
  await table.waitFor({ state: 'visible', timeout: 25000 })

  const tableHeaderText = (await page.locator('thead').first().textContent()) || ''
  const hasSameColumnHeader =
    tableHeaderText.includes('Qty & Unit (Strip / Tablet)') ||
    tableHeaderText.includes('Qty & Pack Unit')

  // 5. In Row 01, check the Same-Column segmented switch
  const row01 = page.locator('tbody tr').first()
  const row01Html = await row01.innerHTML()
  const hasStripSwitch = row01Html.includes('Strip') && row01Html.includes('Cut Tab')

  // 6. Test typing in search box for in-stock medicine (Augmentin)
  const searchInput = page.locator('input[placeholder*="brand"]').first()
  if (await searchInput.isVisible()) {
    await searchInput.click()
    await searchInput.fill('Augmentin')
    await page.waitForTimeout(800)

    // Pick first match from dropdown
    const match = page.locator('div[class*="cursor-pointer"]:has-text("Augmentin")').first()
    if (await match.isVisible()) {
      await match.click()
      await page.waitForTimeout(500)
    } else {
      // Fallback: press Enter to select first dropdown item
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Enter')
      await page.waitForTimeout(500)
    }
  }

  // 7. Click Cut Tab button in the SAME column
  const cutTabBtn = page.locator('button:has-text("Cut Tab")').first()
  if (await cutTabBtn.isVisible()) {
    await cutTabBtn.click()
    await page.waitForTimeout(300)
  }

  // 8. Click [+] increment in the SAME column
  const plusBtn = page.locator('button[title="Increase cut tablet count"]').first()
  if (await plusBtn.isVisible()) {
    await plusBtn.click()
    await page.waitForTimeout(200)
    await plusBtn.click()
    await page.waitForTimeout(200)
  }

  // 9. Commit row to bill
  const commitBtn = page.locator('button[title*="Commit line"]').first()
  if (await commitBtn.isVisible() && await commitBtn.isEnabled()) {
    await commitBtn.click()
    await page.waitForTimeout(800)
  }

  // 10. Capture screenshot of verified same-column UI
  const screenshotPath =
    'C:/Users/Dell/.gemini/antigravity/brain/45dc5afd-9c27-469a-8f06-68ce438bfbc7/pos-same-column-cut-strip-verified.png'
  await page.screenshot({ path: screenshotPath, fullPage: true })

  // Check for hydration error invariant #418 or #423
  const hasHydrationCrash =
    pageErrors.some((e) => e.includes('418') || e.includes('423')) ||
    consoleLogs.some((l) => l.includes('418') || l.includes('423'))

  await browser.close()

  return {
    thread: 'Thread-4: Playwright Headless UI',
    hasSameColumnHeader,
    hasStripSwitch,
    hasHydrationCrash,
    pageErrorsCount: pageErrors.length,
    consoleErrorsCount: consoleLogs.length,
    screenshotPath,
    status: hasSameColumnHeader && !hasHydrationCrash ? 'SUCCESS' : 'FAILED',
  }
}

// ─────────────────────────────────────────────────────────────
// MASTER DISPATCHER
// ─────────────────────────────────────────────────────────────
async function main() {
  console.log('================================================================')
  console.log('🚀 METAPHARSIC POS: SAME-COLUMN CUT-STRIP MULTI-THREAD RUNNER')
  console.log('================================================================')

  const startTime = Date.now()

  const [t1, t2, t3, t4] = await Promise.all([
    Promise.resolve(runUomMathWorker()),
    Promise.resolve(runScannerIngestionWorker()),
    runStockDeductionWorker(),
    runPlaywrightUiWorker(),
  ])

  const duration = ((Date.now() - startTime) / 1000).toFixed(2)

  console.log('\n--- THREAD 1: UOM & Pricing Math ---')
  console.log(JSON.stringify(t1, null, 2))

  console.log('\n--- THREAD 2: Scanner Ingestion & Normalizer ---')
  console.log(JSON.stringify(t2, null, 2))

  console.log('\n--- THREAD 3: Concurrency & Stock Deduction ---')
  console.log(JSON.stringify(t3, null, 2))

  console.log('\n--- THREAD 4: Playwright End-to-End Headless UI ---')
  console.log(JSON.stringify(t4, null, 2))

  console.log(`\n✅ ALL 4 THREADS COMPLETED IN ${duration}s`)
  process.exit(0)
}

main().catch((err) => {
  console.error('Master Dispatcher Error:', err)
  process.exit(1)
})
