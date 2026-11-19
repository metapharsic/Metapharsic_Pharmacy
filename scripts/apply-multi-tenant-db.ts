import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function exec(sql: string) {
  try {
    await prisma.$executeRawUnsafe(sql)
  } catch (err: any) {
    console.warn(`[WARN] ${err.message?.split('\n')[0] || err}`)
  }
}

async function main() {
  console.log('🚀 Applying Multi-Tenant Database Schema Enhancements...')

  // 1. Add columns to organizations
  await exec('ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "code" TEXT;')
  await exec('ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "slug" TEXT;')
  await exec('ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "watermarkUrl" TEXT;')
  await exec('ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT \'ACTIVE\';')
  await exec('ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "subscriptionPlan" TEXT DEFAULT \'PRO\';')
  await exec('ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "subscriptionExpiresAt" TIMESTAMP(3);')
  await exec('CREATE UNIQUE INDEX IF NOT EXISTS "organizations_code_key" ON "organizations"("code");')
  await exec('CREATE UNIQUE INDEX IF NOT EXISTS "organizations_slug_key" ON "organizations"("slug");')
  console.log('✓ organizations table upgraded')

  // 2. Add columns to users
  await exec('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;')
  await exec('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isSuperAdmin" BOOLEAN DEFAULT false;')
  await exec('CREATE INDEX IF NOT EXISTS "users_organizationId_idx" ON "users"("organizationId");')
  console.log('✓ users table upgraded')

  // 3. Add columns to products, customers, suppliers, categories
  await exec('ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;')
  await exec('CREATE INDEX IF NOT EXISTS "products_organizationId_idx" ON "products"("organizationId");')

  await exec('ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;')
  await exec('CREATE INDEX IF NOT EXISTS "customers_organizationId_idx" ON "customers"("organizationId");')

  await exec('ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;')
  await exec('CREATE INDEX IF NOT EXISTS "suppliers_organizationId_idx" ON "suppliers"("organizationId");')

  await exec('ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;')
  await exec('CREATE INDEX IF NOT EXISTS "categories_organizationId_idx" ON "categories"("organizationId");')
  console.log('✓ products, customers, suppliers, categories upgraded with organizationId')

  // 4. Create global_medicines table if not exists
  await exec(`
    CREATE TABLE IF NOT EXISTS "global_medicines" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "genericName" TEXT,
      "manufacturer" TEXT,
      "composition" TEXT,
      "drugSchedule" TEXT NOT NULL DEFAULT 'NONE',
      "hsnCode" TEXT DEFAULT '3004',
      "gstRate" DECIMAL(5, 2) NOT NULL DEFAULT 12.00,
      "packSize" TEXT DEFAULT '10 Tablets',
      "tabsPerStrip" INTEGER DEFAULT 10,
      "mrp" DECIMAL(12, 2),
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)
  await exec('CREATE INDEX IF NOT EXISTS "global_medicines_name_idx" ON "global_medicines"("name");')
  await exec('CREATE INDEX IF NOT EXISTS "global_medicines_genericName_idx" ON "global_medicines"("genericName");')
  console.log('✓ global_medicines master catalog table created')

  // 5. Backfill default organization
  await exec(`
    UPDATE "organizations" 
    SET "code" = 'DEFAULT', 
        "slug" = 'default',
        "status" = 'ACTIVE',
        "subscriptionPlan" = 'ENTERPRISE',
        "subscriptionExpiresAt" = '2099-12-31 23:59:59'
    WHERE "id" = 'default-org';
  `)

  // 6. Backfill existing records to default-org
  await exec('UPDATE "users" SET "organizationId" = \'default-org\' WHERE "organizationId" IS NULL;')
  await exec('UPDATE "products" SET "organizationId" = \'default-org\' WHERE "organizationId" IS NULL;')
  await exec('UPDATE "customers" SET "organizationId" = \'default-org\' WHERE "organizationId" IS NULL;')
  await exec('UPDATE "suppliers" SET "organizationId" = \'default-org\' WHERE "organizationId" IS NULL;')
  await exec('UPDATE "categories" SET "organizationId" = \'default-org\' WHERE "organizationId" IS NULL;')
  await exec('UPDATE "doctors" SET "organizationId" = \'default-org\' WHERE "organizationId" IS NULL;')
  console.log('✓ Existing records backfilled to default-org')

  // 7. Seed Platform Super-Admin user
  const ownerRole = await prisma.role.findUnique({ where: { name: 'owner' } })
  const cashierRole = await prisma.role.findUnique({ where: { name: 'cashier' } })

  const superAdminPassword = await bcrypt.hash('SuperAdmin@123', 12)
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@pharmacare.local' },
    update: {
      isSuperAdmin: true,
      organizationId: 'default-org',
      password: superAdminPassword,
      isActive: true,
    },
    create: {
      name: 'Platform Super Admin',
      email: 'superadmin@pharmacare.local',
      password: superAdminPassword,
      isSuperAdmin: true,
      organizationId: 'default-org',
      isActive: true,
    },
  })

  if (ownerRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: superAdmin.id, roleId: ownerRole.id } },
      update: {},
      create: { userId: superAdmin.id, roleId: ownerRole.id },
    })
  }
  console.log('✓ Platform Super Admin user seeded (superadmin@pharmacare.local / SuperAdmin@123)')

  // 8. Seed Second Chemist Shop: Apollo Pharmacy
  const apolloOrg = await prisma.organization.upsert({
    where: { id: 'org-apollo-pharma' },
    update: {
      code: 'APOLLO',
      slug: 'apollo',
      status: 'ACTIVE',
      subscriptionPlan: 'PRO',
      subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
    create: {
      id: 'org-apollo-pharma',
      name: 'Apollo Pharmacy & Healthcare',
      code: 'APOLLO',
      slug: 'apollo',
      legalName: 'Apollo Healthcare Retail Ltd',
      gstin: '36AAACA1234D1Z8',
      dlNumber: 'TS/HYD/2026/9021',
      phone: '+91-9123456780',
      email: 'apollo@pharmacare.local',
      address: 'Plot 42, Road 1, Banjara Hills',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500034',
      status: 'ACTIVE',
      subscriptionPlan: 'PRO',
      subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  })

  // Branch for Apollo
  const apolloBranch = await prisma.branch.upsert({
    where: { id: 'branch-apollo-01' },
    update: {
      organizationId: apolloOrg.id,
    },
    create: {
      id: 'branch-apollo-01',
      organizationId: apolloOrg.id,
      name: 'Apollo Banjara Hills Branch',
      code: 'AP-BH',
      gstin: '36AAACA1234D1Z8',
      dlNumber: 'TS/HYD/2026/9021',
      phone: '+91-9123456780',
      email: 'apollo.banjara@pharmacare.local',
      address: 'Plot 42, Road 1, Banjara Hills',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500034',
      isHeadOffice: true,
      isActive: true,
      invoicePrefix: 'APO',
      invoiceCounter: 1,
    },
  })

  // Shop Admin for Apollo
  const apolloAdminPassword = await bcrypt.hash('Apollo@123', 12)
  const apolloAdmin = await prisma.user.upsert({
    where: { email: 'apollo.admin@pharmacare.local' },
    update: {
      organizationId: apolloOrg.id,
      branchId: apolloBranch.id,
      password: apolloAdminPassword,
      isActive: true,
    },
    create: {
      name: 'Dr. Apollo Chemist (Shop Admin)',
      email: 'apollo.admin@pharmacare.local',
      password: apolloAdminPassword,
      organizationId: apolloOrg.id,
      branchId: apolloBranch.id,
      isActive: true,
    },
  })

  if (ownerRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: apolloAdmin.id, roleId: ownerRole.id } },
      update: {},
      create: { userId: apolloAdmin.id, roleId: ownerRole.id },
    })
  }

  // Child Cashier for Apollo
  const apolloCashierPassword = await bcrypt.hash('Cashier@123', 12)
  const apolloCashier = await prisma.user.upsert({
    where: { email: 'apollo.cashier@pharmacare.local' },
    update: {
      organizationId: apolloOrg.id,
      branchId: apolloBranch.id,
      password: apolloCashierPassword,
      isActive: true,
    },
    create: {
      name: 'Apollo Cashier Counter 1',
      email: 'apollo.cashier@pharmacare.local',
      password: apolloCashierPassword,
      organizationId: apolloOrg.id,
      branchId: apolloBranch.id,
      isActive: true,
    },
  })

  if (cashierRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: apolloCashier.id, roleId: cashierRole.id } },
      update: {},
      create: { userId: apolloCashier.id, roleId: cashierRole.id },
    })
  }
  console.log('✓ Chemist Shop "Apollo Pharmacy & Healthcare" (Code: APOLLO) seeded with Shop Admin & Cashier')

  // 9. Seed Global Medicine Directory
  const sampleMedicines = [
    { name: 'Augmentin 625 Duo Tablet', genericName: 'Amoxicillin and Potassium Clavulanate', manufacturer: 'GSK', composition: 'Amoxicillin 500mg + Clavulanic Acid 125mg', drugSchedule: 'H', hsnCode: '3004', gstRate: 12.0, packSize: '10 Tablets', tabsPerStrip: 10, mrp: 204.5 },
    { name: 'Dolo 650 Tablet', genericName: 'Paracetamol', manufacturer: 'Micro Labs Ltd', composition: 'Paracetamol 650mg', drugSchedule: 'NONE', hsnCode: '3004', gstRate: 12.0, packSize: '15 Tablets', tabsPerStrip: 15, mrp: 33.6 },
    { name: 'Azithral 500 Tablet', genericName: 'Azithromycin', manufacturer: 'Alembic Pharmaceuticals', composition: 'Azithromycin 500mg', drugSchedule: 'H', hsnCode: '3004', gstRate: 12.0, packSize: '5 Tablets', tabsPerStrip: 5, mrp: 132.0 },
    { name: 'Pantocid 40 Tablet', genericName: 'Pantoprazole', manufacturer: 'Sun Pharma', composition: 'Pantoprazole 40mg', drugSchedule: 'H', hsnCode: '3004', gstRate: 12.0, packSize: '15 Tablets', tabsPerStrip: 15, mrp: 165.0 },
    { name: 'Telma 40 Tablet', genericName: 'Telmisartan', manufacturer: 'Glenmark Pharmaceuticals', composition: 'Telmisartan 40mg', drugSchedule: 'H', hsnCode: '3004', gstRate: 12.0, packSize: '30 Tablets', tabsPerStrip: 30, mrp: 285.0 },
    { name: 'Montair LC Tablet', genericName: 'Montelukast + Levocetirizine', manufacturer: 'Cipla Ltd', composition: 'Montelukast 10mg + Levocetirizine 5mg', drugSchedule: 'H', hsnCode: '3004', gstRate: 12.0, packSize: '10 Tablets', tabsPerStrip: 10, mrp: 180.0 },
    { name: 'Pan 40 Tablet', genericName: 'Pantoprazole', manufacturer: 'Alkem Laboratories', composition: 'Pantoprazole 40mg', drugSchedule: 'H', hsnCode: '3004', gstRate: 12.0, packSize: '15 Tablets', tabsPerStrip: 15, mrp: 155.0 },
    { name: 'Clavam 625 Tablet', genericName: 'Amoxicillin + Clavulanic Acid', manufacturer: 'Alkem Laboratories', composition: 'Amoxicillin 500mg + Clavulanic Acid 125mg', drugSchedule: 'H', hsnCode: '3004', gstRate: 12.0, packSize: '10 Tablets', tabsPerStrip: 10, mrp: 201.0 },
  ]

  for (const med of sampleMedicines) {
    const id = `gm-${med.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
    await exec(`
      INSERT INTO "global_medicines" ("id", "name", "genericName", "manufacturer", "composition", "drugSchedule", "hsnCode", "gstRate", "packSize", "tabsPerStrip", "mrp", "isActive", "createdAt")
      VALUES ('${id}', '${med.name.replace(/'/g, "''")}', '${med.genericName.replace(/'/g, "''")}', '${med.manufacturer}', '${med.composition}', '${med.drugSchedule}', '${med.hsnCode}', ${med.gstRate}, '${med.packSize}', ${med.tabsPerStrip}, ${med.mrp}, true, NOW())
      ON CONFLICT ("id") DO NOTHING;
    `)
  }
  console.log(`✓ Global Medicine Directory seeded with ${sampleMedicines.length} standard reference molecules`)

  console.log('\n🎉 Multi-Tenant Database Migration completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e)
    process.exit(1)
  })
  .finally(() => {
    void prisma.$disconnect()
  })
