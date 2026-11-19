const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const [product, batch, prescription, purchase, sale, supplier] = await Promise.all([
    prisma.product.findFirst({ select: { id: true } }),
    prisma.batch.findFirst({ select: { id: true } }),
    prisma.prescription.findFirst({ select: { id: true } }),
    prisma.purchase.findFirst({ select: { id: true } }),
    prisma.sale.findFirst({ select: { id: true } }),
    prisma.supplier.findFirst({ select: { id: true } }),
  ]);

  const dynamicUrls = [];
  if (product) {
    dynamicUrls.push(`/products/${product.id}`);
    dynamicUrls.push(`/products/${product.id}/edit`);
  }
  if (batch) {
    dynamicUrls.push(`/batches/${batch.id}`);
  }
  if (prescription) {
    dynamicUrls.push(`/prescriptions/${prescription.id}`);
  }
  if (purchase) {
    dynamicUrls.push(`/purchases/${purchase.id}`);
    dynamicUrls.push(`/purchases/${purchase.id}/receive`);
  }
  if (sale) {
    dynamicUrls.push(`/sales/${sale.id}`);
  }
  if (supplier) {
    dynamicUrls.push(`/suppliers/${supplier.id}`);
  }

  console.log('Testing dynamic URLs:', dynamicUrls);

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('pageerror', (err) => {
    console.error(` [PAGE ERROR on ${page.url()}]`, err.message);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error(` [CONSOLE ERROR on ${page.url()}]`, msg.text());
    }
  });

  await page.goto('http://localhost:5888/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'admin@pharmacare.local');
  await page.fill('input[type="password"]', 'Admin@123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  for (const url of dynamicUrls) {
    try {
      console.log(`Navigating to ${url}...`);
      await page.goto(`http://localhost:5888${url}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1000);
      const text = await page.textContent('body');
      if (text.includes('Application error: a client-side exception has occurred')) {
        console.error(`❌ CRASH on ${url}!`);
      } else {
        console.log(`✅ ${url}: OK`);
      }
    } catch (e) {
      console.error(`⚠️ Error loading ${url}: ${e.message}`);
    }
  }

  await browser.close();
  await prisma.$disconnect();
}

main().catch(console.error);

