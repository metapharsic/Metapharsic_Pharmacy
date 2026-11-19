const { chromium } = require('playwright');

async function testHydrationCrash() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors = [];
  page.on('pageerror', (err) => {
    errors.push({ type: 'pageerror', message: err.message });
    console.error('❌ [PAGE ERROR]:', err.message);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console.error', text: msg.text() });
      console.error('❌ [CONSOLE ERROR]:', msg.text());
    }
  });

  console.log('Logging in...');
  await page.goto('http://localhost:5888/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'admin@pharmacare.local');
  await page.fill('input[type="password"]', 'Admin@123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  // Now populate localStorage with a POS cart!
  console.log('Simulating existing POS cart in localStorage...');
  await page.evaluate(() => {
    localStorage.setItem(
      'pharmacare_pos_cart',
      JSON.stringify([
        {
          productId: 'prod-1',
          name: 'Paracetamol 500mg',
          mrp: 20,
          quantity: 2,
          availableQuantity: 100,
        },
      ])
    );
  });

  console.log('Navigating to /settings with populated localStorage cart...');
  await page.goto('http://localhost:5888/settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const text = await page.textContent('body');
  const hasCrash = text.includes('Application error: a client-side exception has occurred');
  console.log(`Crash detected on /settings when localStorage is populated: ${hasCrash}`);

  await browser.close();
}

testHydrationCrash().catch(console.error);

