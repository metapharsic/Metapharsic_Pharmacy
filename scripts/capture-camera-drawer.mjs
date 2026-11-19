import { chromium } from '@playwright/test';

async function run() {
  console.log('Launching headless browser to capture camera & cash drawer features...');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();

  // 1. Login as SuperAdmin
  console.log('Navigating to login...');
  await page.goto('http://localhost:5888/login');
  await page.waitForTimeout(500);

  // Switch to standard credentials if matrix grid is active
  const btn = page.locator('button:has(svg.lucide-layout-grid)').first();
  if (await btn.isVisible()) await btn.click();

  await page.fill('input#email', 'superadmin@pharmacare.local');
  await page.fill('input#password', 'SuperAdmin@123');
  await page.click('button[type="submit"]');

  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 10000 });
  console.log('Logged in successfully!');

  // 2. Capture Camera & Cash Drawer Dashboard
  console.log('Navigating to Camera & Cash Drawer page...');
  await page.goto('http://localhost:5888/settings/camera-drawer');
  await page.waitForTimeout(2500);

  const cameraPath = 'C:/Users/Dell/.gemini/antigravity/brain/0af620d3-0ed8-4ad0-b5a3-39304d91838e/camera-cash-drawer-dashboard.png';
  await page.screenshot({ path: cameraPath, fullPage: true });
  console.log(`Saved screenshot to: ${cameraPath}`);

  // 3. Navigate to Platform -> Chemist Shops Drilldown
  console.log('Navigating to Platform page...');
  await page.goto('http://localhost:5888/platform?tab=financials');
  await page.waitForTimeout(2000);

  // Click on Amjad Pharmacy or the first chemist row to open drilldown
  const chemistRow = page.locator('tr:has-text("Amjad"), tr:has-text("AMJAD")').first();
  if (await chemistRow.isVisible()) {
    await chemistRow.click();
    await page.waitForTimeout(1500);
  } else {
    // Click on the first row in the table
    const firstRow = page.locator('tbody tr').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await page.waitForTimeout(1500);
    }
  }

  // Scroll down to the Camera & Cash Drawer privilege card inside the drilldown
  const privCard = page.locator('text=In-Store Camera Surveillance & Smart Cash Drawer Privilege').first();
  if (await privCard.isVisible()) {
    await privCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  }

  const platformPath = 'C:/Users/Dell/.gemini/antigravity/brain/0af620d3-0ed8-4ad0-b5a3-39304d91838e/platform-camera-privilege-drilldown.png';
  await page.screenshot({ path: platformPath });
  console.log(`Saved screenshot to: ${platformPath}`);

  await browser.close();
  console.log('Capture complete!');
}

run().catch((err) => {
  console.error('Error running capture script:', err);
  process.exit(1);
});
