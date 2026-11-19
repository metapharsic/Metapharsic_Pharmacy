import crypto from 'crypto'
import prisma from '@/lib/db/prisma'
import { sendEmail } from '@/lib/auth/email-service'
import { WhatsAppService } from '@/lib/whatsapp/whatsapp-service'

export interface OrganizationSubscriptionInfo {
  id: string
  code: string
  name: string
  legalName: string | null
  email: string | null
  phone: string | null
  status: string
  subscriptionPlan: string
  subscriptionExpiresAt: string | null
  daysRemaining: number
  isExpired: number // negative days or positive
  licenseKey: string
  licenseIssuedAt: string | null
  licenseStatus: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'TRIAL'
  ownerName: string
  ownerEmail: string
  ownerPhone: string | null
  totalStaff: number
  totalBranches: number
}

/**
 * Generate a cryptographically structured MPharm License Key:
 * e.g. MPHRM-2026-A82F-BC19-94D2
 */
export function generateLicenseCode(year: number = new Date().getFullYear()): string {
  const segment1 = crypto.randomBytes(2).toString('hex').toUpperCase()
  const segment2 = crypto.randomBytes(2).toString('hex').toUpperCase()
  const segment3 = crypto.randomBytes(2).toString('hex').toUpperCase()
  return `MPHRM-${year}-${segment1}-${segment2}-${segment3}`
}

export async function getOrganizationSubscriptions(): Promise<OrganizationSubscriptionInfo[]> {
  const organizations = await prisma.organization.findMany({
    include: {
      users: {
        include: {
          userRoles: { include: { role: true } },
        },
      },
      branches: true,
      settings: {
        where: {
          key: {
            in: ['LICENSE_KEY', 'LICENSE_ISSUED_AT', 'LICENSE_EXPIRES_AT', 'LICENSE_STATUS'],
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const now = new Date()

  return organizations.map((org) => {
    const settingsMap = new Map(org.settings.map((s) => [s.key, s.value]))

    // Find owner or first admin
    const owner = org.users.find((u) => u.userRoles.some((r) => r.role.name === 'owner')) || org.users[0]

    let expiresAt: Date
    if (org.subscriptionExpiresAt) {
      expiresAt = new Date(org.subscriptionExpiresAt)
    } else {
      // Default 30 days from creation
      expiresAt = new Date(org.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000)
    }

    const diffMs = expiresAt.getTime() - now.getTime()
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    let licenseStatus: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'TRIAL' = 'ACTIVE'
    if (daysRemaining <= 0) {
      licenseStatus = 'EXPIRED'
    } else if (daysRemaining <= 7) {
      licenseStatus = 'EXPIRING_SOON'
    } else if (org.subscriptionPlan === 'TRIAL' || org.status === 'TRIAL') {
      licenseStatus = 'TRIAL'
    }

    let licenseKey = settingsMap.get('LICENSE_KEY')
    if (!licenseKey) {
      licenseKey = `MPHRM-${now.getFullYear()}-INITIAL-${org.code || 'STD'}`
    }

    return {
      id: org.id,
      code: org.code || 'STD',
      name: org.name,
      legalName: org.legalName,
      email: org.email || owner?.email || null,
      phone: org.phone || owner?.phone || null,
      status: org.status,
      subscriptionPlan: org.subscriptionPlan,
      subscriptionExpiresAt: expiresAt.toISOString(),
      daysRemaining,
      isExpired: daysRemaining <= 0 ? Math.abs(daysRemaining) : 0,
      licenseKey,
      licenseIssuedAt: settingsMap.get('LICENSE_ISSUED_AT') || org.createdAt.toISOString(),
      licenseStatus,
      ownerName: owner?.name || 'Administrator',
      ownerEmail: owner?.email || 'N/A',
      ownerPhone: owner?.phone || null,
      totalStaff: org.users.length,
      totalBranches: org.branches.length,
    }
  })
}

/**
 * Superadmin action: Generate a new License Key for an Organization
 */
export async function assignNewLicenseKey(organizationId: string, durationDays: number = 30) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { users: true },
  })

  if (!org) throw new Error('Organization not found')

  const licenseKey = generateLicenseCode()
  const issuedAt = new Date()
  const currentExpiry = org.subscriptionExpiresAt && org.subscriptionExpiresAt > issuedAt ? org.subscriptionExpiresAt : issuedAt
  const newExpiry = new Date(currentExpiry.getTime() + durationDays * 24 * 60 * 60 * 1000)

  // 1. Update Organization subscription
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      subscriptionExpiresAt: newExpiry,
      status: 'ACTIVE',
    },
  })

  // 2. Persist in OrganizationSettings
  await Promise.all([
    prisma.organizationSetting.upsert({
      where: { organizationId_key: { organizationId, key: 'LICENSE_KEY' } },
      update: { value: licenseKey },
      create: { organizationId, key: 'LICENSE_KEY', value: licenseKey },
    }),
    prisma.organizationSetting.upsert({
      where: { organizationId_key: { organizationId, key: 'LICENSE_ISSUED_AT' } },
      update: { value: issuedAt.toISOString() },
      create: { organizationId, key: 'LICENSE_ISSUED_AT', value: issuedAt.toISOString() },
    }),
    prisma.organizationSetting.upsert({
      where: { organizationId_key: { organizationId, key: 'LICENSE_EXPIRES_AT' } },
      update: { value: newExpiry.toISOString() },
      create: { organizationId, key: 'LICENSE_EXPIRES_AT', value: newExpiry.toISOString() },
    }),
    prisma.organizationSetting.upsert({
      where: { organizationId_key: { organizationId, key: 'LICENSE_STATUS' } },
      update: { value: 'ACTIVE' },
      create: { organizationId, key: 'LICENSE_STATUS', value: 'ACTIVE' },
    }),
  ])

  // 3. Create Audit Log
  await prisma.auditLog.create({
    data: {
      action: 'LICENSE_GENERATED',
      entity: 'Organization',
      entityId: organizationId,
      newData: {
        licenseKey,
        expiresAt: newExpiry.toISOString(),
        durationDays,
      },
    },
  })

  return {
    licenseKey,
    expiresAt: newExpiry.toISOString(),
  }
}

/**
 * Superadmin / Webhook action: Complete payment and automatically extend & issue new license key
 */
export async function completePaymentAndAutoRenewLicense(params: {
  organizationId: string
  amount: number
  durationDays?: number
  paymentReference?: string
  paymentMethod?: string
}) {
  const { organizationId, amount, durationDays = 30, paymentReference = `PAY-${Date.now()}`, paymentMethod = 'UPI / NetBanking' } = params

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { users: true },
  })

  if (!org) throw new Error('Organization not found')

  const licenseKey = generateLicenseCode()
  const issuedAt = new Date()
  const currentExpiry = org.subscriptionExpiresAt && org.subscriptionExpiresAt > issuedAt ? org.subscriptionExpiresAt : issuedAt
  const newExpiry = new Date(currentExpiry.getTime() + durationDays * 24 * 60 * 60 * 1000)

  // 1. Update Organization
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      subscriptionExpiresAt: newExpiry,
      status: 'ACTIVE',
    },
  })

  // 2. Persist license settings
  await Promise.all([
    prisma.organizationSetting.upsert({
      where: { organizationId_key: { organizationId, key: 'LICENSE_KEY' } },
      update: { value: licenseKey },
      create: { organizationId, key: 'LICENSE_KEY', value: licenseKey },
    }),
    prisma.organizationSetting.upsert({
      where: { organizationId_key: { organizationId, key: 'LICENSE_ISSUED_AT' } },
      update: { value: issuedAt.toISOString() },
      create: { organizationId, key: 'LICENSE_ISSUED_AT', value: issuedAt.toISOString() },
    }),
    prisma.organizationSetting.upsert({
      where: { organizationId_key: { organizationId, key: 'LICENSE_EXPIRES_AT' } },
      update: { value: newExpiry.toISOString() },
      create: { organizationId, key: 'LICENSE_EXPIRES_AT', value: newExpiry.toISOString() },
    }),
    prisma.organizationSetting.upsert({
      where: { organizationId_key: { organizationId, key: 'LICENSE_STATUS' } },
      update: { value: 'ACTIVE' },
      create: { organizationId, key: 'LICENSE_STATUS', value: 'ACTIVE' },
    }),
    prisma.organizationSetting.upsert({
      where: { organizationId_key: { organizationId, key: 'LAST_PAYMENT_REF' } },
      update: { value: paymentReference },
      create: { organizationId, key: 'LAST_PAYMENT_REF', value: paymentReference },
    }),
  ])

  // 3. Dispatch in-app notification to all staff of this organization
  for (const user of org.users) {
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'PAYMENT_DUE',
        title: 'Subscription Renewed & License Key Updated',
        message: `Your payment of INR ${amount.toLocaleString('en-IN')} has been confirmed. Your license key has been automatically updated to ${licenseKey} (valid until ${newExpiry.toLocaleDateString('en-IN')}).`,
        data: {
          licenseKey,
          expiresAt: newExpiry.toISOString(),
          paymentReference,
        },
      },
    })
  }

  // 4. Send Email & WhatsApp confirmation to organization contact
  const targetEmail = org.email || org.users[0]?.email
  if (targetEmail) {
    await sendEmail({
      to: targetEmail,
      subject: `Subscription Confirmed: Your PharmaCare License has been Renewed`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0f766e; margin-top: 0;">Subscription Confirmed & License Updated</h2>
          <p>Dear <strong>${org.name}</strong> Team,</p>
          <p>Thank you for your payment of <strong>INR ${amount.toLocaleString('en-IN')}</strong>. Your subscription has been extended by ${durationDays} days.</p>
          <div style="background-color: #f0fdfa; border: 1px dashed #0d9488; border-radius: 6px; padding: 16px; text-align: center; margin: 20px 0;">
            <p style="margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; color: #0d9488; font-weight: bold; letter-spacing: 1px;">Active License Key</p>
            <span style="font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #0f766e;">${licenseKey}</span>
          </div>
          <p style="font-size: 13px; color: #475569;">
            • <strong>Valid Through:</strong> ${newExpiry.toLocaleDateString('en-IN')}<br/>
            • <strong>Payment Ref:</strong> ${paymentReference}<br/>
            • <strong>Method:</strong> ${paymentMethod}
          </p>
        </div>
      `,
    })
  }

  const targetPhone = org.phone || org.users[0]?.phone
  if (targetPhone) {
    try {
      await WhatsAppService.sendMessage({
        toPhone: targetPhone,
        message: `*PharmaCare Subscription Renewed*\nPayment of INR ${amount.toLocaleString('en-IN')} received.\nYour new active License Key is: *${licenseKey}*\nValid until: *${newExpiry.toLocaleDateString('en-IN')}*.`,
        provider: 'auto',
      })
    } catch (e) {
      console.error('[WhatsAppService] Renewal alert error:', e)
    }
  }

  return {
    success: true,
    licenseKey,
    expiresAt: newExpiry.toISOString(),
  }
}

/**
 * Superadmin action: Send payment and expiry notice when 30 days have passed
 */
export async function sendSubscriptionExpiryNotice(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { users: true },
  })

  if (!org) throw new Error('Organization not found')

  const targetEmail = org.email || org.users[0]?.email
  const targetPhone = org.phone || org.users[0]?.phone
  const orgName = org.name

  // 1. In-app notifications to users
  for (const user of org.users) {
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'PAYMENT_DUE',
        title: 'Action Required: Pharmacy Subscription & License Renewal Due',
        message: `Your 30-day dispensary subscription for ${orgName} has expired or is due for payment. Please settle your renewal invoice to keep automated Tally sync, narcotics governance, and dispensing active.`,
        data: {
          organizationId: org.id,
          status: 'PAYMENT_DUE',
        },
      },
    })
  }

  // 2. Send Email
  if (targetEmail) {
    await sendEmail({
      to: targetEmail,
      subject: `Urgent: 30-Day Subscription Payment Due - ${orgName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #fee2e2; border-radius: 8px;">
          <h2 style="color: #b91c1c; margin-top: 0;">Subscription Renewal Notice</h2>
          <p>Hello <strong>${orgName}</strong> Management,</p>
          <p>Your 30-day operational license period for <strong>PharmaCare Dispensary OS</strong> has expired or requires renewal.</p>
          <div style="background-color: #fef2f2; border: 1px solid #f87171; border-radius: 6px; padding: 14px; margin: 18px 0;">
            <p style="margin: 0; color: #991b1b; font-weight: bold; font-size: 14px;">Immediate Renewal Required</p>
            <p style="margin: 6px 0 0 0; color: #7f1d1d; font-size: 12px;">Please finalize your monthly subscription payment. Once payment is received, your license key will be updated automatically with zero service interruption.</p>
          </div>
          <p style="font-size: 12px; color: #64748b;">If you have already processed your payment, please contact your platform administrator.</p>
        </div>
      `,
    })
  }

  // 3. Send WhatsApp
  if (targetPhone) {
    try {
      await WhatsAppService.sendMessage({
        toPhone: targetPhone,
        message: `*PharmaCare Payment Notice*\nDear ${orgName}, your 30-day operational subscription has expired or is due. Please complete payment to ensure continuous billing & narcotics compliance. Once paid, your license key is renewed automatically.`,
        provider: 'auto',
      })
    } catch (e) {
      console.error('[WhatsAppService] Expiry notice error:', e)
    }
  }

  return {
    success: true,
    message: `Payment & renewal notifications dispatched to ${targetEmail || targetPhone || 'staff accounts'}.`,
  }
}
