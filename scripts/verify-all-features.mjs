import { chromium } from '@playwright/test';

async function run() {
  console.log('Launching headless browser to verify all requested features...');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();

  const artifactDir = 'C:/Users/Dell/.gemini/antigravity/brain/0af620d3-0ed8-4ad0-b5a3-39304d91838e';

  // ─── 1. Login as SuperAdmin ─────────────────────────────────────
  console.log('1. Logging in as SuperAdmin...');
  await page.goto('http://localhost:5888/login');
  await page.waitForTimeout(500);

  const switchBtn = page.locator('button:has(svg.lucide-layout-grid)').first();
  if (await switchBtn.isVisible()) await switchBtn.click();

  await page.fill('input#email', 'superadmin@pharmacare.local');
  await page.fill('input#password', 'SuperAdmin@123');
  await page.click('button[type="submit"]');

  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 10000 });
  console.log('Logged in as SuperAdmin successfully!');

  // ─── 2. SuperAdmin User Governance & Credential Reveal ─────────
  console.log('2. Navigating to Platform -> Users Governance...');
  await page.goto('http://localhost:5888/platform?tab=users');
  await page.waitForTimeout(2500);

  // Click on the first "Show" password eye button to reveal a user password
  const showBtn = page.locator('button:has-text("Show")').first();
  if (await showBtn.isVisible()) {
    console.log('Clicking password reveal Eye button...');
    await showBtn.click();
    await page.waitForTimeout(500);
  }

  const superAdminUsersPath = `${artifactDir}/superadmin-user-credentials-vault.png`;
  await page.screenshot({ path: superAdminUsersPath });
  console.log(`Saved screenshot: ${superAdminUsersPath}`);

  // ─── 3. Reports Hub - Cash Drawer Intelligence (48H) ───────────
  console.log('3. Navigating to Reports Hub -> Cash Drawer Intelligence...');
  await page.goto('http://localhost:5888/reports');
  await page.waitForTimeout(2000);

  // Click on the Cash Drawer Surveillance tab
  const drawerTab = page.locator('button:has-text("Cash Drawer Intelligence"), button:has-text("Surveillance")').first();
  if (await drawerTab.isVisible()) {
    console.log('Clicking Cash Drawer tab...');
    await drawerTab.click();
    await page.waitForTimeout(1500);
  }

  const reportsDrawerPath = `${artifactDir}/reports-cash-drawer-intelligence-48h.png`;
  await page.screenshot({ path: reportsDrawerPath });
  console.log(`Saved screenshot: ${reportsDrawerPath}`);

  // ─── 4. Finance Page & Admin Statement Generator ──────────────
  console.log('4. Navigating to Finance Page...');
  await page.goto('http://localhost:5888/finance');
  await page.waitForTimeout(2000);

  // Click on "Statutory Statement Generator" button
  const statementBtn = page.locator('button:has-text("Statutory Statement Generator"), button:has-text("Statement Generator")').first();
  if (await statementBtn.isVisible()) {
    console.log('Opening Statutory Statement Generator modal...');
    await statementBtn.click();
    await page.waitForTimeout(1000);

    // Click "Generate Statement Preview" button inside modal
    const previewBtn = page.locator('button:has-text("Generate Statement Preview")').first();
    if (await previewBtn.isVisible()) {
      await previewBtn.click();
      await page.waitForTimeout(1000);
    }
  }

  const statementPath = `${artifactDir}/admin-statutory-tax-statement-modal.png`;
  await page.screenshot({ path: statementPath });
  console.log(`Saved screenshot: ${statementPath}`);

  // ─── 5. Store Admin MFA Settings & Uncollapsed Sidebar ─────────
  console.log('5. Navigating to Settings Page...');
  await page.goto('http://localhost:5888/settings');
  await page.waitForTimeout(2000);

  // Click on the "Admin Security & MFA" tab
  const mfaTab = page.locator('button:has-text("Admin Security & MFA"), button:has-text("MFA")').first();
  if (await mfaTab.isVisible()) {
    console.log('Clicking Admin Security & MFA tab...');
    await mfaTab.click();
    await page.waitForTimeout(1000);
  }

  const settingsMfaPath = `${artifactDir}/admin-security-mfa-settings.png`;
  await page.screenshot({ path: settingsMfaPath });
  console.log(`Saved screenshot: ${settingsMfaPath}`);

  console.log('All verification screenshots captured successfully!');
  await browser.close();
}

run().catch((err) => {
  console.error('Error during verification:', err);
  process.exit(1);
});
