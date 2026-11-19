const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({
    include: {
      organization: { select: { code: true, name: true } },
      userRoles: { include: { role: true } }
    }
  });
  console.log('TOTAL USERS IN DB:', users.length);
  for (const u of users) {
    const roles = u.userRoles.map(r => r.role.name).join(', ');
    console.log(`${u.name} | ${u.email} | Org: ${u.organization ? u.organization.code : 'None'} | Roles: [${roles}] | isSuperAdmin: ${u.isSuperAdmin}`);
  }
}
main().then(() => prisma.$disconnect()).catch(err => { console.error(err); process.exit(1); });

