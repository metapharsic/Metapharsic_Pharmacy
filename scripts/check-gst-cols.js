const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const tableCols = await prisma.$queryRawUnsafe(`
    SELECT column_name, is_nullable, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'gst_transactions'
  `);
  console.log('Columns in PostgreSQL gst_transactions:', tableCols);
}

check().catch(console.error).finally(() => prisma.$disconnect());

