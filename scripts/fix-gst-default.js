const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE gst_transactions ALTER COLUMN "referenceLineId" SET DEFAULT '';
  `);
  console.log('Successfully set default on referenceLineId!');
}

run().catch(console.error).finally(() => prisma.$disconnect());

