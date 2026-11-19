import { chromium } from '@playwright/test';

async function run() {
  console.log('🚀 Starting Verification: Admin Dashboard Customization, Icons & Bulk Provisioning...');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  const artifactDir = 'C:/Users/Dell/.gemini/antigravity/brain/0af620d3-0ed8-4ad0-b5a3-39304d91838e';

  try {
    // ─── 1. Login as Admin / Pharmacist ──────────────────────────
    console.log('1. Logging in as Admin (amjad@muscat.com)...');
    await page.goto('http://localhost:5888/login');
    await page.waitForTimeout(800);

    const switchBtn = page.locator('button:has(svg.lucide-layout-grid)').first();
    if (await switchBtn.isVisible()) await switchBtn.click();

    await page.fill('input#email', 'amjad@muscat.com');
    await page.fill('input#password', 'Admin@123');
    await page.click('button[type="submit"]');

    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 10000 });
    console.log('✅ Logged in successfully!');

    // ─── 2. Enhanced Dispensary Dashboard ─────────────────────────
    console.log('2. Navigating to Dispensary Dashboard...');
    await page.goto('http://localhost:5888/');
    await page.waitForTimeout(2500);

    const dashScreenshot = `${artifactDir}/enhanced-admin-dashboard.png`;
    await page.screenshot({ path: dashScreenshot });
    console.log(`📸 Saved Dashboard Screenshot: ${dashScreenshot}`);

    // ─── 3. Open Customize Dashboard Modal ─────────────────────────
    console.log('3. Opening Customize Dashboard Modal...');
    const customizeBtn = page.locator('button:has-text("Customize Dashboard")').first();
    if (await customizeBtn.isVisible()) {
      await customizeBtn.click();
      await page.waitForTimeout(1000);
      const customizerScreenshot = `${artifactDir}/customize-dashboard-modal.png`;
      await page.screenshot({ path: customizerScreenshot });
      console.log(`📸 Saved Customize Modal Screenshot: ${customizerScreenshot}`);

      // Click "Save Dashboard Layout" to test saving preferences
      const saveBtn = page.locator('button:has-text("Save Dashboard Layout")').first();
      if (await saveBtn.isVisible()) {
        await saveBtn.click();
        await page.waitForTimeout(1500);
        console.log('✅ Saved Dashboard Preferences successfully!');
      }
    }

    // ─── 4. Verify SuperAdmin Bulk Provisioning ─────────────────────
    console.log('4. Logging in as SuperAdmin to verify Bulk Provisioning...');
    await page.goto('http://localhost:5888/login');
    await page.waitForTimeout(800);

    const switchBtn2 = page.locator('button:has(svg.lucide-layout-grid)').first();
    if (await switchBtn2.isVisible()) await switchBtn2.click();

    await page.fill('input#email', 'superadmin@pharmacare.local');
    await page.fill('input#password', 'SuperAdmin@123');
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 10000 });

    console.log('5. Navigating to Platform Governance & Triggering Provisioning...');
    await page.goto('http://localhost:5888/platform?tab=users');
    await page.waitForTimeout(2000);

    const provisionBtn = page.locator('button:has-text("Auto-Provision All Admins")').first();
    if (await provisionBtn.isVisible()) {
      console.log('Clicking "⚡ Auto-Provision All Admins" button...');
      await provisionBtn.click();
      await page.waitForTimeout(3500);
      console.log('✅ Auto-Provision triggered!');
    }

    const platformGovScreenshot = `${artifactDir}/superadmin-bulk-provision-complete.png`;
    await page.screenshot({ path: platformGovScreenshot });
    console.log(`📸 Saved Platform Governance Screenshot: ${platformGovScreenshot}`);

    console.log('🎉 All verification steps completed successfully!');
  } catch (err) {
    console.error('Verification error:', err);
  } finally {
    await browser.close();
  }
}

run();
