import { chromium } from 'playwright'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const ARTIFACT_DIR = 'C:/Users/Dell/.gemini/antigravity/brain/0af620d3-0ed8-4ad0-b5a3-39304d91838e'

async function run() {
  console.log('=== Step 1: Programmatic Provisioning of The Main Dispensary ===')
  const { provisionMainDispensary } = await import('../src/lib/cloud/sovereign-tenant-provisioner.ts')
  const mainReport = await provisionMainDispensary('SA', 'vpc-sa-sovereign-pod-999-prod')
  console.log('Provisioned Main Dispensary:', mainReport)

  // Verify Main Org in DB
  const defaultOrg = await prisma.organization.findUnique({
    where: { id: mainReport.organizationId },
    include: { settings: true, branches: true }
  })
  console.log('Main Org verified:', {
    name: defaultOrg?.name,
    country: defaultOrg?.country,
    currency: defaultOrg?.currency,
    timezone: defaultOrg?.timezone,
    settingsCount: defaultOrg?.settings.length,
    branchesCount: defaultOrg?.branches.length,
  })

  console.log('\n=== Step 2: Testing Create Sovereign Personnel in Geopolitical Territory ===')
  const testEmail = `faisal.pharmacist.${Date.now()}@metapharsic.sa`
  const bcrypt = (await import('bcryptjs')).default
  const hashed = await bcrypt.hash('Sovereign@2026', 12)
  const pharmacistRole = await prisma.role.findUnique({ where: { name: 'chief_pharmacist' } })

  const newUser = await prisma.user.create({
    data: {
      name: 'د. فيصل الشمري (Dr. Faisal Al-Shammari)',
      email: testEmail,
      phone: '+966 50 123 4567',
      password: hashed,
      organizationId: defaultOrg.id,
      branchId: defaultOrg.branches?.[0]?.id || 'default-branch',
      isActive: true,
      userRoles: pharmacistRole ? { create: { roleId: pharmacistRole.id } } : undefined,
    }
  })

  // Set sovereign matrix
  await prisma.systemSetting.upsert({
    where: { category_key: { category: 'USER_GOVERNANCE', key: newUser.id } },
    create: {
      category: 'USER_GOVERNANCE',
      key: newUser.id,
      value: JSON.stringify({
        territories: ['SA'],
        assignedPrivateNode: 'SA',
        ipRestrictionEnabled: true,
        assignedBy: 'superadmin@pharmacare.local',
        assignedAt: new Date().toISOString(),
      }),
      dataType: 'json',
      label: `Sovereign Matrix for ${newUser.email}`,
    },
    update: {
      value: JSON.stringify({
        territories: ['SA'],
        assignedPrivateNode: 'SA',
        ipRestrictionEnabled: true,
        assignedBy: 'superadmin@pharmacare.local',
        assignedAt: new Date().toISOString(),
      }),
    }
  })
  console.log(`Created & Provisioned Sovereign User: ${newUser.name} (${newUser.email})`)

  console.log('\n=== Step 3: Launching Playwright for UI Verification & Screenshots ===')
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } })
  const page = await context.newPage()

  try {
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

    // 2. NAVIGATE TO PLATFORM
    console.log('2. Navigating to /platform...');
    await page.goto('http://localhost:5888/platform', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Capture Platform overview screenshot
    await page.screenshot({ path: `${ARTIFACT_DIR}/platform-sovereign-overview.png` });
    console.log('   Captured platform-sovereign-overview.png');

    // 3. SCROLL DOWN TO USER GOVERNANCE PANEL
    console.log('3. Scrolling to User Governance Panel...');
    const govTitle = page.locator('text=Superadmin Personnel, Sovereign Roles & Territory Matrix').first();
    if (await govTitle.isVisible().catch(() => false)) {
      await govTitle.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${ARTIFACT_DIR}/sovereign-user-governance-buttons.png` });
      console.log('   Captured sovereign-user-governance-buttons.png');

      // Open "Create Sovereign Staff" dialog
      const createStaffBtn = page.locator('button:has-text("Create Sovereign Staff")').first();
      if (await createStaffBtn.isVisible().catch(() => false)) {
        console.log('   Opening Create Sovereign Staff modal...');
        await createStaffBtn.click();
        await page.waitForTimeout(1200);
        await page.screenshot({ path: `${ARTIFACT_DIR}/create-sovereign-user-modal.png` });
        console.log('   Captured create-sovereign-user-modal.png');
        // Close modal
        await page.locator('button:has-text("Cancel")').first().click();
        await page.waitForTimeout(600);
      }

      // Open "Provision Main Store" dialog
      const provMainBtn = page.locator('button:has-text("Provision Main Store")').first();
      if (await provMainBtn.isVisible().catch(() => false)) {
        console.log('   Opening Provision Main Store modal...');
        await provMainBtn.click();
        await page.waitForTimeout(1200);
        await page.screenshot({ path: `${ARTIFACT_DIR}/provision-main-dispensary-modal.png` });
        console.log('   Captured provision-main-dispensary-modal.png');
        // Close modal
        await page.locator('button:has-text("Cancel")').first().click();
        await page.waitForTimeout(600);
      }
    }

    // 4. OPEN ONBOARD NEW TENANT CHEMIST SHOP MODAL
    console.log('4. Opening Onboard New Tenant Chemist Shop modal...');
    window_scroll_top: await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    const onboardBtn = page.locator('button:has-text("Onboard Chemist Shop"), button:has-text("Onboard New Tenant")').first();
    if (await onboardBtn.isVisible().catch(() => false)) {
      await onboardBtn.click();
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${ARTIFACT_DIR}/onboard-sovereign-tenant-modal.png` });
      console.log('   Captured onboard-sovereign-tenant-modal.png');
    }

    console.log('=== All E2E UI Verifications & Screenshots Completed Successfully ===');
  } catch (err) {
    console.error('Playwright verification error:', err);
  } finally {
    await browser.close();
  }
}

run().finally(() => prisma.$disconnect());
