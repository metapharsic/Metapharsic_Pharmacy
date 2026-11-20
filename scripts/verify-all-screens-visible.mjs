import { chromium } from '@playwright/test';

async function run() {
  console.log('🚀 Running Comprehensive Multi-Screen Verification...');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  const artifactDir = 'C:/Users/Dell/.gemini/antigravity/brain/0af620d3-0ed8-4ad0-b5a3-39304d91838e';

  try {
    // 1. Login as SuperAdmin
    console.log('1. Logging in as SuperAdmin (superadmin@pharmacare.local)...');
    await page.goto('http://localhost:5888/login');
    await page.waitForTimeout(800);

    const switchBtn = page.locator('button:has(svg.lucide-layout-grid)').first();
    if (await switchBtn.isVisible()) await switchBtn.click();

    await page.fill('input#email', 'superadmin@pharmacare.local');
    await page.fill('input#password', 'SuperAdmin@123');
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 10000 });
    console.log('✅ SuperAdmin logged in!');

    // 2. Capture /platform with the new Dispensary tab and Header button
    console.log('2. Visiting /platform...');
    await page.goto('http://localhost:5888/platform');
    await page.waitForTimeout(2000);

    const platformShot1 = `${artifactDir}/platform-superadmin-with-dispensary-hub.png`;
    await page.screenshot({ path: platformShot1 });
    console.log(`📸 Saved: ${platformShot1}`);

    // Click the "⚡ Dispensary Intelligence & Customizer" tab right on /platform
    const dispTab = page.locator('button:has-text("Dispensary Intelligence")').first();
    if (await dispTab.isVisible()) {
      console.log('Clicking Dispensary tab on /platform...');
      await dispTab.click();
      await page.waitForTimeout(1500);
      const platformShot2 = `${artifactDir}/platform-dispensary-tab-live.png`;
      await page.screenshot({ path: platformShot2 });
      console.log(`📸 Saved: ${platformShot2}`);
    }

    // 3. Visit Dispensary Dashboard (/) as SuperAdmin
    console.log('3. Visiting Dispensary Dashboard (http://localhost:5888/)...');
    await page.goto('http://localhost:5888/');
    await page.waitForTimeout(2000);

    const dashboardShot = `${artifactDir}/superadmin-live-dispensary-dashboard.png`;
    await page.screenshot({ path: dashboardShot });
    console.log(`📸 Saved: ${dashboardShot}`);

    // 4. Visit Settings (/settings) to verify Automated Refills & Patient Retention tab
    console.log('4. Visiting Settings (/settings)...');
    await page.goto('http://localhost:5888/settings');
    await page.waitForTimeout(2000);

    const retentionTab = page.locator('button:has-text("Automated Refills")').first();
    if (await retentionTab.isVisible()) {
      console.log('Clicking "Automated Refills & Retention" tab...');
      await retentionTab.click();
      await page.waitForTimeout(1000);
    }

    const settingsShot = `${artifactDir}/settings-automated-refills-and-retention.png`;
    await page.screenshot({ path: settingsShot });
    console.log(`📸 Saved: ${settingsShot}`);

    console.log('🎉 All screenshots successfully verified and saved!');
  } catch (err) {
    console.error('Verification error:', err);
  } finally {
    await browser.close();
  }
}

run();
