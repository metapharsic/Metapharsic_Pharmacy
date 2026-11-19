import { DailyClosingDigestService } from '../src/lib/reports/daily-closing-digest-service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Testing DailyClosingDigestService.generateDigest...');
  try {
    const digest = await DailyClosingDigestService.generateDigest(undefined, new Date());
    console.log('✅ Digest generated successfully!');
    console.log('Branch:', digest.branchName);
    console.log('Total Revenue: ₹', digest.sales.totalRevenue);
    console.log('Owner Phone:', digest.ownerPhone);
    console.log('Urgent batches expiring:', digest.alerts.expiringIn30DaysCount);
  } catch (err: any) {
    console.error('❌ Error generating digest:', err.message);
    console.error(err.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main();

