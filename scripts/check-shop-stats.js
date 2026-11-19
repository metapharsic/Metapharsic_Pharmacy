const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const orgs = await prisma.organization.findMany({
    include: {
      branches: true,
      _count: { select: { users: true, products: true } }
    }
  });
  for (const org of orgs) {
    const branchIds = org.branches.map(b => b.id);
    const salesCount = await prisma.sale.count({ where: { branchId: { in: branchIds } } });
    const purchasesCount = await prisma.purchase.count({ where: { branchId: { in: branchIds } } });
    const inventoryCount = await prisma.inventory.count({ where: { branchId: { in: branchIds } } });
    console.log(`${org.name} [${org.code}] => Sales: ${salesCount}, Purchases: ${purchasesCount}, Inventory records: ${inventoryCount}`);
  }
}
main().then(() => prisma.$disconnect()).catch(err => { console.error(err); process.exit(1); });

