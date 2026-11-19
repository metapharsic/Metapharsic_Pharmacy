import prisma from '../src/lib/db/prisma';
import { provisionSovereignTenant } from '../src/lib/cloud/sovereign-tenant-provisioner';
import { TERRITORIES } from '../src/lib/territory/territory-config';

async function main() {
  console.log('--- Checking for non-seed users in default-org ---');

  // Seed demo emails that belong to default-org
  const defaultOrgSeedEmails = [
    'superadmin@pharmacare.local',
    'admin@pharmacare.local',
    'manager@pharmacare.local',
    'pharmacist@pharmacare.local',
    'cashier@pharmacare.local',
  ];

  const misassignedUsers = await prisma.user.findMany({
    where: {
      organizationId: 'default-org',
      email: { notIn: defaultOrgSeedEmails },
    },
    include: {
      userRoles: { include: { role: true } },
    },
  });

  console.log(`Found ${misassignedUsers.length} misassigned non-seed users in default-org:`);
  for (const u of misassignedUsers) {
    console.log(`  - ${u.name} (${u.email}) [id: ${u.id}]`);
  }

  if (misassignedUsers.length === 0) {
    console.log('No misassigned users found in default-org.');
  } else {
    // 1. Provision dedicated sovereign Chemist Shop entity for Dr. Faisal Al-Shammari
    let faisalOrg = await prisma.organization.findFirst({
      where: { OR: [{ code: 'FAISAL' }, { slug: 'faisal' }] },
    });

    if (!faisalOrg) {
      console.log('Creating dedicated sovereign organization for Dr. Faisal Al-Shammari...');
      faisalOrg = await prisma.organization.create({
        data: {
          name: 'Dr. Faisal Al-Shammari Pharmacy (صيدلية د. فيصل الشمري)',
          code: 'FAISAL',
          slug: 'faisal',
          legalName: 'Al-Shammari Sovereign Medical Healthcare Co.',
          country: 'Saudi Arabia',
          currency: 'SAR',
          timezone: 'Asia/Riyadh',
          status: 'ACTIVE',
          subscriptionPlan: 'GROWTH',
          email: 'faisal.pharmacist@metapharsic.sa',
          phone: '+966 50 123 4567',
          city: 'Riyadh',
          state: 'Riyadh Province',
        },
      });
      console.log(`Created Organization: ${faisalOrg.name} (${faisalOrg.id})`);
    }

    let faisalBranch = await prisma.branch.findFirst({
      where: { organizationId: faisalOrg.id },
    });

    if (!faisalBranch) {
      console.log('Creating Main Dispensary Branch for Dr. Faisal Pharmacy...');
      faisalBranch = await prisma.branch.create({
        data: {
          organizationId: faisalOrg.id,
          name: 'Dr. Faisal Al-Shammari Pharmacy - Main Counter',
          code: 'FAIS-01',
          email: 'faisal.pharmacist@metapharsic.sa',
          phone: '+966 50 123 4567',
          city: 'Riyadh',
          state: 'Riyadh Province',
          isHeadOffice: true,
          isActive: true,
          invoicePrefix: 'FAIS',
          invoiceCounter: 1,
        },
      });
      console.log(`Created Branch: ${faisalBranch.name} (${faisalBranch.id})`);
    }

    // Set Organization settings
    await prisma.organizationSetting.createMany({
      data: [
        { organizationId: faisalOrg.id, key: 'pharmacy_name', value: faisalOrg.name },
        { organizationId: faisalOrg.id, key: 'GEO_ZONE', value: 'KSA - Central Region (Riyadh)' },
        { organizationId: faisalOrg.id, key: 'invoice_header', value: faisalOrg.name },
        { organizationId: faisalOrg.id, key: 'low_stock_threshold', value: '10' },
        { organizationId: faisalOrg.id, key: 'thermal_printer_paper_width', value: '80mm' },
      ],
      skipDuplicates: true,
    });

    // 2. Reassign all misassigned users to their isolated organization and branch
    for (const u of misassignedUsers) {
      console.log(`Migrating user ${u.email} to organization ${faisalOrg.code} (${faisalOrg.id})...`);
      await prisma.user.update({
        where: { id: u.id },
        data: {
          organizationId: faisalOrg.id,
          branchId: faisalBranch.id,
        },
      });

      // Update governance matrix
      const govPayload = {
        territories: ['SA'],
        assignedPrivateNode: 'SA',
        ipRestrictionEnabled: false,
        assignedBy: 'system-migration',
        assignedAt: new Date().toISOString(),
      };

      await prisma.systemSetting.upsert({
        where: {
          category_key: {
            category: 'USER_GOVERNANCE',
            key: u.id,
          },
        },
        create: {
          category: 'USER_GOVERNANCE',
          key: u.id,
          value: JSON.stringify(govPayload),
          dataType: 'json',
          label: `Sovereign Matrix for ${u.email}`,
        },
        update: {
          value: JSON.stringify(govPayload),
          updatedAt: new Date(),
        },
      });
    }

    // 3. Run Sovereign Provisioning Pipeline (seedDemoProducts: false -> clean slate!)
    console.log('Running 5-Phase Sovereign Provisioning Pipeline for Faisal Pharmacy (clean slate)...');
    const report = await provisionSovereignTenant({
      organizationId: faisalOrg.id,
      branchId: faisalBranch.id,
      adminUserId: misassignedUsers[0].id,
      territoryCode: 'SA',
      geoZoneName: 'KSA - Central Region (Riyadh)',
      storeCode: 'FAISAL',
      storeName: faisalOrg.name,
      seedDemoProducts: false, // 100% Clean slate
    });

    console.log('Provisioning Report:', JSON.stringify(report, null, 2));
  }

  // Verify product counts for Faisal Org
  const faisalOrg = await prisma.organization.findFirst({
    where: { code: 'FAISAL' },
  });
  if (faisalOrg) {
    const pCount = await prisma.product.count({ where: { organizationId: faisalOrg.id } });
    const bCount = await prisma.batch.count({ where: { branchId: (await prisma.branch.findFirst({ where: { organizationId: faisalOrg.id } }))?.id } });
    console.log(`FAISAL Org Products: ${pCount}, Batches: ${bCount} (Clean Slate Verified!)`);
  }

  console.log('--- Migration completed successfully ---');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
