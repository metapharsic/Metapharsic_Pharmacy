/**
 * Dedicated Multi-Threaded Database Fetching Worker
 * Executed inside Node.js worker_threads.
 * Initializes an isolated Prisma Client and handles concurrent queries per domain.
 */

const { parentPort } = require('worker_threads');
const { PrismaClient } = require('@prisma/client');

let prisma = null;

function getPrisma() {
  if (!prisma) {
    const rawUrl = process.env.DATABASE_URL || '';
    const workerDbUrl = rawUrl.includes('connection_limit=')
      ? rawUrl.replace(/connection_limit=\d+/, 'connection_limit=2')
      : rawUrl + (rawUrl.includes('?') ? '&' : '?') + 'connection_limit=2&pool_timeout=10';

    prisma = new PrismaClient({
      datasourceUrl: workerDbUrl,
      log: ['error'],
    });
  }
  return prisma;
}

if (parentPort) {
  parentPort.on('message', async (msg) => {
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'PING') {
      parentPort.postMessage({ type: 'PONG', workerId: msg.workerId });
      return;
    }

    if (msg.type === 'TERMINATE') {
      if (prisma) {
        await prisma.$disconnect().catch(() => {});
      }
      process.exit(0);
      return;
    }

    if (msg.type === 'EXECUTE_DOMAIN') {
      const { taskId, domain, organizationId, branchId, filters } = msg;
      const startTime = performance.now();
      const client = getPrisma();

      try {
        let data = {};
        const now = new Date();
        const thirtyDaysAhead = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const ninetyDaysAhead = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

        let orgBranchIds = Array.isArray(filters?.orgBranchIds) ? filters.orgBranchIds : null;
        if (!orgBranchIds && organizationId && !branchId && client.branch) {
          try {
            const orgBranches = await client.branch.findMany({
              where: { organizationId, isActive: true },
              select: { id: true },
            });
            orgBranchIds = orgBranches.map((b) => b.id);
          } catch {
            orgBranchIds = [];
          }
        }

        const branchScope = branchId
          ? { branchId }
          : organizationId
            ? { branch: { organizationId } }
            : {};

        const batchScope = branchId
          ? { branchId }
          : organizationId
            ? (orgBranchIds && orgBranchIds.length > 0 ? { branchId: { in: orgBranchIds } } : { branchId: '__no_such_branch__' })
            : {};

        const prescriptionScope = branchId
          ? { branchId }
          : organizationId
            ? (orgBranchIds && orgBranchIds.length > 0 ? { branchId: { in: orgBranchIds } } : { branchId: '__no_such_branch__' })
            : {};

        switch (domain) {
          case 'INVENTORY': {
            const [totalProducts, lowStockCount, outOfStockCount, activeBatches] = await Promise.all([
              client.product.count({
                where: {
                  ...(organizationId ? { organizationId } : {}),
                  isActive: true,
                },
              }),
              client.inventory.count({
                where: {
                  ...branchScope,
                  availableQuantity: { lte: 10, gt: 0 },
                },
              }),
              client.inventory.count({
                where: {
                  ...branchScope,
                  availableQuantity: 0,
                },
              }),
              client.batch.count({
                where: {
                  status: 'ACTIVE',
                  ...batchScope,
                  quantity: { gt: 0 },
                },
              }),
            ]);
            data = { totalProducts, lowStockCount, outOfStockCount, activeBatches };
            break;
          }

          case 'COMMERCE': {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const [todaySalesCount, pendingPrescriptions, totalSalesAgg] = await Promise.all([
              client.sale.count({
                where: {
                  ...branchScope,
                  saleDate: { gte: today },
                  status: { not: 'CANCELLED' },
                },
              }),
              client.prescription.count({
                where: {
                  status: 'PENDING',
                  ...prescriptionScope,
                },
              }),
              client.sale.aggregate({
                where: {
                  ...branchScope,
                  saleDate: { gte: today },
                  status: 'COMPLETED',
                },
                _sum: { totalAmount: true },
              }),
            ]);
            data = {
              todaySalesCount,
              pendingPrescriptions,
              todayRevenue: Number(totalSalesAgg._sum.totalAmount || 0),
            };
            break;
          }

          case 'FINANCE': {
            const [receiptVouchersCount, activeLedgersCount, pendingPayablesCount] = await Promise.all([
              client.voucher.count({ where: branchScope }).catch(() => 0),
              organizationId ? Promise.resolve(0) : client.ledger.count().catch(() => 0),
              client.purchase.count({
                where: {
                  balanceDue: { gt: 0 },
                  ...branchScope,
                },
              }).catch(() => 0),
            ]);
            data = { receiptVouchersCount, activeLedgersCount, pendingPayablesCount };
            break;
          }

          case 'CLINICAL': {
            const [totalDoctors, pendingCommissions, activeCustomers] = await Promise.all([
              client.doctor.count({
                where: {
                  ...(organizationId ? { organizationId } : {}),
                  isActive: true,
                },
              }).catch(() => 0),
              client.doctorCommission.count({
                where: {
                  ...(organizationId ? { doctor: { organizationId } } : {}),
                  isPaid: false,
                },
              }).catch(() => 0),
              client.customer.count({
                where: {
                  ...(organizationId ? { organizationId } : {}),
                  isActive: true,
                },
              }).catch(() => 0),
            ]);
            data = { totalDoctors, pendingCommissions, activeCustomers };
            break;
          }

          case 'EXPIRY': {
            const [expiredCount, expiring30Count, expiring90Count] = await Promise.all([
              client.batch.count({
                where: {
                  status: { in: ['EXPIRED', 'ACTIVE'] },
                  expiryDate: { lte: now },
                  ...batchScope,
                },
              }),
              client.batch.count({
                where: {
                  status: 'ACTIVE',
                  expiryDate: { gt: now, lte: thirtyDaysAhead },
                  ...batchScope,
                },
              }),
              client.batch.count({
                where: {
                  status: 'ACTIVE',
                  expiryDate: { gt: now, lte: ninetyDaysAhead },
                  ...batchScope,
                },
              }),
            ]);
            data = { expiredCount, expiring30Count, expiring90Count };
            break;
          }

          default:
            throw new Error(`Unknown query domain: ${domain}`);
        }

        const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
        parentPort.postMessage({
          type: 'DOMAIN_SUCCESS',
          taskId,
          domain,
          data,
          durationMs,
        });
      } catch (err) {
        const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
        parentPort.postMessage({
          type: 'DOMAIN_ERROR',
          taskId,
          domain,
          error: err instanceof Error ? err.message : String(err),
          durationMs,
        });
      }
    }
  });

  parentPort.postMessage({ type: 'WORKER_READY' });
}
