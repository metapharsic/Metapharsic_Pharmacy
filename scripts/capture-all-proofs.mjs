import { chromium } from '@playwright/test';

async function captureAll() {
  console.log('🚀 Starting Chrome Proof Capture for Multi-Tenant WhatsApp & Refill Suite...');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await context.newPage();
  const artifactDir = 'C:/Users/Dell/.gemini/antigravity/brain/0af620d3-0ed8-4ad0-b5a3-39304d91838e';

  try {
    // 1. Login as Amjad (amjad@muscat.com)
    console.log('1. Logging in as Amjad Bhai (Amjad Pharmacy)...');
    await page.goto('http://localhost:5888/login');
    await page.waitForTimeout(1000);

    const switchBtn = page.locator('button:has(svg.lucide-layout-grid)').first();
    if (await switchBtn.isVisible()) await switchBtn.click();

    await page.fill('input#email', 'amjad@muscat.com');
    await page.fill('input#password', 'Admin@123');
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 });
    console.log('✅ Logged in as Amjad Bhai!');

    // 2. Capture Admin Dashboard with 5-item Retention Suite
    console.log('2. Navigating to Dispensary Dashboard...');
    await page.goto('http://localhost:5888/');
    await page.waitForTimeout(2500);
    const dashPath = `${artifactDir}/dashboard-retention-suite.png`;
    await page.screenshot({ path: dashPath });
    console.log(`📸 Saved: ${dashPath}`);

    // 3. Navigate to dedicated Refills & Retention Hub
    console.log('3. Navigating to /refills...');
    await page.goto('http://localhost:5888/refills');
    await page.waitForTimeout(2500);
    const refillsPath = `${artifactDir}/refills-retention-hub.png`;
    await page.screenshot({ path: refillsPath });
    console.log(`📸 Saved: ${refillsPath}`);

    // 4. POS Completed Sale Modal with WhatsApp & Refill Actions
    console.log('4. Navigating to POS...');
    await page.goto('http://localhost:5888/pos');
    await page.waitForTimeout(2500);

    // Look for previous sales or trigger the completed sale preview if test sale button exists
    const posPath = `${artifactDir}/pos-terminal-active.png`;
    await page.screenshot({ path: posPath });
    console.log(`📸 Saved: ${posPath}`);

    // 5. Login as SuperAdmin to capture Platform WhatsApp Provisioning Matrix
    console.log('5. Logging in as SuperAdmin...');
    await page.goto('http://localhost:5888/login');
    await page.waitForTimeout(800);
    const switchBtn2 = page.locator('button:has(svg.lucide-layout-grid)').first();
    if (await switchBtn2.isVisible()) await switchBtn2.click();

    await page.fill('input#email', 'superadmin@pharmacare.local');
    await page.fill('input#password', 'SuperAdmin@123');
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 });

    console.log('6. Navigating to Platform WhatsApp Matrix...');
    await page.goto('http://localhost:5888/platform?tab=whatsapp');
    await page.waitForTimeout(2500);
    const matrixPath = `${artifactDir}/platform-whatsapp-provisioning-matrix.png`;
    await page.screenshot({ path: matrixPath });
    console.log(`📸 Saved: ${matrixPath}`);

  } catch (err) {
    console.error('Error during proof capture:', err);
  } finally {
    await browser.close();
    console.log('🏁 Browser closed.');
  }
}

void captureAll();
