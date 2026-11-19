import { chromium } from 'playwright'

async function diagnose() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.text().includes('Hydration') || msg.text().includes('hydration') || msg.text().includes('Warning')) {
      consoleErrors.push(`[${msg.type()}] ${msg.text()}`)
    }
  })

  page.on('pageerror', (err) => {
    consoleErrors.push(`[PAGE_ERROR] ${err.message}\n${err.stack}`)
  })

  console.log('1. Logging in as Admin...')
  await page.goto('http://localhost:5888/login', { waitUntil: 'networkidle' })
  await page.locator('button:has-text("Admin")').first().click()
  await page.waitForTimeout(300)
  await page.click('button:has-text("Access Dispensary System")')
  await page.waitForTimeout(2000)

  const pagesToTest = [
    'http://localhost:5888/dashboard',
    'http://localhost:5888/purchases/scan',
    'http://localhost:5888/pos',
    'http://localhost:5888/reports',
    'http://localhost:5888/inventory/audit',
  ]

  for (const testUrl of pagesToTest) {
    console.log(`\nTesting URL: ${testUrl}`)
    consoleErrors.length = 0
    await page.goto(testUrl, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)

    if (consoleErrors.length > 0) {
      console.log(`⚠️ Errors on ${testUrl}:`)
      consoleErrors.forEach((e) => console.log('   ' + e))
    } else {
      console.log(`✅ Zero errors on ${testUrl}`)
    }
  }

  await browser.close()
}

diagnose().catch(console.error)

