const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const newPassword = process.argv[3] || 'Admin@123';

  if (!email) {
    console.log('Usage: node scripts/reset-password.js <email> [newPassword]');
    console.log('Example: node scripts/reset-password.js idris@pharmacare.local Admin@123');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`User with email "${email}" not found.`);
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { email },
    data: {
      password: hashedPassword,
      failedLoginCount: 0,
      lockedUntil: null,
      isActive: true,
    },
  });

  console.log(`Successfully reset password for ${email} to: ${newPassword}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    prisma.$disconnect();
    process.exit(1);
  });
