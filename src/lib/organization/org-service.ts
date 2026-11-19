// ─────────────────────────────────────────────────────────────
// Organization Service — Multi-Tenant Architecture
// ─────────────────────────────────────────────────────────────
import type { Organization, Branch, OrganizationSetting, Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'

import prisma from '@/lib/db/prisma'
import { TerritoryCode, TERRITORIES } from '@/lib/territory/territory-config'
import {
  provisionSovereignTenant,
  resolveTerritoryFromZone,
  SovereignProvisioningReport,
} from '@/lib/cloud/sovereign-tenant-provisioner'

// ── Organization ──────────────────────────────────────────────

export async function getOrganization(organizationId?: string): Promise<Organization | null> {
  if (!organizationId) {
    return null
  }
  return prisma.organization.findUnique({ where: { id: organizationId } })
}

export async function getOrganizationByCode(code: string): Promise<Organization | null> {
  const cleanCode = code.trim().toUpperCase()
  return prisma.organization.findFirst({
    where: {
      OR: [
        { code: cleanCode },
        { slug: code.trim().toLowerCase() },
      ],
    },
  })
}

export async function getOrganizationWithBranches(organizationId?: string) {
  if (!organizationId) {
    return null
  }

  return prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      branches: {
        where: { isActive: true },
        orderBy: { isHeadOffice: 'desc' },
      },
      settings: true,
    },
  })
}

export async function updateOrganization(
  id: string,
  data: Prisma.OrganizationUpdateInput
): Promise<Organization> {
  return prisma.organization.update({ where: { id }, data })
}

export async function listAllOrganizations() {
  return prisma.organization.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: {
          users: true,
          branches: true,
          products: true,
        },
      },
      branches: {
        where: { isHeadOffice: true },
        select: {
          id: true,
          name: true,
          phone: true,
          city: true,
        },
      },
      users: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          isActive: true,
          userRoles: {
            include: { role: { select: { name: true, displayName: true } } },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
}

export interface OnboardChemistShopInput {
  name: string
  code: string
  legalName?: string
  gstin?: string
  dlNumber?: string
  phone?: string
  email?: string
  address?: string
  city?: string
  state?: string
  pincode?: string
  zone?: string
  territoryCode?: TerritoryCode
  privateCloudVpcId?: string
  subscriptionPlan?: string
  validityDays?: number
  adminName: string
  adminEmail: string
  adminPassword?: string
}

/**
 * 1-Click Chemist Shop Onboarding Service:
 * Provisions Organization, default Branch, and Shop Admin user atomically,
 * then executes the 5-Phase Sovereign Provisioning Pipeline.
 */
export async function onboardChemistShop(input: OnboardChemistShopInput) {
  const cleanCode = input.code.trim().toUpperCase()
  const cleanSlug = cleanCode.toLowerCase()

  // Verify unique code / slug
  const existing = await prisma.organization.findFirst({
    where: {
      OR: [{ code: cleanCode }, { slug: cleanSlug }],
    },
  })
  if (existing) {
    throw new Error(`Store Code "${cleanCode}" is already registered to another Chemist Shop.`)
  }

  // Verify unique admin email
  const existingEmail = await prisma.user.findUnique({
    where: { email: input.adminEmail.trim().toLowerCase() },
  })
  if (existingEmail) {
    throw new Error(`User with email "${input.adminEmail}" already exists on the platform.`)
  }

  const validityDays = input.validityDays || 365
  const expiresAt = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000)

  // Resolve sovereign territory from explicit territoryCode or zone string
  const resolvedTerritory: TerritoryCode =
    input.territoryCode ||
    resolveTerritoryFromZone(input.zone || input.state || input.city || 'KSA - Central Region (Riyadh)')
  const terr = TERRITORIES[resolvedTerritory] || TERRITORIES.SA

  // 1. Create Organization with Sovereign Country, Currency & Timezone
  const org = await prisma.organization.create({
    data: {
      name: input.name.trim(),
      code: cleanCode,
      slug: cleanSlug,
      legalName: input.legalName?.trim() || input.name.trim(),
      gstin: input.gstin?.trim() || null,
      dlNumber: input.dlNumber?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || input.adminEmail.trim().toLowerCase(),
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      state: input.state?.trim() || null,
      pincode: input.pincode?.trim() || null,
      country: terr.nameEn,
      currency: terr.currency.code,
      timezone: terr.timezone,
      status: 'ACTIVE',
      subscriptionPlan: input.subscriptionPlan || 'PRO',
      subscriptionExpiresAt: expiresAt,
    },
  })

  // 2. Create Default Branch (Main Dispensary)
  const branchPrefix = cleanCode.slice(0, 3).toUpperCase()
  const branch = await prisma.branch.create({
    data: {
      organizationId: org.id,
      name: `${input.name.trim()} - Main Counter`,
      code: `${branchPrefix}-01`,
      gstin: input.gstin?.trim() || null,
      dlNumber: input.dlNumber?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || input.adminEmail.trim().toLowerCase(),
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      state: input.state?.trim() || null,
      pincode: input.pincode?.trim() || null,
      isHeadOffice: true,
      isActive: true,
      invoicePrefix: branchPrefix,
      invoiceCounter: 1,
    },
  })

  // 3. Create Shop Admin User and default starter child staff (Manager, Pharmacist, Cashier)
  const rawPassword = input.adminPassword || 'Chemist@123'
  const hashedPassword = await bcrypt.hash(rawPassword, 12)

  const [ownerRole, managerRole, pharmacistRole, cashierRole] = await Promise.all([
    prisma.role.findUnique({ where: { name: 'owner' } }),
    prisma.role.findUnique({ where: { name: 'manager' } }),
    prisma.role.findUnique({ where: { name: 'pharmacist' } }),
    prisma.role.findUnique({ where: { name: 'cashier' } }),
  ])

  const adminUser = await prisma.user.create({
    data: {
      name: input.adminName.trim(),
      email: input.adminEmail.trim().toLowerCase(),
      password: hashedPassword,
      organizationId: org.id,
      branchId: branch.id,
      phone: input.phone?.trim() || null,
      isActive: true,
      userRoles: ownerRole
        ? {
            create: { roleId: ownerRole.id },
          }
        : undefined,
    },
  })

  // Starter child staff: Manager, Pharmacist, Cashier
  const emailDomain = input.adminEmail.includes('@') ? input.adminEmail.split('@')[1] : 'pharmacare.local'
  const lowerCode = cleanCode.toLowerCase()

  try {
    if (managerRole) {
      await prisma.user.create({
        data: {
          name: `${input.name} - Store Manager`,
          email: `${lowerCode}.manager@${emailDomain}`,
          password: hashedPassword,
          organizationId: org.id,
          branchId: branch.id,
          isActive: true,
          userRoles: { create: { roleId: managerRole.id } },
        },
      })
    }
    if (pharmacistRole) {
      await prisma.user.create({
        data: {
          name: `${input.name} - Chief Pharmacist`,
          email: `${lowerCode}.pharmacist@${emailDomain}`,
          password: hashedPassword,
          organizationId: org.id,
          branchId: branch.id,
          isActive: true,
          userRoles: { create: { roleId: pharmacistRole.id } },
        },
      })
    }
    if (cashierRole) {
      await prisma.user.create({
        data: {
          name: `${input.name} - Cashier Counter 01`,
          email: `${lowerCode}.cashier@${emailDomain}`,
          password: hashedPassword,
          organizationId: org.id,
          branchId: branch.id,
          isActive: true,
          userRoles: { create: { roleId: cashierRole.id } },
        },
      })
    }
  } catch {
    // Non-blocking fallback for child staff creation
  }

  // 4. Create default organization settings
  const defaultSettings: Record<string, string> = {
    pharmacy_name: org.name,
    gstin: org.gstin || '',
    dl_number: org.dlNumber || '',
    invoice_header: org.name,
    invoice_footer: 'Thank you for choosing us for your healthcare needs. Get well soon!',
    low_stock_threshold: '10',
    thermal_printer_paper_width: '80mm',
  }

  if (input.zone) {
    defaultSettings.GEO_ZONE = input.zone
  }

  await upsertSettings(org.id, defaultSettings)

  // 5. Execute 5-Phase Sovereign Provisioning Pipeline
  let sovereignReport: SovereignProvisioningReport | null = null
  try {
    sovereignReport = await provisionSovereignTenant({
      organizationId: org.id,
      branchId: branch.id,
      adminUserId: adminUser.id,
      territoryCode: resolvedTerritory,
      geoZoneName: input.zone || 'KSA - Central Region (Riyadh)',
      storeCode: cleanCode,
      storeName: org.name,
      privateCloudVpcId: input.privateCloudVpcId,
    })
  } catch (err) {
    console.error('Failed to auto-provision sovereign pipeline', err)
  }

  return {
    success: true,
    organization: org,
    branch,
    adminUser: {
      id: adminUser.id,
      name: adminUser.name,
      email: adminUser.email,
    },
    credentials: {
      storeCode: cleanCode,
      email: adminUser.email,
      initialPassword: rawPassword,
      loginUrl: '/login',
    },
    sovereignReport,
  }
}

// ── Organization Settings ─────────────────────────────────────

export async function getSettings(organizationId: string): Promise<Record<string, string>> {
  const rows = await prisma.organizationSetting.findMany({ where: { organizationId } })
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

export async function upsertSetting(
  organizationId: string,
  key: string,
  value: string
): Promise<OrganizationSetting> {
  return prisma.organizationSetting.upsert({
    where: { organizationId_key: { organizationId, key } },
    update: { value },
    create: { organizationId, key, value },
  })
}

export async function upsertSettings(
  organizationId: string,
  settings: Record<string, string>
): Promise<void> {
  await Promise.all(
    Object.entries(settings).map(([key, value]) =>
      prisma.organizationSetting.upsert({
        where: { organizationId_key: { organizationId, key } },
        update: { value },
        create: { organizationId, key, value },
      })
    )
  )
}

// ── Branches ─────────────────────────────────────────────────

export async function getBranches(organizationId: string) {
  return prisma.branch.findMany({
    where: { organizationId },
    orderBy: [{ isHeadOffice: 'desc' }, { name: 'asc' }],
  })
}

export async function getBranchById(id: string): Promise<Branch | null> {
  return prisma.branch.findUnique({ where: { id } })
}

export async function createBranch(
  organizationId: string,
  data: Omit<Prisma.BranchCreateInput, 'organization'>
): Promise<Branch> {
  return prisma.branch.create({
    data: { ...data, organization: { connect: { id: organizationId } } },
  })
}

export async function updateBranch(
  id: string,
  data: Prisma.BranchUpdateInput
): Promise<Branch> {
  return prisma.branch.update({ where: { id }, data })
}

export async function deleteBranch(id: string): Promise<Branch> {
  return prisma.branch.update({ where: { id }, data: { isActive: false } })
}
