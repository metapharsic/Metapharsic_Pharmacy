import { prisma } from '../src/lib/db/prisma'
import { provisionAllAdmins } from '../src/lib/provisioning/bulk-admin-provisioner'

async function main() {
  console.log('=====================================================')
  console.log('🚀 SOVEREIGN BULK ADMIN PROVISIONING PIPELINE')
  console.log('=====================================================')

  try {
    const report = await provisionAllAdmins()
    console.log('✅ Provisioning Completed Successfully!')
    console.log('-----------------------------------------------------')
    console.log(`🏢 Organizations Processed:       ${report.totalOrgs}`)
    console.log(`👤 Admin & Operator Accounts:      ${report.totalAdmins}`)
    console.log(`⚙️  Org Settings Upserted:         ${report.settingsUpserted}`)
    console.log(`📦 Storage Racks Verified/Created: ${report.racksCreated}`)
    console.log(`📹 Store Camera Mappings Created:  ${report.camerasMapped}`)
    console.log(`🔐 Vault Entries Created:          ${report.vaultEntriesCreated}`)
    console.log(`🛡️  Governance Entries Created:     ${report.governanceEntriesCreated}`)
    console.log(`📊 Dashboard Prefs Initialized:    ${report.dashboardPrefsCreated}`)
    console.log('-----------------------------------------------------')
  } catch (error) {
    console.error('❌ Provisioning failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
