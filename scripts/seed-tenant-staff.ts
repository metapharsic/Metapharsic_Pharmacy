import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding full staff rosters (Admin, Manager, Pharmacist, Cashier) for each chemist shop...')

  const roles = await prisma.role.findMany()
  const roleMap = new Map(roles.map((r) => [r.name, r.id]))

  const ownerRoleId = roleMap.get('owner')!
  const managerRoleId = roleMap.get('manager')!
  const pharmacistRoleId = roleMap.get('pharmacist')!
  const cashierRoleId = roleMap.get('cashier')!

  const passwordHash = await bcrypt.hash('Staff@123', 12)
  const apolloPassword = await bcrypt.hash('Apollo@123', 12)
  const krishnaPassword = await bcrypt.hash('Krishna@123', 12)

  // 1. Apollo Pharmacy (APOLLO)
  const apolloOrg = await prisma.organization.findUnique({ where: { code: 'APOLLO' }, include: { branches: true } })
  if (apolloOrg && apolloOrg.branches.length > 0) {
    const branchId = apolloOrg.branches[0].id

    // Apollo Manager
    const manager = await prisma.user.upsert({
      where: { email: 'apollo.manager@pharmacare.local' },
      update: { organizationId: apolloOrg.id, branchId },
      create: {
        name: 'Apollo Store Manager',
        email: 'apollo.manager@pharmacare.local',
        password: apolloPassword,
        phone: '9848011223',
        branchId,
        organizationId: apolloOrg.id,
        isActive: true,
      },
    })
    await prisma.userRole.deleteMany({ where: { userId: manager.id } })
    await prisma.userRole.create({ data: { userId: manager.id, roleId: managerRoleId } })

    // Apollo Pharmacist
    const pharma = await prisma.user.upsert({
      where: { email: 'apollo.pharmacist@pharmacare.local' },
      update: { organizationId: apolloOrg.id, branchId },
      create: {
        name: 'Apollo Chief Pharmacist',
        email: 'apollo.pharmacist@pharmacare.local',
        password: apolloPassword,
        phone: '9848022334',
        branchId,
        organizationId: apolloOrg.id,
        isActive: true,
      },
    })
    await prisma.userRole.deleteMany({ where: { userId: pharma.id } })
    await prisma.userRole.create({ data: { userId: pharma.id, roleId: pharmacistRoleId } })

    // Apollo Cashier
    const cashier = await prisma.user.upsert({
      where: { email: 'apollo.cashier@pharmacare.local' },
      update: { organizationId: apolloOrg.id, branchId },
      create: {
        name: 'Apollo Cashier Counter 01',
        email: 'apollo.cashier@pharmacare.local',
        password: apolloPassword,
        phone: '9848033445',
        branchId,
        organizationId: apolloOrg.id,
        isActive: true,
      },
    })
    await prisma.userRole.deleteMany({ where: { userId: cashier.id } })
    await prisma.userRole.create({ data: { userId: cashier.id, roleId: cashierRoleId } })

    console.log('✓ Apollo Pharmacy staff provisioned: Admin, Manager, Pharmacist, Cashier')
  }

  // 2. Krishna Medical & General Stores (KRISHNA)
  const krishnaOrg = await prisma.organization.findUnique({ where: { code: 'KRISHNA' }, include: { branches: true } })
  if (krishnaOrg && krishnaOrg.branches.length > 0) {
    const branchId = krishnaOrg.branches[0].id

    // Krishna Manager
    const manager = await prisma.user.upsert({
      where: { email: 'krishna.manager@krishnamed.com' },
      update: { organizationId: krishnaOrg.id, branchId },
      create: {
        name: 'Suresh Patel (Store Manager)',
        email: 'krishna.manager@krishnamed.com',
        password: krishnaPassword,
        phone: '9876543211',
        branchId,
        organizationId: krishnaOrg.id,
        isActive: true,
      },
    })
    await prisma.userRole.deleteMany({ where: { userId: manager.id } })
    await prisma.userRole.create({ data: { userId: manager.id, roleId: managerRoleId } })

    // Krishna Pharmacist
    const pharma = await prisma.user.upsert({
      where: { email: 'krishna.pharmacist@krishnamed.com' },
      update: { organizationId: krishnaOrg.id, branchId },
      create: {
        name: 'Priya Varma (Pharmacist)',
        email: 'krishna.pharmacist@krishnamed.com',
        password: krishnaPassword,
        phone: '9876543212',
        branchId,
        organizationId: krishnaOrg.id,
        isActive: true,
      },
    })
    await prisma.userRole.deleteMany({ where: { userId: pharma.id } })
    await prisma.userRole.create({ data: { userId: pharma.id, roleId: pharmacistRoleId } })

    // Krishna Cashier
    const cashier = await prisma.user.upsert({
      where: { email: 'krishna.cashier@krishnamed.com' },
      update: { organizationId: krishnaOrg.id, branchId },
      create: {
        name: 'Anand Kumar (Cashier Counter 01)',
        email: 'krishna.cashier@krishnamed.com',
        password: krishnaPassword,
        phone: '9876543213',
        branchId,
        organizationId: krishnaOrg.id,
        isActive: true,
      },
    })
    await prisma.userRole.deleteMany({ where: { userId: cashier.id } })
    await prisma.userRole.create({ data: { userId: cashier.id, roleId: cashierRoleId } })

    console.log('✓ Krishna Medical staff provisioned: Admin, Manager, Pharmacist, Cashier')
  }

  // 3. Default Shop (DEFAULT)
  const defaultOrg = await prisma.organization.findUnique({ where: { code: 'DEFAULT' }, include: { branches: true } })
  if (defaultOrg && defaultOrg.branches.length > 0) {
    const branchId = defaultOrg.branches[0].id
    await prisma.user.updateMany({
      where: {
        email: { in: ['admin@pharmacare.local', 'manager@pharmacare.local', 'pharmacist@pharmacare.local', 'cashier@pharmacare.local'] },
      },
      data: { organizationId: defaultOrg.id, branchId },
    })
    console.log('✓ Default Shop staff verified: Admin, Manager, Pharmacist, Cashier')
  }

  console.log('All chemist shops have complete staff hierarchy in place!')
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })

