const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const caughtErrors = [];
  page.on('pageerror', (err) => {
    caughtErrors.push({ url: page.url(), type: 'pageerror', message: err.message, stack: err.stack });
    console.error(`\n❌ [PAGE ERROR on ${page.url()}]:`, err.message);
    console.error(err.stack);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore 404 image errors
      if (!text.includes('status of 404')) {
        caughtErrors.push({ url: page.url(), type: 'console.error', text });
        console.error(`\n❌ [CONSOLE ERROR on ${page.url()}]:`, text);
      }
    }
  });

  console.log('Logging in...');
  await page.goto('http://localhost:5888/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'admin@pharmacare.local');
  await page.fill('input[type="password"]', 'Admin@123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  // Collect all sidebar navigation links
  const links = await page.$$eval('nav a[href], aside a[href]', (anchors) =>
    anchors.map((a) => ({ href: a.getAttribute('href'), text: a.innerText.trim() }))
  );

  console.log(`Discovered ${links.length} sidebar navigation links:`);
  for (const l of links) {
    console.log(`  - ${l.text || 'link'} -> ${l.href}`);
  }

  // Click each link sequentially using client-side SPA navigation
  for (const link of links) {
    if (!link.href || link.href.startsWith('#') || link.href.includes('logout')) continue;
    console.log(`\nSPA Navigating to [${link.text}] (${link.href})...`);
    try {
      const anchor = page.locator(`a[href="${link.href}"]`).first();
      if (await anchor.isVisible()) {
        await anchor.click();
        await page.waitForTimeout(1200);
        const bodyText = await page.textContent('body');
        if (bodyText.includes('Application error: a client-side exception has occurred')) {
          console.error(`💥💥💥 CLIENT EXCEPTION CRASH DETECTED ON ${link.href} (${link.text})!`);
        } else {
          console.log(`✅ ${link.href} rendered fine`);
        }
      } else {
        // Fallback to router push via goto if collapsed
        await page.goto(`http://localhost:5888${link.href}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        const bodyText = await page.textContent('body');
        if (bodyText.includes('Application error: a client-side exception has occurred')) {
          console.error(`💥💥💥 CLIENT EXCEPTION CRASH DETECTED ON ${link.href}!`);
        } else {
          console.log(`✅ ${link.href} rendered fine`);
        }
      }
    } catch (e) {
      console.error(`Error navigating to ${link.href}:`, e.message);
    }
  }

  await browser.close();
  console.log('\n=== SPA NAVIGATION AUDIT COMPLETE ===');
  console.log(`Total fatal errors: ${caughtErrors.length}`);
  if (caughtErrors.length > 0) {
    console.log('Details:', JSON.stringify(caughtErrors, null, 2));
  }
}

main().catch(console.error);

