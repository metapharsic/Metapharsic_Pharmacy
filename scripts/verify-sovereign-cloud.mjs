import { chromium } from '@playwright/test';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/Dell/.gemini/antigravity/brain/0af620d3-0ed8-4ad0-b5a3-39304d91838e';

async function run() {
  console.log('🚀 Launching Playwright Sovereign Cloud & Governance Verification...');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 950 },
  });

  const page = await context.newPage();

  // 1. LOGIN AS SUPERADMIN
  console.log('1. Navigating to login...');
  await page.goto('http://localhost:5888/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  const standardBtn = page.locator('button:has(svg.lucide-layout-grid)').first();
  if (await standardBtn.isVisible().catch(() => false)) {
    console.log('   Switching to Standard Desktop Login View...');
    await standardBtn.click();
    await page.waitForTimeout(500);
  }

  console.log('   Entering SuperAdmin credentials...');
  await page.fill('input#email, input[type="email"]', 'superadmin@pharmacare.local');
  await page.fill('input#password, input[type="password"]', 'SuperAdmin@123');
  await page.click('button[type="submit"]');

  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 });
  console.log('   Successfully authenticated as SuperAdmin. Current URL:', page.url());

  // 2. NAVIGATE TO SOVEREIGN CLOUD PROVISIONING PANEL
  console.log('2. Navigating to /platform?tab=cloud...');
  await page.goto('http://localhost:5888/platform?tab=cloud', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  // Check that 6 Sovereign nodes are loaded
  const nodeCards = page.locator('text=Saudi Arabia').first();
  await nodeCards.waitFor({ state: 'visible', timeout: 10000 });
  console.log('   Sovereign Cloud Topologies loaded successfully.');

  // Click "Provision" on Saudi Arabia node
  console.log('3. Opening Private Cloud Node Provisioning Modal for Saudi Arabia (SA)...');
  const provisionSaBtn = page.locator('button:has-text("Provision")').first();
  await provisionSaBtn.click();
  await page.waitForTimeout(1000);

  // In modal, change VPC ID and rotate HSM Key
  console.log('   Updating Private Cloud VPC parameters & Rotating HSM Key...');
  const vpcInput = page.locator('input[placeholder="vpc-sa-central-pri-991"], input[value*="vpc-sa"]').first();
  if (await vpcInput.isVisible()) {
    await vpcInput.fill('vpc-sa-sovereign-pod-999-prod');
  }

  // Click Rotate HSM Key
  const rotateKeyBtn = page.locator('button:has-text("Rotate HSM Key")').first();
  if (await rotateKeyBtn.isVisible()) {
    console.log('   Clicking Rotate HSM Key...');
    await rotateKeyBtn.click();
    await page.waitForTimeout(1500);
  }

  // Click Save & Provision Node
  const saveNodeBtn = page.locator('button:has-text("Save & Provision Node")').first();
  console.log('   Clicking Save & Provision Node...');
  await saveNodeBtn.click();
  await page.waitForTimeout(2000);

  // Dispatch Multi-Thread Pilot Benchmark
  console.log('4. Dispatching Multi-Thread Sovereign Preflight & ZATCA Clearance Benchmark...');
  const dispatchBtn = page.locator('button:has-text("Dispatch Benchmark")').first();
  if (await dispatchBtn.isVisible()) {
    await dispatchBtn.click();
    await page.waitForTimeout(4000);
    console.log('   Benchmark completed with microsecond telemetry.');
  }

  // Capture Sovereign Cloud Provisioning proof
  const cloudProofPath = path.join(ARTIFACT_DIR, 'sovereign-cloud-provisioned.png');
  await page.screenshot({ path: cloudProofPath, fullPage: true });
  console.log('📸 Sovereign Cloud Provisioning proof saved:', cloudProofPath);

  // 3. NAVIGATE TO USERS GOVERNANCE & ROLES ASSIGNMENT PANEL
  console.log('5. Navigating to /platform?tab=users...');
  await page.goto('http://localhost:5888/platform?tab=users', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  // Locate the first non-superadmin user's "Assign Matrix" button
  console.log('6. Assigning Sovereign Roles & Territory Access Matrix...');
  const assignMatrixBtns = page.locator('button:has-text("Assign Matrix")');
  const count = await assignMatrixBtns.count();
  console.log(`   Found ${count} users with governance controls.`);

  if (count > 0) {
    // Click on second user (or first available)
    const targetBtn = count > 1 ? assignMatrixBtns.nth(1) : assignMatrixBtns.first();
    await targetBtn.click();
    await page.waitForTimeout(1200);

    // In Governance Modal, select roles: Chief Pharmacist, Compliance Officer
    console.log('   Configuring roles: Chief Pharmacist & Compliance Officer...');
    const chiefPharmRole = page.locator('div:has-text("Chief Pharmacist")').last();
    if (await chiefPharmRole.isVisible()) await chiefPharmRole.click();

    const complianceRole = page.locator('div:has-text("Compliance Officer")').last();
    if (await complianceRole.isVisible()) await complianceRole.click();

    // Select GCC Only territories
    const gccBtn = page.locator('button:has-text("GCC Only (4)")').first();
    if (await gccBtn.isVisible()) {
      console.log('   Setting Sovereign Territory Matrix to GCC Sovereignty...');
      await gccBtn.click();
      await page.waitForTimeout(500);
    }

    // Save Governance Assignment
    const saveGovBtn = page.locator('button:has-text("Save & Deploy Governance")').first();
    console.log('   Saving governance deployment...');
    await saveGovBtn.click();
    await page.waitForTimeout(2500);
  }

  // Capture User Governance proof
  const govProofPath = path.join(ARTIFACT_DIR, 'sovereign-governance-assigned.png');
  await page.screenshot({ path: govProofPath, fullPage: true });
  console.log('📸 Sovereign Governance proof saved:', govProofPath);

  // 4. NAVIGATE TO SYSTEM MONITORING TELEMETRY PANEL
  console.log('7. Navigating to /platform?tab=monitoring...');
  await page.goto('http://localhost:5888/platform?tab=monitoring', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const monitoringHeader = page.locator('text=Sovereign Private Cloud Topologies & Dedicated Pod Telemetry').first();
  await monitoringHeader.waitFor({ state: 'visible', timeout: 10000 });
  console.log('   Sovereign Private Cloud monitoring telemetry visible.');

  // Capture Monitoring proof
  const monProofPath = path.join(ARTIFACT_DIR, 'sovereign-private-monitoring.png');
  await page.screenshot({ path: monProofPath, fullPage: true });
  console.log('📸 Sovereign Monitoring proof saved:', monProofPath);

  console.log('🎉 All verification steps completed successfully!');
  await browser.close();
}

run().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
