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
  whatsAppSettingsProvisioned: number
  details: string[]
}

function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return hash
}

export function computeDedicatedPhone(org: {
  id: string
  code?: string | null
  name?: string | null
  phone?: string | null
}): string {
  if (org.phone && org.phone.trim().length >= 8) {
    return org.phone.trim()
  }

  const codeUpper = (org.code || '').toUpperCase()
  const nameUpper = (org.name || '').toUpperCase()
  const hash = Math.abs(simpleHash(org.id))

  if (
    codeUpper.includes('SA') ||
    codeUpper.includes('FAISAL') ||
    codeUpper.includes('GHAMDI') ||
    nameUpper.includes('SAUDI') ||
    nameUpper.includes('SHAMMARI') ||
    nameUpper.includes('GHAMDI')
  ) {
    return `+96650${(1000000 + (hash % 9000000)).toString()}`
  } else if (codeUpper.includes('OM') || nameUpper.includes('MUSCAT') || nameUpper.includes('OMAN')) {
    return `+96891${(100000 + (hash % 900000)).toString()}`
  } else if (codeUpper.includes('BH') || nameUpper.includes('BAHRAIN')) {
    return `+97339${(100000 + (hash % 900000)).toString()}`
  } else if (codeUpper.includes('QA') || nameUpper.includes('DOHA') || nameUpper.includes('QATAR')) {
    return `+97455${(100000 + (hash % 900000)).toString()}`
  } else if (codeUpper.includes('MV') || nameUpper.includes('MALÉ') || nameUpper.includes('MALDIVES')) {
    return `+96079${(100000 + (hash % 900000)).toString()}`
  } else {
    // India default
    const suffix = (10000000 + (hash % 90000000)).toString().padStart(8, '0')
    return `+9198${suffix}`
  }
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
    whatsAppSettingsProvisioned: 0,
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

  for (const org of organizations) {
    report.details.push(`Provisioning Organization: ${org.name} (${org.code || org.id})`)

    // Ensure dedicated phone
    const dedicatedPhone = computeDedicatedPhone(org)
    if (!org.phone) {
      await prisma.organization.update({
        where: { id: org.id },
        data: { phone: dedicatedPhone },
      })
      report.details.push(`Assigned dedicated phone ${dedicatedPhone} to ${org.name}`)
    }

    const orgCodeSafe = (org.code || org.id.slice(0, 8)).toLowerCase().replace(/[^a-z0-9]/g, '_')

    // Standard settings to provision for every sovereign organization
    const orgSettingsList: Array<{ key: string; value: string }> = [
      { key: 'pharmacy_name', value: org.name || 'Sovereign Healthcare Pharmacy' },
      { key: 'GEO_ZONE', value: 'IN_SOUTH' },
      { key: 'VAT_REGIME', value: 'GST' },
      { key: 'VAT_RATE', value: '18' },
      { key: 'CURRENCY', value: 'INR' },
      { key: 'TALLY_SYNC_ENABLED', value: 'true' },
      { key: 'CAMERA_DRAWER_ENABLED', value: 'true' },
      { key: 'CAMERA_PRIVILEGE_GRANTED', value: 'true' },
      { key: 'DRAWER_ALERT_THRESHOLD', value: '5' },
      { key: 'SURVEILLANCE_RETENTION_HOURS', value: '48' },
      { key: 'MFA_ENABLED', value: 'true' },
      // Strict Tenant-Isolated WhatsApp Settings
      { key: 'WHATSAPP_ENABLED', value: 'true' },
      { key: 'WHATSAPP_PROVIDER', value: 'simulation-and-wa-link' },
      { key: 'WHATSAPP_SENDER_NAME', value: org.name },
      { key: 'WHATSAPP_STORE_PHONE', value: dedicatedPhone },
      { key: 'WHATSAPP_OWNER_PHONE', value: dedicatedPhone },
      { key: 'WHATSAPP_API_TOKEN', value: `wa_tok_${orgCodeSafe}` },
      { key: 'WHATSAPP_PHONE_NUMBER_ID', value: `wa_id_${orgCodeSafe}` },
      { key: 'WHATSAPP_EOD_REPORT_ENABLED', value: 'true' },
      { key: 'WHATSAPP_REFILL_REMINDERS_ENABLED', value: 'true' },
      { key: 'WHATSAPP_INVOICE_BILLING_ENABLED', value: 'true' },
      { key: 'WHATSAPP_NOTIFICATIONS_ENABLED', value: 'true' },
      { key: 'SMS_NOTIFICATIONS_ENABLED', value: 'true' },
      { key: 'CUSTOMER_FOLLOWUPS_ENABLED', value: 'true' },
      { key: 'REFILL_SCHEDULING_ENABLED', value: 'true' },
      { key: 'REFILL_REMINDERS_ENABLED', value: 'true' },
      { key: 'STATUTORY_STATEMENTS_ENABLED', value: 'true' },
      { key: 'DASHBOARD_CUSTOMIZATION_ENABLED', value: 'true' },
      { key: 'SUBSCRIPTION_PLAN', value: 'ENTERPRISE_SOVEREIGN' },
    ]

    // A. Provision OrganizationSettings
    for (const setting of orgSettingsList) {
      await prisma.organizationSetting.upsert({
        where: {
          organizationId_key: {
            organizationId: org.id,
            key: setting.key,
          },
        },
        create: {
          organizationId: org.id,
          key: setting.key,
          value: setting.value,
        },
        update: {
          value: setting.value,
        },
      })
      report.settingsUpserted++
      if (setting.key.startsWith('WHATSAPP')) {
        report.whatsAppSettingsProvisioned++
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
          phone: dedicatedPhone,
          isHeadOffice: true,
          isActive: true,
        },
      })
      report.details.push(`Created Main Branch for ${org.name}`)
    } else if (!primaryBranch.phone) {
      await prisma.branch.update({
        where: { id: primaryBranch.id },
        data: { phone: dedicatedPhone },
      })
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
          [
            'owner',
            'super_admin',
            'territory_admin',
            'manager',
            'pharmacist',
            'cashier',
            'chief_pharmacist',
            'compliance_officer',
          ].includes(r)
        )

      if (isAdminOrOperator) {
        report.totalAdmins++

        // If user phone is missing, assign dedicated tenant phone
        if (!user.phone) {
          await prisma.user.update({
            where: { id: user.id },
            data: { phone: dedicatedPhone },
          })
        }

        // 1. Provision CAMERA MAPPING in SystemSetting
        const existingCam = await prisma.systemSetting.findUnique({
          where: {
            category_key: {
              category: 'ADMIN_CAMERA_MAP',
              key: user.id,
            },
          },
        })

        if (!existingCam) {
          await prisma.systemSetting.create({
            data: {
              category: 'ADMIN_CAMERA_MAP',
              key: user.id,
              value: JSON.stringify({
                branchId: primaryBranch.id,
                branchName: primaryBranch.name,
                cameraUrl: `rtsp://admin:${(primaryBranch.code || 'br01').toLowerCase()}@192.168.1.120:554/ch0`,
                feedType: 'RTSP_H264',
                storageDays: 2,
                cashDrawerAutoTrigger: true,
                aiCashDetection: true,
                drawerOpeningsDetected: 0,
                cashCollectionsDetected: 0,
                lastStatus: 'ONLINE_ACTIVE',
                privilegedBy: 'SUPER_ADMIN_SYSTEM',
                grantedAt: new Date().toISOString(),
              }),
              dataType: 'json',
              label: `Dispensary Surveillance Camera for ${user.name || user.email}`,
            },
          })
          report.camerasMapped++
        }

        // 2. Provision CREDENTIAL_VAULT in SystemSetting
        const existingVault = await prisma.systemSetting.findUnique({
          where: {
            category_key: {
              category: 'CREDENTIAL_VAULT',
              key: user.id,
            },
          },
        })

        if (!existingVault) {
          const rawPass =
            user.email === 'admin@metapharsic.com'
              ? 'Admin@123'
              : user.email === 'faisal@metapharsic.com'
                ? 'Faisal@123'
                : user.email === 'amjad@metapharsic.com'
                  ? 'Amjad@123'
                  : 'Sovereign@2026'

          await prisma.systemSetting.create({
            data: {
              category: 'CREDENTIAL_VAULT',
              key: user.id,
              value: JSON.stringify({
                email: user.email,
                name: user.name,
                decryptedPassword: rawPass,
                isSuperAdmin: user.isSuperAdmin,
                organizationName: org.name,
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

export async function provisionSingleOrganization(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
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

  if (!org) return null

  const dedicatedPhone = computeDedicatedPhone(org)
  if (!org.phone) {
    await prisma.organization.update({
      where: { id: org.id },
      data: { phone: dedicatedPhone },
    })
  }

  const orgCodeSafe = (org.code || org.id.slice(0, 8)).toLowerCase().replace(/[^a-z0-9]/g, '_')

  const orgSettingsList: Array<{ key: string; value: string }> = [
    { key: 'pharmacy_name', value: org.name || 'Sovereign Healthcare Pharmacy' },
    { key: 'GEO_ZONE', value: 'IN_SOUTH' },
    { key: 'VAT_REGIME', value: 'GST' },
    { key: 'VAT_RATE', value: '18' },
    { key: 'CURRENCY', value: 'INR' },
    { key: 'TALLY_SYNC_ENABLED', value: 'true' },
    { key: 'CAMERA_DRAWER_ENABLED', value: 'true' },
    { key: 'CAMERA_PRIVILEGE_GRANTED', value: 'true' },
    { key: 'DRAWER_ALERT_THRESHOLD', value: '5' },
    { key: 'SURVEILLANCE_RETENTION_HOURS', value: '48' },
    { key: 'MFA_ENABLED', value: 'true' },
    { key: 'WHATSAPP_ENABLED', value: 'true' },
    { key: 'WHATSAPP_PROVIDER', value: 'simulation-and-wa-link' },
    { key: 'WHATSAPP_SENDER_NAME', value: org.name },
    { key: 'WHATSAPP_STORE_PHONE', value: dedicatedPhone },
    { key: 'WHATSAPP_OWNER_PHONE', value: dedicatedPhone },
    { key: 'WHATSAPP_API_TOKEN', value: `wa_tok_${orgCodeSafe}` },
    { key: 'WHATSAPP_PHONE_NUMBER_ID', value: `wa_id_${orgCodeSafe}` },
    { key: 'WHATSAPP_EOD_REPORT_ENABLED', value: 'true' },
    { key: 'WHATSAPP_REFILL_REMINDERS_ENABLED', value: 'true' },
    { key: 'WHATSAPP_INVOICE_BILLING_ENABLED', value: 'true' },
    { key: 'WHATSAPP_NOTIFICATIONS_ENABLED', value: 'true' },
    { key: 'SMS_NOTIFICATIONS_ENABLED', value: 'true' },
    { key: 'CUSTOMER_FOLLOWUPS_ENABLED', value: 'true' },
    { key: 'REFILL_SCHEDULING_ENABLED', value: 'true' },
    { key: 'REFILL_REMINDERS_ENABLED', value: 'true' },
    { key: 'STATUTORY_STATEMENTS_ENABLED', value: 'true' },
    { key: 'DASHBOARD_CUSTOMIZATION_ENABLED', value: 'true' },
    { key: 'SUBSCRIPTION_PLAN', value: 'ENTERPRISE_SOVEREIGN' },
  ]

  for (const setting of orgSettingsList) {
    await prisma.organizationSetting.upsert({
      where: {
        organizationId_key: {
          organizationId: org.id,
          key: setting.key,
        },
      },
      create: {
        organizationId: org.id,
        key: setting.key,
        value: setting.value,
      },
      update: {
        value: setting.value,
      },
    })
  }

  return org
}
