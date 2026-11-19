const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const prTables = await prisma.$queryRawUnsafe(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema='public' 
      AND (table_name LIKE '%requisition%' OR table_name LIKE '%quotation%')
  `);
  console.log('Procurement Tables in PostgreSQL:', prTables);

  const reqCount = await prisma.$queryRawUnsafe(`SELECT count(*) FROM purchase_requisitions`).catch(() => 'table missing');
  console.log('purchase_requisitions count:', reqCount);

  const quoteCount = await prisma.$queryRawUnsafe(`SELECT count(*) FROM supplier_quotations`).catch(() => 'table missing');
  console.log('supplier_quotations count:', quoteCount);

  const poCount = await prisma.purchase.count();
  console.log('purchase PO count:', poCount);

  const supplierCount = await prisma.supplier.count();
  console.log('supplier count:', supplierCount);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

