import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testAuditIsolation() {
  console.log('Testing Audit Trail Tenant Isolation...')

  const belqeesOrgId = 'cmwtczcqo000mq46eohz4pi6c'

  // Belqees isolated query
  const belqeesWhere = {
    AND: [
      {
        OR: [
          { user: { organizationId: belqeesOrgId } },
          { entity: 'Organization', entityId: belqeesOrgId },
        ],
      },
    ],
  }

  const belqeesLogs = await prisma.auditLog.findMany({
    where: belqeesWhere,
    include: { user: { select: { name: true, email: true, organizationId: true } } },
  })

  console.log(`Found ${belqeesLogs.length} audit logs for Belqees Pharmacy:`)
  let leakFound = false
  for (const log of belqeesLogs) {
    if (log.user && log.user.organizationId !== belqeesOrgId) {
      // If it's an organization action on Belqees, it might be triggered by SuperAdmin
      if (log.entity === 'Organization' && log.entityId === belqeesOrgId) {
        console.log(`  [OK - Direct Org Action] ${log.action} on ${log.entity} by ${log.user.email}`)
      } else {
        console.error(`  [LEAK!] Cross-tenant log: ${log.action} by ${log.user.email} (org: ${log.user.organizationId})`)
        leakFound = true
      }
    } else {
      console.log(`  [OK - Tenant User Log] ${log.action} on ${log.entity} by ${log.user?.email || 'N/A'}`)
    }
  }

  if (leakFound) {
    throw new Error('Tenant isolation test failed: cross-tenant leak found!')
  }

  console.log('Verification SUCCESS: No cross-tenant data bleed in audit logs!')
}

testAuditIsolation()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
