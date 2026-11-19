import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

const envPath = path.resolve(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach((line) => {
      const match = line.match(/^([^#\s]+?)=(.*)$/)
      if (match) {
        let val = match[2].trim()
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
        process.env[match[1].trim()] = val
      }
    })
}
const envLocalPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envLocalPath)) {
  fs.readFileSync(envLocalPath, 'utf8')
    .split('\n')
    .forEach((line) => {
      const match = line.match(/^([^#\s]+?)=(.*)$/)
      if (match) {
        let val = match[2].trim()
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
        process.env[match[1].trim()] = val
      }
    })
}

import { seedDoctors } from './seeds/doctors'
import { seedHsnCodes } from './seeds/hsn-codes'
import { seedInventoryAndBatches } from './seeds/inventory'
import { seedOrganization } from './seeds/organization'
import { seedParties } from './seeds/parties'
import { seedPermissions } from './seeds/permissions'
import { seedProducts } from './seeds/products'
import { seedRoles } from './seeds/roles'
import { seedSettings } from './seeds/settings'
import { seedUsers } from './seeds/users'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...\n')

  console.log('📋 Seeding permissions...')
  await seedPermissions(prisma)

  console.log('👑 Seeding roles...')
  await seedRoles(prisma)

  console.log('🏪 Seeding organization...')
  await seedOrganization(prisma)

  console.log('👤 Seeding users...')
  await seedUsers(prisma)

  console.log('⚙️  Seeding system settings...')
  await seedSettings(prisma)

  console.log('🔢 Seeding HSN codes...')
  await seedHsnCodes(prisma)

  console.log('💊 Seeding sample products...')
  await seedProducts(prisma)

  console.log('📦 Seeding inventory and batches...')
  await seedInventoryAndBatches(prisma)

  console.log('🤝 Seeding suppliers and customers...')
  await seedParties(prisma)

  console.log('🩺 Seeding prescribing doctors...')
  await seedDoctors(prisma)

  console.log('🔒 Verifying multi-tenant integrity across all entities...')
  const [uRes, pRes, cRes, sRes, cuRes, dRes] = await Promise.all([
    prisma.user.updateMany({ where: { organizationId: null }, data: { organizationId: 'default-org' } }),
    prisma.product.updateMany({ where: { organizationId: null }, data: { organizationId: 'default-org' } }),
    prisma.category.updateMany({ where: { organizationId: null }, data: { organizationId: 'default-org' } }),
    prisma.supplier.updateMany({ where: { organizationId: null }, data: { organizationId: 'default-org' } }),
    prisma.customer.updateMany({ where: { organizationId: null }, data: { organizationId: 'default-org' } }),
    prisma.doctor.updateMany({ where: { organizationId: null }, data: { organizationId: 'default-org' } }),
  ])
  const fixedCount = uRes.count + pRes.count + cRes.count + sRes.count + cuRes.count + dRes.count
  if (fixedCount > 0) {
    console.log(`  ✓ Scoped ${fixedCount} orphaned/unscoped records to default-org`)
  } else {
    console.log('  ✓ 100% of records are strictly scoped to tenant organizations')
  }

  console.log('\n✅ Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(() => {
    void prisma.$disconnect()
  })
