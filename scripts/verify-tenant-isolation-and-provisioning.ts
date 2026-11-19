import prisma from '../src/lib/db/prisma';
import { getProducts } from '../src/lib/products/product-service';
import { getInventory } from '../src/lib/inventory/inventory-service';
import { getExpiringBatches } from '../src/lib/batches/expiry-service';

async function test() {
  console.log('=== TEST 1: VERIFY EXISTING USERS CLEAN ISOLATION ===');
  const faisalOrg = await prisma.organization.findFirst({
    where: { code: 'FAISAL' },
    include: { branches: true, users: true },
  });

  if (!faisalOrg) {
    throw new Error('FAISAL organization not found! Migration did not run.');
  }

  console.log(`FAISAL Org ID: ${faisalOrg.id}, Code: ${faisalOrg.code}, Name: ${faisalOrg.name}`);
  console.log(`FAISAL Users count: ${faisalOrg.users.length}`);
  for (const u of faisalOrg.users) {
    console.log(`  - ${u.name} (${u.email}) [branchId: ${u.branchId}]`);
  }

  const faisalProducts = await getProducts({ organizationId: faisalOrg.id });
  console.log(`FAISAL Products count: ${faisalProducts.data.length} (Expected: 0)`);
  if (faisalProducts.data.length !== 0) {
    throw new Error(`Data leakage! FAISAL has ${faisalProducts.data.length} products!`);
  }

  const faisalInventory = await getInventory({ organizationId: faisalOrg.id });
  console.log(`FAISAL Inventory items count: ${faisalInventory.data.length} (Expected: 0)`);
  if (faisalInventory.data.length !== 0) {
    throw new Error(`Data leakage! FAISAL has ${faisalInventory.data.length} inventory items!`);
  }

  const faisalExpiring = await getExpiringBatches({ organizationId: faisalOrg.id });
  console.log(`FAISAL Expiring batches: ${faisalExpiring.data.length} (Expected: 0)`);
  if (faisalExpiring.data.length !== 0) {
    throw new Error(`Data leakage! FAISAL has ${faisalExpiring.data.length} expiring batches!`);
  }

  console.log('✅ TEST 1 PASSED: Existing user Dr. Faisal Al-Shammari is 100% isolated with a clean slate!\n');

  console.log('=== TEST 2: UPCOMING NEW USER AUTO-PROVISIONING (ZERO MERGING) ===');
  const testEmail = `test.upcoming.admin.${Date.now()}@alghamdi.sa`;
  const testName = 'د. عبد الله الغامدي (Dr. Abdullah Al-Ghamdi)';

  // Simulate calling the updated /api/platform/users route handler
  const { POST } = await import('../src/app/api/platform/users/route');

  const fakeReq = new Request('http://localhost:5888/api/platform/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'create-and-provision',
      name: testName,
      email: testEmail,
      phone: '+966 55 987 6543',
      password: 'Abdullah@123',
      organizationId: 'NEW_ENTITY', // Upcoming user requests new entity!
      storeName: 'Al-Ghamdi Sovereign Healthcare',
      storeCode: `GHAMDI${Math.floor(Math.random() * 900 + 100)}`,
      territoryCode: 'SA',
      roleNames: ['owner', 'chief_pharmacist'],
      autoProvision5Phases: true,
    }),
  });

  // Temporarily set ambient superadmin for requireSuperAdmin
  const { setAmbientTestUser } = await import('../src/lib/auth/auth-helpers');
  setAmbientTestUser({
    id: 'cmwew6o1f00bhdy13h93lr2nd',
    email: 'superadmin@pharmacare.local',
    name: 'Platform Super Admin',
    isSuperAdmin: true,
    roles: ['super_admin', 'owner'],
    permissions: [],
  });

  const response = await POST(fakeReq as any);
  const json = await response.json();

  console.log('Response status:', response.status);
  console.log('Response success:', json.success);
  console.log('Response message:', json.message);

  if (!json.success) {
    throw new Error(`Failed to create upcoming user: ${json.error}`);
  }

  const createdUser = await prisma.user.findUnique({
    where: { email: testEmail },
    include: { organization: true, branch: true },
  });

  if (!createdUser) {
    throw new Error('Created user not found in database!');
  }

  console.log(`Created User: ${createdUser.name} (${createdUser.email})`);
  console.log(`Assigned Org: ${createdUser.organization?.name} [code: ${createdUser.organization?.code}, id: ${createdUser.organizationId}]`);
  console.log(`Assigned Branch: ${createdUser.branch?.name} [code: ${createdUser.branch?.code}, id: ${createdUser.branchId}]`);

  // Verify that the assigned org is NOT default-org
  if (createdUser.organizationId === 'default-org') {
    throw new Error('FATAL: Created user was assigned to default-org!');
  }

  // Verify 0 products
  const newOrgProducts = await getProducts({ organizationId: createdUser.organizationId! });
  console.log(`New Org Products: ${newOrgProducts.data.length} (Expected: 0)`);
  if (newOrgProducts.data.length !== 0) {
    throw new Error(`FATAL: New org has ${newOrgProducts.data.length} products already present!`);
  }

  // Verify 0 inventory
  const newOrgInventory = await getInventory({ organizationId: createdUser.organizationId! });
  console.log(`New Org Inventory: ${newOrgInventory.data.length} (Expected: 0)`);
  if (newOrgInventory.data.length !== 0) {
    throw new Error(`FATAL: New org has ${newOrgInventory.data.length} inventory items!`);
  }

  console.log('✅ TEST 2 PASSED: Upcoming user auto-provisioning created clean, isolated entity with 0 merged data!\n');

  console.log('=== ALL MULTI-TENANT PROVISIONING TESTS PASSED! ===');
}

test()
  .catch((err) => {
    console.error('Test error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
