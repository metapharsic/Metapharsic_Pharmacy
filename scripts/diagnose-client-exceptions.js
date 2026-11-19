const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors = [];
  page.on('pageerror', (err) => {
    errors.push({ type: 'pageerror', message: err.message, stack: err.stack });
    console.error(' [PAGE ERROR]', err.message);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console.error', text: msg.text() });
      console.error(' [CONSOLE ERROR]', msg.text());
    }
  });

  console.log('Logging in at http://localhost:5888/login...');
  await page.goto('http://localhost:5888/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'admin@pharmacare.local');
  await page.fill('input[type="password"]', 'Admin@123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  const pagesToTest = [
    '/settings',
    '/settings/general',
    '/settings/organization',
    '/users',
    '/roles',
    '/reports',
    '/reports/sales',
    '/reports/inventory',
    '/reports/compliance',
    '/reports/narcotics',
    '/reports/supplier',
    '/pos',
    '/pos2',
    '/products',
    '/products/categories',
    '/inventory',
    '/inventory/adjustments',
    '/inventory/movements',
    '/batches',
    '/finance',
    '/gst',
    '/suppliers',
    '/purchases',
    '/customers',
    '/prescriptions',
    '/audit',
  ];

  console.log(`\nTesting ${pagesToTest.length} pages in Chrome headless...`);
  const report = {};

  for (const p of pagesToTest) {
    const pageErrors = [];
    const onErr = (err) => pageErrors.push('PAGE_ERR: ' + err.message);
    const onConsole = (msg) => {
      if (msg.type() === 'error') pageErrors.push('CONSOLE_ERR: ' + msg.text());
    };

    page.on('pageerror', onErr);
    page.on('console', onConsole);

    try {
      const resp = await page.goto(`http://localhost:5888${p}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1000);
      const title = await page.title();
      const bodyText = await page.textContent('body');
      const hasClientCrash = bodyText.includes('Application error: a client-side exception has occurred');
      
      report[p] = {
        status: resp ? resp.status() : 'no-response',
        hasClientCrash,
        pageErrors: [...pageErrors],
        title,
      };

      if (hasClientCrash || pageErrors.length > 0) {
        console.log(`❌ ${p}: CRASH=${hasClientCrash}, Errors=${pageErrors.length}`);
        pageErrors.forEach(e => console.log('   -> ' + e.slice(0, 200)));
      } else {
        console.log(`✅ ${p}: OK`);
      }
    } catch (err) {
      report[p] = { error: err.message, pageErrors };
      console.log(`⚠️ ${p}: Timeout/Nav error: ${err.message}`);
    } finally {
      page.off('pageerror', onErr);
      page.off('console', onConsole);
    }
  }

  await browser.close();
  console.log('\n=== DIAGNOSIS SUMMARY ===');
  const crashed = Object.entries(report).filter(([_, v]) => v.hasClientCrash || (v.pageErrors && v.pageErrors.length > 0));
  console.log(`Total pages: ${pagesToTest.length}, Crashed / with errors: ${crashed.length}`);
  for (const [k, v] of crashed) {
    console.log(`\nPage: ${k}`);
    console.log(`  Crash banner present: ${v.hasClientCrash}`);
    console.log(`  Errors:`, v.pageErrors);
  }
}

main().catch(console.error);

