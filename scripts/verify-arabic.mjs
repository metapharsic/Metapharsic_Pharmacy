import { chromium } from '@playwright/test';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/Dell/.gemini/antigravity/brain/0af620d3-0ed8-4ad0-b5a3-39304d91838e';

async function run() {
  console.log('🚀 Starting Headless Browser Verification...');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'ar-SA',
  });

  // Pre-set localStorage & Cookies for Pure Arabic and Saudi Arabia territory
  await context.addInitScript(() => {
    localStorage.setItem('mpharm_locale', 'ar');
    localStorage.setItem('mpharm_lang_mode', 'ar-pure');
    localStorage.setItem('mpharm_territory', 'SA');
  });

  await context.addCookies([
    {
      name: 'NEXT_LOCALE',
      value: 'ar',
      domain: 'localhost',
      path: '/',
    },
  ]);

  const page = await context.newPage();

  console.log('1. Navigating to login page...');
  await page.goto('http://localhost:5888/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Switch to Standard Desktop Login View using the layout-grid icon button
  const standardBtn = page.locator('button:has(svg.lucide-layout-grid)').first();
  if (await standardBtn.isVisible().catch(() => false)) {
    console.log('   Switching to Standard Desktop Login View...');
    await standardBtn.click();
    await page.waitForTimeout(600);
  }

  // Fill credentials
  await page.fill('input#email, input[type="email"]', 'admin@pharmacare.local');
  await page.fill('input#password, input[type="password"]', 'Admin@123');
  await page.click('button[type="submit"]');

  console.log('2. Waiting for navigation after login...');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 });
  console.log('   Current URL:', page.url());

  // Set pure Arabic mode & Saudi Arabia territory in localStorage and cookie
  await page.evaluate(() => {
    localStorage.setItem('mpharm_locale', 'ar');
    localStorage.setItem('mpharm_lang_mode', 'ar-pure');
    localStorage.setItem('mpharm_territory', 'SA');
    document.cookie = 'NEXT_LOCALE=ar; path=/; max-age=31536000';
  });

  // 3. Inspect Inventory Page
  console.log('3. Navigating to /inventory...');
  await page.goto('http://localhost:5888/inventory', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // If language toggle dropdown is visible, click it and ensure Pure Arabic is selected
  try {
    const langBtn = page.locator('button[title*="العربية"], button[title*="English"], button:has-text("AR"), button:has-text("EN")').first();
    if (await langBtn.isVisible()) {
      await langBtn.click();
      await page.waitForTimeout(400);
      const pureArOption = page.locator('text=العربية بالكامل (Pure Arabic)').first();
      if (await pureArOption.isVisible()) {
        console.log('   Selecting "العربية بالكامل (Pure Arabic)" from dropdown...');
        await pureArOption.click();
        await page.waitForTimeout(1000);
      }
    }
  } catch (e) {
    console.log('   Dropdown selection fallback:', e.message);
  }

  const inventoryDir = await page.evaluate(() => document.documentElement.dir);
  const inventoryLang = await page.evaluate(() => document.documentElement.lang);
  console.log(`   HTML dir="${inventoryDir}", lang="${inventoryLang}"`);

  // Grab text contents of key elements
  const pageHeaderText = await page.locator('h1, [data-testid="page-header"]').first().innerText().catch(() => '');
  console.log('   Page Header:', pageHeaderText);

  const tableHeaders = await page.locator('th').allInnerTexts().catch(() => []);
  console.log('   Table Headers (first 8):', tableHeaders.slice(0, 8));

  const firstDrugNames = await page.locator('table tbody tr td').allInnerTexts().catch(() => []);
  console.log('   First table cells sample:', firstDrugNames.slice(0, 10));

  const screenshotInvPath = path.join(ARTIFACT_DIR, 'inventory-arabic-pure.png');
  await page.screenshot({ path: screenshotInvPath, fullPage: false });
  console.log('   📸 Saved inventory screenshot:', screenshotInvPath);

  // 4. Inspect POS Page
  console.log('4. Navigating to /pos...');
  await page.goto('http://localhost:5888/pos', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const posDir = await page.evaluate(() => document.documentElement.dir);
  console.log(`   POS HTML dir="${posDir}"`);

  const posInputs = await page.locator('input[placeholder]').all();
  for (let i = 0; i < Math.min(posInputs.length, 4); i++) {
    console.log(`   POS Input #${i + 1} placeholder:`, await posInputs[i].getAttribute('placeholder'));
  }

  const posTabs = await page.locator('button[role="tab"], .filter-tab').allInnerTexts().catch(() => []);
  console.log('   POS Tabs sample:', posTabs.slice(0, 6));

  const posProductCards = await page.locator('.grid button h4, .grid .font-semibold, [data-testid="pos-card"]').allInnerTexts().catch(() => []);
  console.log('   POS Product cards sample:', posProductCards.slice(0, 8));

  const screenshotPosPath = path.join(ARTIFACT_DIR, 'pos-arabic-pure.png');
  await page.screenshot({ path: screenshotPosPath, fullPage: false });
  console.log('   📸 Saved POS screenshot:', screenshotPosPath);

  await browser.close();
  console.log('✅ Verification Completed Successfully!');
}

run().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
