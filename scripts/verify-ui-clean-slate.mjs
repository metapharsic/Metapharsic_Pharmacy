import { chromium } from '@playwright/test';

async function run() {
  console.log('Launching browser to capture clean slate & entity provisioning verification...');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const page = await context.newPage();

  const artifactDir = 'C:/Users/Dell/.gemini/antigravity/brain/0af620d3-0ed8-4ad0-b5a3-39304d91838e';

  // ─── 1. SuperAdmin User Governance New Entity Dialog ───────────
  console.log('1. Logging in as SuperAdmin to verify New Entity Modal...');
  await page.goto('http://localhost:5888/login');
  await page.waitForTimeout(500);

  const switchBtn = page.locator('button:has(svg.lucide-layout-grid)').first();
  if (await switchBtn.isVisible()) await switchBtn.click();

  await page.fill('input#email', 'superadmin@pharmacare.local');
  await page.fill('input#password', 'SuperAdmin@123');
  await page.click('button[type="submit"]');

  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 10000 });
  console.log('Logged in as SuperAdmin successfully!');

  await page.goto('http://localhost:5888/platform?tab=users');
  await page.waitForTimeout(2000);

  // Click on "Create Sovereign Personnel" button
  const createBtn = page.locator('button:has-text("Create Sovereign Personnel")').first();
  if (await createBtn.isVisible()) {
    console.log('Opening Create Sovereign Personnel Dialog...');
    await createBtn.click();
    await page.waitForTimeout(1000);
  }

  const modalPath = `${artifactDir}/platform-new-entity-auto-provision-modal.png`;
  await page.screenshot({ path: modalPath });
  console.log(`Saved screenshot: ${modalPath}`);

  // ─── 2. Logout and Login as Dr. Faisal Al-Shammari ────────────
  console.log('2. Logging in as Dr. Faisal Al-Shammari (existing user)...');
  await page.goto('http://localhost:5888/login');
  await page.waitForTimeout(500);

  const switchBtn2 = page.locator('button:has(svg.lucide-layout-grid)').first();
  if (await switchBtn2.isVisible()) await switchBtn2.click();

  await page.fill('input#email', 'faisal.pharmacist.1795103517178@metapharsic.sa');
  await page.fill('input#password', 'Sovereign@2026');
  await page.click('button[type="submit"]');

  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 10000 });
  console.log('Logged in as Dr. Faisal successfully!');

  // ─── 3. Verify Clean Slate Products Catalog ────────────────────
  console.log('3. Navigating to Products Catalog...');
  await page.goto('http://localhost:5888/products');
  await page.waitForTimeout(2000);

  const prodPath = `${artifactDir}/faisal-clean-slate-products.png`;
  await page.screenshot({ path: prodPath });
  console.log(`Saved screenshot: ${prodPath}`);

  // ─── 4. Verify Clean Slate Inventory Overview ──────────────────
  console.log('4. Navigating to Inventory...');
  await page.goto('http://localhost:5888/inventory');
  await page.waitForTimeout(2000);

  const invPath = `${artifactDir}/faisal-clean-slate-inventory.png`;
  await page.screenshot({ path: invPath });
  console.log(`Saved screenshot: ${invPath}`);

  // ─── 5. Verify Clean Slate POS ────────────────────────────────
  console.log('5. Navigating to POS...');
  await page.goto('http://localhost:5888/pos');
  await page.waitForTimeout(2500);

  const posPath = `${artifactDir}/faisal-clean-slate-pos.png`;
  await page.screenshot({ path: posPath });
  console.log(`Saved screenshot: ${posPath}`);

  console.log('All clean slate verification screenshots captured successfully!');
  await browser.close();
}

run().catch((err) => {
  console.error('Error during verification:', err);
  process.exit(1);
});
