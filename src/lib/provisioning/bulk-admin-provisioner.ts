import { prisma } from '@/lib/db/prisma'

export interface ProvisioningReport {
  totalOrgs: number
  totalAdmins: number
  settingsUpserted: number
  racksCreated: number
  camerasMapped: number
  vaultEntriesCreated: number
  governanceEntriesCreated: number
  dashboardPrefsCreated: number
  details: string[]
}

export async function provisionAllAdmins(): Promise<ProvisioningReport> {
  const report: ProvisioningReport = {
    totalOrgs: 0,
    totalAdmins: 0,
    settingsUpserted: 0,
    racksCreated: 0,
    camerasMapped: 0,
    vaultEntriesCreated: 0,
    governanceEntriesCreated: 0,
    dashboardPrefsCreated: 0,
    details: [],
  }

  // 1. Fetch all organizations
  const organizations = await prisma.organization.findMany({
    include: {
      branches: true,
      users: {
        include: {
          userRoles: {
            include: {
              role: true,
            },
          },
        },
      },
    },
  })

  report.totalOrgs = organizations.length

  // Standard settings to provision for every sovereign organization
  const standardOrgSettings: Array<{ key: string; defaultValue: string }> = [
    { key: 'pharmacy_name', defaultValue: 'Sovereign Healthcare Pharmacy' },
    { key: 'GEO_ZONE', defaultValue: 'IN_SOUTH' },
    { key: 'VAT_REGIME', defaultValue: 'GST' },
    { key: 'VAT_RATE', defaultValue: '18' },
    { key: 'CURRENCY', defaultValue: 'INR' },
    { key: 'TALLY_SYNC_ENABLED', defaultValue: 'true' },
    { key: 'CAMERA_DRAWER_ENABLED', defaultValue: 'true' },
    { key: 'CAMERA_PRIVILEGE_GRANTED', defaultValue: 'true' },
    { key: 'DRAWER_ALERT_THRESHOLD', defaultValue: '5' },
    { key: 'SURVEILLANCE_RETENTION_HOURS', defaultValue: '48' },
    { key: 'MFA_ENABLED', defaultValue: 'true' },
    { key: 'REFILL_REMINDERS_ENABLED', defaultValue: 'true' },
    { key: 'WHATSAPP_NOTIFICATIONS_ENABLED', defaultValue: 'true' },
    { key: 'SMS_NOTIFICATIONS_ENABLED', defaultValue: 'true' },
    { key: 'CUSTOMER_FOLLOWUPS_ENABLED', defaultValue: 'true' },
    { key: 'REFILL_SCHEDULING_ENABLED', defaultValue: 'true' },
    { key: 'STATUTORY_STATEMENTS_ENABLED', defaultValue: 'true' },
    { key: 'DASHBOARD_CUSTOMIZATION_ENABLED', defaultValue: 'true' },
    { key: 'SUBSCRIPTION_PLAN', defaultValue: 'ENTERPRISE_SOVEREIGN' },
  ]

  for (const org of organizations) {
    report.details.push(`Provisioning Organization: ${org.name} (${org.code || org.id})`)

    // A. Provision OrganizationSettings
    for (const setting of standardOrgSettings) {
      const val = setting.key === 'pharmacy_name' ? (org.name || setting.defaultValue) : setting.defaultValue
      const existing = await prisma.organizationSetting.findUnique({
        where: {
          organizationId_key: {
            organizationId: org.id,
            key: setting.key,
          },
        },
      })

      if (!existing) {
        await prisma.organizationSetting.create({
          data: {
            organizationId: org.id,
            key: setting.key,
            value: val,
          },
        })
        report.settingsUpserted++
      }
    }

    // B. Ensure Branch exists
    let primaryBranch = org.branches[0]
    if (!primaryBranch) {
      primaryBranch = await prisma.branch.create({
        data: {
          organizationId: org.id,
          name: `${org.name} Main Dispensary`,
          code: `${(org.code || 'BR').slice(0, 4).toUpperCase()}-01`,
          isHeadOffice: true,
          isActive: true,
        },
      })
      report.details.push(`Created Main Branch for ${org.name}`)
    }

    // C. Ensure standard Racks exist for this Branch
    const defaultRacks = [
      { code: 'RACK-A', shelfNumber: 'S-01', description: 'Fast Moving & OTC Medicines' },
      { code: 'RACK-B', shelfNumber: 'S-01', description: 'Scheduled Prescription Drugs (Rx)' },
      { code: 'RACK-COLD', shelfNumber: 'C-01', description: 'Cold Chain Storage (2°C - 8°C)' },
    ]

    for (const rack of defaultRacks) {
      const existingRack = await prisma.rack.findUnique({
        where: {
          branchId_code_shelfNumber: {
            branchId: primaryBranch.id,
            code: rack.code,
            shelfNumber: rack.shelfNumber,
          },
        },
      })

      if (!existingRack) {
        await prisma.rack.create({
          data: {
            branchId: primaryBranch.id,
            code: rack.code,
            shelfNumber: rack.shelfNumber,
            description: rack.description,
          },
        })
        report.racksCreated++
      }
    }

    // D. Provision all users belonging to this organization
    for (const user of org.users) {
      const roles = user.userRoles.map((ur) => ur.role.name.toLowerCase())
      const isAdminOrOperator =
        user.isSuperAdmin ||
        roles.some((r) =>
          ['owner', 'super_admin', 'territory_admin', 'manager', 'pharmacist', 'cashier', 'chief_pharmacist', 'compliance_officer'].includes(r)
        )

      if (isAdminOrOperator) {
        report.totalAdmins++

        // 1. Ensure StoreCameraMapping exists
        const existingCamera = await prisma.storeCameraMapping.findUnique({
          where: {
            organizationId_userId: {
              organizationId: org.id,
              userId: user.id,
            },
          },
        })

        if (!existingCamera) {
          await prisma.storeCameraMapping.create({
            data: {
              organizationId: org.id,
              branchId: user.branchId || primaryBranch.id,
              userId: user.id,
              cameraName: `${user.name || 'Counter'} Overhead Surveillance Cam`,
              deviceId: `CAM-${user.id.slice(-6).toUpperCase()}`,
              streamType: 'WEBCAM',
              isActive: true,
              autoOpenDrawer: true,
              captureOnOpen: true,
            },
          })
          report.camerasMapped++
        }

        // 2. Provision SuperAdmin Credential Vault in SystemSetting
        const existingVault = await prisma.systemSetting.findUnique({
          where: {
            category_key: {
              category: 'SUPERADMIN_CREDENTIAL_VAULT',
              key: user.id,
            },
          },
        })

        if (!existingVault) {
          await prisma.systemSetting.create({
            data: {
              category: 'SUPERADMIN_CREDENTIAL_VAULT',
              key: user.id,
              value: JSON.stringify({
                initialPassword: 'Sovereign@2026',
                unlockedAt: new Date().toISOString(),
                authorizedBy: 'superadmin@pharmacare.local',
                roles,
                organizationCode: org.code,
              }),
              dataType: 'json',
              label: `Credential Vault for ${user.email}`,
            },
          })
          report.vaultEntriesCreated++
        }

        // 3. Provision USER_GOVERNANCE in SystemSetting
        const existingGov = await prisma.systemSetting.findUnique({
          where: {
            category_key: {
              category: 'USER_GOVERNANCE',
              key: user.id,
            },
          },
        })

        if (!existingGov) {
          await prisma.systemSetting.create({
            data: {
              category: 'USER_GOVERNANCE',
              key: user.id,
              value: JSON.stringify({
                roles: roles.length > 0 ? roles : ['owner'],
                territories: ['IN', 'SA', 'OM'],
                assignedPrivateNode: 'IN',
                isSuperAdmin: user.isSuperAdmin,
                mfaEnabled: true,
                ipRestrictionEnabled: false,
                lastProvisioned: new Date().toISOString(),
              }),
              dataType: 'json',
              label: `Governance Policy for ${user.email}`,
            },
          })
          report.governanceEntriesCreated++
        }

        // 4. Provision default DASHBOARD_PREFERENCE in SystemSetting
        const existingDash = await prisma.systemSetting.findUnique({
          where: {
            category_key: {
              category: 'DASHBOARD_PREFERENCE',
              key: user.id,
            },
          },
        })

        if (!existingDash) {
          const defaultWidgets = [
            'revenue_kpi',
            'low_stock',
            'expiry_critical',
            'refill_reminders',
            'whatsapp_sms',
            'customer_followups',
            'camera_drawer',
            'recent_sales',
            'pending_purchases',
            'staff_online',
            'tally_sync',
            'statutory_tax',
          ]
          await prisma.systemSetting.create({
            data: {
              category: 'DASHBOARD_PREFERENCE',
              key: user.id,
              value: JSON.stringify({
                widgets: defaultWidgets,
                layout: 'grid',
                updatedAt: new Date().toISOString(),
              }),
              dataType: 'json',
              label: `Dashboard Widgets for ${user.email}`,
            },
          })
          report.dashboardPrefsCreated++
        }
      }
    }
  }

  return report
}
