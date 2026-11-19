import { PrismaClient } from '@prisma/client'
import { seedDoctors } from '../prisma/seeds/doctors'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding prescribing doctors...')
  await seedDoctors(prisma)
  console.log('Done!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
