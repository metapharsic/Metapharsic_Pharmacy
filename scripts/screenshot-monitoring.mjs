import { chromium } from '@playwright/test';

async function run() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  await page.goto('http://localhost:5888/login');
  await page.waitForTimeout(500);

  const btn = page.locator('button:has(svg.lucide-layout-grid)').first();
  if (await btn.isVisible()) await btn.click();

  await page.fill('input#email', 'superadmin@pharmacare.local');
  await page.fill('input#password', 'SuperAdmin@123');
  await page.click('button[type="submit"]');

  await page.waitForURL((u) => !u.pathname.includes('/login'));
  await page.goto('http://localhost:5888/platform?tab=monitoring');
  await page.waitForTimeout(2000);

  const card = page.locator('text=Sovereign Private Cloud Topologies & Dedicated Pod Telemetry').first();
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  await page.screenshot({ path: 'C:/Users/Dell/.gemini/antigravity/brain/0af620d3-0ed8-4ad0-b5a3-39304d91838e/sovereign-private-monitoring-scrolled.png' });
  console.log('Scrolled screenshot captured!');
  await browser.close();
}

run();
