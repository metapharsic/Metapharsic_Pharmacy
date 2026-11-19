import { PrismaClient } from '@prisma/client'
import { provisionMainDispensary } from '../src/lib/cloud/sovereign-tenant-provisioner.js'

const prisma = new PrismaClient()

async function main() {
  console.log('--- 1. Testing Provision Main Dispensary ---')
  const reportMain = await provisionMainDispensary('SA', 'vpc-sa-sovereign-pod-999-prod')
  console.log('Main Dispensary Provision Report:', JSON.stringify(reportMain, null, 2))

  // Verify main org settings
  const defaultOrg = await prisma.organization.findUnique({
    where: { id: reportMain.organizationId },
    include: {
      settings: true,
      branches: true,
    },
  })
  console.log('Default Org Country:', defaultOrg.country, 'Currency:', defaultOrg.currency)
  console.log('Settings count:', defaultOrg.settings.length)

  const productsCount = await prisma.product.count({
    where: { organizationId: reportMain.organizationId },
  })
  console.log('Default Org Products count:', productsCount)

  const batchesCount = await prisma.batch.count({
    where: { product: { organizationId: reportMain.organizationId } },
  })
  console.log('Default Org Batches count:', batchesCount)

  console.log('\n--- 2. Testing Create & Provision Sovereign User ---')
  const testEmail = `dr.alotaibi.${Date.now()}@metapharsic.sa`
  const res = await fetch('http://localhost:5888/api/platform/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Will test via direct function or authenticated session
    },
    body: JSON.stringify({
      action: 'create-and-provision',
      name: 'د. خالد العتيبي (Dr. Khaled Al-Otaibi)',
      email: testEmail,
      phone: '+966 55 987 6543',
      password: 'Sovereign@2026',
      organizationId: reportMain.organizationId,
      territoryCode: 'SA',
      assignedPrivateNode: 'SA',
      roleNames: ['chief_pharmacist'],
      autoProvision5Phases: true,
      privateCloudVpcId: 'vpc-sa-sovereign-pod-999-prod',
    }),
  }).catch((err) => ({ ok: false, error: err.message }))

  console.log('API user creation status:', res.status || res.error)
}

main().finally(() => prisma.$disconnect())
