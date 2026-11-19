const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const dayMs = 24 * 60 * 60 * 1000;
  const now = new Date();
  const d30 = new Date(Date.now() + 30 * dayMs);
  const d60 = new Date(Date.now() + 60 * dayMs);
  const d90 = new Date(Date.now() + 90 * dayMs);

  const crit = await prisma.batch.count({ where: { status: 'ACTIVE', expiryDate: { gt: now, lte: d30 } } });
  const warn = await prisma.batch.count({ where: { status: 'ACTIVE', expiryDate: { gt: d30, lte: d60 } } });
  const info = await prisma.batch.count({ where: { status: 'ACTIVE', expiryDate: { gt: d60, lte: d90 } } });
  const expired = await prisma.batch.count({ where: { OR: [{ status: 'EXPIRED' }, { expiryDate: { lte: now } }] } });

  console.log('Expiry Buckets:', { crit, warn, info, expired });
  console.log('Ledger entries count:', await prisma.ledgerEntry.count());
  console.log('Ledgers count:', await prisma.ledger.count());
  
  const ledgersWithBalance = await prisma.ledger.findMany({
    where: { balance: { not: 0 } },
    select: { code: true, name: true, balance: true, _count: { select: { entries: true } } }
  });
  console.log('Ledgers with non-zero balance:', ledgersWithBalance);

  console.log('GST transactions count:', await prisma.gstTransaction.count());
  console.log('Receipt vouchers count:', await prisma.voucher.count({ where: { voucherType: 'RECEIPT' } }));
  console.log('Bill allocations count:', await prisma.billAllocation.count());
  console.log('Sale returns count:', await prisma.saleReturn.count());
  console.log('Credit notes count:', await prisma.creditNote.count());
  
  const syncLogsSetting = await prisma.systemSetting.findFirst({
    where: { category: 'tally', key: 'recent_sync_logs' }
  });
  console.log('Tally sync logs setting exists:', Boolean(syncLogsSetting));
  if (syncLogsSetting) {
    console.log('Sync logs count:', JSON.parse(syncLogsSetting.value).length);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

