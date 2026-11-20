/* eslint-disable no-console */
import { chromium } from 'playwright'

async function capture() {
  console.log('🚀 Launching Chrome for UI Proof Capture...')
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  try {
    // 1. Login
    console.log('Navigating to login page...')
    await page.goto('http://localhost:5888/login', { waitUntil: 'networkidle' })
    await page.fill('input[type="email"], input[name="email"]', 'admin@metapharsic.com')
    await page.fill('input[type="password"], input[name="password"]', 'Admin@123')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(3000)

    // 2. Sovereign WhatsApp Provisioning Matrix on Platform
    console.log('Navigating to Platform WhatsApp Matrix...')
    await page.goto('http://localhost:5888/platform?tab=whatsapp', { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)
    await page.screenshot({
      path: 'C:/Users/Dell/.gemini/antigravity/brain/0af620d3-0ed8-4ad0-b5a3-39304d91838e/platform-whatsapp-provisioning-matrix.png',
      fullPage: false,
    })
    console.log('✅ Captured platform-whatsapp-provisioning-matrix.png')

    // 3. Dispensary Intelligence Dashboard
    console.log('Navigating to Dispensary Dashboard...')
    await page.goto('http://localhost:5888/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)
    await page.screenshot({
      path: 'C:/Users/Dell/.gemini/antigravity/brain/0af620d3-0ed8-4ad0-b5a3-39304d91838e/dashboard-retention-and-whatsapp.png',
      fullPage: false,
    })
    console.log('✅ Captured dashboard-retention-and-whatsapp.png')

    // 4. Open Refill Reminders Modal
    console.log('Opening Refill Reminders Modal...')
    const refillCard = page.locator('text=Automated Medicine Refill Reminders').first()
    if (await refillCard.isVisible()) {
      await refillCard.click()
      await page.waitForTimeout(1000)
      await page.screenshot({
        path: 'C:/Users/Dell/.gemini/antigravity/brain/0af620d3-0ed8-4ad0-b5a3-39304d91838e/dashboard-refills-and-retention-modal.png',
        fullPage: false,
      })
      console.log('✅ Captured dashboard-refills-and-retention-modal.png')
    }
  } catch (err) {
    console.error('Error during capture:', err)
  } finally {
    await browser.close()
    console.log('🏁 Browser closed.')
  }
}

void capture()
