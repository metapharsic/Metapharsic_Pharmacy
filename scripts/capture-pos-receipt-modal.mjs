import { chromium } from '@playwright/test';

async function capturePosModal() {
  console.log('🚀 Launching Chrome to capture POS Completed Sale Modal...');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await context.newPage();
  const artifactDir = 'C:/Users/Dell/.gemini/antigravity/brain/0af620d3-0ed8-4ad0-b5a3-39304d91838e';

  try {
    // 1. Login as Amjad
    await page.goto('http://localhost:5888/login');
    await page.waitForTimeout(1000);
    const switchBtn = page.locator('button:has(svg.lucide-layout-grid)').first();
    if (await switchBtn.isVisible()) await switchBtn.click();
    await page.fill('input#email', 'amjad@muscat.com');
    await page.fill('input#password', 'Admin@123');
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 });

    // 2. Open POS
    await page.goto('http://localhost:5888/pos');
    await page.waitForTimeout(2000);

    // Search item in POS
    const searchInput = page.locator('input[placeholder*="Type brand"], input[placeholder*="scan barcode"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('Amlopin');
      await page.waitForTimeout(1000);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);

      // Finalize Sale
      await page.keyboard.press('F10');
      await page.waitForTimeout(1000);
      const chip500 = page.locator('button:has-text("₹500"), button:has-text("₹100"), button:has-text("₹50")').first();
      if (await chip500.isVisible()) {
        await chip500.click();
      }
      await page.waitForTimeout(500);

      const finalizeBtn = page.locator('button:has-text("Accept & Print Bill"), button:has-text("Complete Sale")').first();
      if (await finalizeBtn.isVisible()) {
        await finalizeBtn.click();
        await page.waitForTimeout(2500);
      }
    }

    const modalPath = `${artifactDir}/pos-completed-sale-with-whatsapp.png`;
    await page.screenshot({ path: modalPath });
    console.log(`📸 Saved: ${modalPath}`);

  } catch (err) {
    console.error('Error during POS modal capture:', err);
  } finally {
    await browser.close();
  }
}

void capturePosModal();
