const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('Unlocking all user accounts and verifying passwords...');

  // Reset all locks and failed login counts
  await prisma.user.updateMany({
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      isActive: true,
    },
  });

  const superAdminPass = await bcrypt.hash('SuperAdmin@123', 12);
  const adminPass = await bcrypt.hash('Admin@123', 12);
  const apolloPass = await bcrypt.hash('Apollo@123', 12);
  const cashierPass = await bcrypt.hash('Cashier@123', 12);
  const krishnaPass = await bcrypt.hash('Krishna@123', 12);

  await prisma.user.updateMany({ where: { email: 'superadmin@pharmacare.local' }, data: { password: superAdminPass, isSuperAdmin: true } });
  await prisma.user.updateMany({ where: { email: 'admin@pharmacare.local' }, data: { password: adminPass } });
  await prisma.user.updateMany({ where: { email: 'apollo.admin@pharmacare.local' }, data: { password: apolloPass } });
  await prisma.user.updateMany({ where: { email: 'apollo.manager@pharmacare.local' }, data: { password: apolloPass } });
  await prisma.user.updateMany({ where: { email: 'apollo.pharmacist@pharmacare.local' }, data: { password: apolloPass } });
  await prisma.user.updateMany({ where: { email: 'apollo.cashier@pharmacare.local' }, data: { password: apolloPass } });
  await prisma.user.updateMany({ where: { email: 'cashier@pharmacare.local' }, data: { password: cashierPass } });
  await prisma.user.updateMany({ where: { email: 'manager@pharmacare.local' }, data: { password: adminPass } });
  await prisma.user.updateMany({ where: { email: 'pharmacist@pharmacare.local' }, data: { password: adminPass } });
  await prisma.user.updateMany({ where: { email: 'ramesh@krishnamed.com' }, data: { password: krishnaPass } });
  await prisma.user.updateMany({ where: { email: 'krishna.manager@krishnamed.com' }, data: { password: krishnaPass } });
  await prisma.user.updateMany({ where: { email: 'krishna.pharmacist@krishnamed.com' }, data: { password: krishnaPass } });
  await prisma.user.updateMany({ where: { email: 'krishna.cashier@krishnamed.com' }, data: { password: krishnaPass } });

  console.log('✓ All user accounts unlocked and verified with fresh hashes!');
}

main().then(() => prisma.$disconnect()).catch(err => { console.error(err); process.exit(1); });

