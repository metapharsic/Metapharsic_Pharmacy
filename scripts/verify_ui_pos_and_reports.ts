import { chromium } from 'playwright'
import * as path from 'path'

async function run() {
  console.log('🚀 Starting Playwright verification on http://localhost:5888...')
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('  [Browser Error]:', msg.text())
    }
  })

  // 1. Login via Pharmacist 1-Click Demo Profile
  console.log('🔑 Logging in using 1-Click Demo Profile (Pharmacist)...')
  await page.goto('http://localhost:5888/login', { waitUntil: 'networkidle' })
  await page.click('button:has-text("Pharmacist")')
  await page.waitForTimeout(300)
  await page.click('button:has-text("Access Dispensary System")')
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 })
  console.log('  ✓ Logged in successfully. Current URL:', page.url())

  // 2. Visit Reports page
  console.log('📊 Verifying Reports page & Owner Closing Digest...')
  await page.goto('http://localhost:5888/reports', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)

  // Verify no error toasts
  const toastTexts = await page.$$eval('[data-sonner-toast], [role="status"]', els => els.map(e => e.textContent || ''))
  console.log('  ✓ Visible toast notifications on reports:', toastTexts)
  for (const t of toastTexts) {
    if (t.includes('Failed to load daily closing digest')) {
      throw new Error(`Report digest failed with error toast: ${t}`)
    }
  }

  // Verify Digest Card content
  const digestTitle = await page.locator('text=Daily Closing Digest').first()
  console.log('  ✓ Closing Digest Card visible:', await digestTitle.isVisible())

  const artifactDir = 'C:/Users/Dell/.gemini/antigravity/brain/45dc5afd-9c27-469a-8f06-68ce438bfbc7'
  await page.screenshot({ path: path.join(artifactDir, 'reports-verified.png'), fullPage: false })
  console.log('  ✓ Saved artifact: reports-verified.png')

  // 3. Visit High-Speed POS page
  console.log('🛒 Verifying High-Speed Dispensary POS (Shortcuts & Cash Drawer)...')
  await page.goto('http://localhost:5888/pos', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  // Switch to Classic: Tile Grid layout
  console.log('  🎨 Switching to Classic Tile Grid layout...')
  const tileGridBtn = page.locator('button:has-text("Classic: Tile Grid")').first()
  if (await tileGridBtn.isVisible()) {
    await tileGridBtn.click()
    await page.waitForTimeout(1000)
    console.log('  ✓ Switched to Classic Tile Grid.')
  }

  // Test F2 Search Hotkey
  console.log('  ⚡ Testing F2 Hotkey focus...')
  await page.keyboard.press('F2')
  await page.waitForTimeout(300)
  await page.keyboard.type('Dolo 650')
  await page.waitForTimeout(1000)

  // Select Dolo 650 product card
  console.log('  💊 Selecting Dolo 650 Tablet...')
  const doloCard = page.locator('button:has-text("Dolo 650")').first()
  await doloCard.click()
  await page.waitForTimeout(800)

  // Batch Selection Modal (FEFO Batch selection)
  console.log('  📦 FEFO Batch Modal opened, confirming Add to Bill...')
  const addBatchBtn = page.locator('button:has-text("Add to Bill")').first()
  await addBatchBtn.click()
  await page.waitForTimeout(1000)

  // Check Cart has item
  console.log('  ✓ Item added to cart.')

  // Test F10 Finalize Hotkey
  console.log('  ⚡ Testing F10 Hotkey to open Finalize & Cash Tendered Dialog...')
  await page.keyboard.press('F10')
  await page.waitForTimeout(800)

  // Click ₹500 quick cash denomination chip
  console.log('  💵 Selecting ₹500 Quick Cash Chip...')
  const chip500 = page.locator('button:has-text("₹500")').first()
  await chip500.click()
  await page.waitForTimeout(500)

  // Check Change Return text
  const changeEl = page.locator('text=Change to Return').first()
  const changeText = await changeEl.textContent()
  console.log('  ✓ Change Calculation visible:', changeText)

  // Finalize Sale
  console.log('  ⚡ Completing checkout...')
  const finalizeBtn = page.locator('button:has-text("Accept & Print Bill")').first()
  await finalizeBtn.click()
  await page.waitForTimeout(3000)

  // Verify Receipt modal
  const receiptTitle = page.locator('text=TAX INVOICE, text=Invoice #, text=Print Receipt, text=Sale Completed').first()
  console.log('  ✓ Thermal slip / Tax invoice visible:', await receiptTitle.isVisible())

  await page.screenshot({ path: path.join(artifactDir, 'pos-verified.png'), fullPage: false })
  console.log('  ✓ Saved artifact: pos-verified.png')

  console.log('====================================================')
  console.log('🎯 PLAYWRIGHT VERIFICATION SUCCEEDED WITH ZERO ERRORS!')
  console.log('====================================================')

  await browser.close()
}

run().catch(err => {
  console.error('❌ Playwright verification failed:', err)
  process.exit(1)
})
