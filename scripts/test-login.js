const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function check(email, pass) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log(email, 'NOT FOUND');
    return;
  }
  const match = await bcrypt.compare(pass, user.password || '');
  console.log(email, 'Password:', pass, '=> Match:', match, 'Hash exists:', Boolean(user.password));
}

async function main() {
  await check('superadmin@pharmacare.local', 'SuperAdmin@123');
  await check('admin@pharmacare.local', 'Admin@123');
  await check('apollo.admin@pharmacare.local', 'Apollo@123');
  await check('cashier@pharmacare.local', 'Cashier@123');
  await check('ramesh@krishnamed.com', 'Krishna@123');
}

main().then(() => prisma.$disconnect()).catch(err => { console.error(err); process.exit(1); });

async function checkLocks() {
  const users = await prisma.user.findMany({ select: { id: true, email: true, failedLoginCount: true, lockedUntil: true, isActive: true } });
  for (const u of users) {
    if (u.failedLoginCount > 0 || u.lockedUntil) {
      console.log('LOCKED/FAILED:', u.email, 'failed:', u.failedLoginCount, 'lockedUntil:', u.lockedUntil);
    }
  }
}
checkLocks().then(() => prisma.$disconnect());
