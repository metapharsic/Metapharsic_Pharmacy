import { chromium } from 'playwright'

const ARTIFACT_DIR = 'C:/Users/Dell/.gemini/antigravity/brain/0af620d3-0ed8-4ad0-b5a3-39304d91838e'

async function run() {
  console.log('🚀 Capturing Sovereign Governance & Provisioning Modals...')
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } })
  const page = await context.newPage()

  try {
    // 1. LOGIN AS SUPERADMIN
    await page.goto('http://localhost:5888/login', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1000)

    const standardBtn = page.locator('button:has(svg.lucide-layout-grid)').first()
    if (await standardBtn.isVisible().catch(() => false)) {
      await standardBtn.click()
      await page.waitForTimeout(500)
    }

    await page.fill('input#email, input[type="email"]', 'superadmin@pharmacare.local')
    await page.fill('input#password, input[type="password"]', 'SuperAdmin@123')
    await page.click('button[type="submit"]')
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 })

    // 2. NAVIGATE DIRECTLY TO USERS TAB
    console.log('Navigating to /platform?tab=users...')
    await page.goto('http://localhost:5888/platform?tab=users', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    // Capture User Governance panel with buttons
    await page.screenshot({ path: `${ARTIFACT_DIR}/sovereign-user-governance-buttons.png` })
    console.log('✔ Captured sovereign-user-governance-buttons.png')

    // Open "Create Sovereign Staff" dialog
    const createStaffBtn = page.locator('button:has-text("Create Sovereign Staff")').first()
    if (await createStaffBtn.isVisible()) {
      await createStaffBtn.click()
      await page.waitForTimeout(1200)
      await page.screenshot({ path: `${ARTIFACT_DIR}/create-sovereign-user-modal.png` })
      console.log('✔ Captured create-sovereign-user-modal.png')
      await page.locator('button:has-text("Cancel")').first().click()
      await page.waitForTimeout(600)
    }

    // Open "Provision Main Store" dialog
    const provMainBtn = page.locator('button:has-text("Provision Main Store")').first()
    if (await provMainBtn.isVisible()) {
      await provMainBtn.click()
      await page.waitForTimeout(1200)
      await page.screenshot({ path: `${ARTIFACT_DIR}/provision-main-dispensary-modal.png` })
      console.log('✔ Captured provision-main-dispensary-modal.png')
      await page.locator('button:has-text("Cancel")').first().click()
      await page.waitForTimeout(600)
    }

    // 3. NAVIGATE TO SHOPS TAB
    console.log('Navigating to /platform?tab=shops...')
    await page.goto('http://localhost:5888/platform?tab=shops', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    const onboardBtn = page.locator('button:has-text("Onboard Chemist Shop"), button:has-text("Onboard New Tenant")').first()
    if (await onboardBtn.isVisible()) {
      await onboardBtn.click()
      await page.waitForTimeout(1200)
      await page.screenshot({ path: `${ARTIFACT_DIR}/onboard-sovereign-tenant-modal.png` })
      console.log('✔ Captured onboard-sovereign-tenant-modal.png')
    }

    console.log('🎉 All screenshot receipts captured successfully!')
  } catch (err) {
    console.error('Capture error:', err)
  } finally {
    await browser.close()
  }
}

run()
