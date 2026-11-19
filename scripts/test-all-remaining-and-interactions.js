const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const allPageErrors = [];
  page.on('pageerror', (err) => {
    allPageErrors.push({ url: page.url(), message: err.message, stack: err.stack });
    console.error(` [PAGE ERROR on ${page.url()}]`, err.message);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error(` [CONSOLE ERROR on ${page.url()}]`, msg.text());
    }
  });

  console.log('Logging in...');
  await page.goto('http://localhost:5888/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'admin@pharmacare.local');
  await page.fill('input[type="password"]', 'Admin@123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  // 1. Test interactions on /settings
  console.log('\n--- Testing /settings Tabs & Interactions ---');
  await page.goto('http://localhost:5888/settings', { waitUntil: 'networkidle' });
  const tabs = ['Billing & Invoice Rules', 'Inventory & Alert Horizons', 'Period Lock & Audit', 'Dispensary Profile & Licenses'];
  for (const tabText of tabs) {
    try {
      console.log(`Clicking tab: "${tabText}"...`);
      await page.getByRole('tab', { name: new RegExp(tabText, 'i') }).click();
      await page.waitForTimeout(500);
      const text = await page.textContent('body');
      if (text.includes('Application error: a client-side exception has occurred')) {
        console.error(`❌ CRASH on /settings tab "${tabText}"!`);
      } else {
        console.log(`✅ Tab "${tabText}" OK`);
      }
    } catch (e) {
      console.log(`⚠️ Tab "${tabText}" click failed: ${e.message}`);
    }
  }

  // 2. Test interactions on /users
  console.log('\n--- Testing /users Modal Interactions ---');
  await page.goto('http://localhost:5888/users', { waitUntil: 'networkidle' });
  try {
    console.log('Clicking "Add User" button...');
    const addBtn = page.getByRole('button', { name: /Add User/i });
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(1000);
      let text = await page.textContent('body');
      if (text.includes('Application error: a client-side exception has occurred')) {
        console.error(`❌ CRASH when opening Add User modal!`);
      } else {
        console.log(`✅ Add User modal opened successfully`);
      }
      // Close modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  } catch (e) {
    console.log(`⚠️ Add User interaction error: ${e.message}`);
  }

  try {
    console.log('Testing Edit User button...');
    const editBtn = page.locator('button[title="Edit user"]').first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
      await page.waitForTimeout(1000);
      let text = await page.textContent('body');
      if (text.includes('Application error: a client-side exception has occurred')) {
        console.error(`❌ CRASH when opening Edit User modal!`);
      } else {
        console.log(`✅ Edit User modal opened successfully`);
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  } catch (e) {
    console.log(`⚠️ Edit User interaction error: ${e.message}`);
  }

  // 3. Test remaining secondary routes
  const secondaryPages = [
    '/users/new',
    '/products/new',
    '/products/hsn-codes',
    '/customers/new',
    '/suppliers/new',
    '/prescriptions/new',
    '/prescriptions/pending',
    '/purchases/new',
    '/purchases/agency',
    '/purchases/returns',
    '/purchases/returns/new',
    '/returns/sales',
    '/returns/sales/new',
    '/finance/payables',
    '/finance/receivables',
    '/finance/tally',
    '/finance/vouchers/receipt',
    '/gst/reports',
    '/expiry',
    '/expiry/expiring',
    '/expiry/expired',
    '/batches/expiring',
    '/pos-camera'
  ];

  console.log(`\n--- Testing ${secondaryPages.length} Secondary Pages ---`);
  for (const p of secondaryPages) {
    try {
      await page.goto(`http://localhost:5888${p}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(800);
      const text = await page.textContent('body');
      if (text.includes('Application error: a client-side exception has occurred')) {
        console.error(`❌ CRASH on ${p}!`);
      } else {
        console.log(`✅ ${p}: OK`);
      }
    } catch (err) {
      console.log(`⚠️ ${p}: ${err.message}`);
    }
  }

  await browser.close();
  console.log('\n=== COMPLETE INTERACTION TEST FINISHED ===');
  console.log(`Total fatal errors captured: ${allPageErrors.length}`);
}

main().catch(console.error);

