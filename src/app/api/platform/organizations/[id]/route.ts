import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

import { requireSuperAdmin } from '@/lib/auth/auth-helpers'
import prisma from '@/lib/db/prisma'

const patchOrgSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'EXPIRED']).optional(),
  subscriptionPlan: z.enum(['TRIAL', 'STARTER', 'GROWTH', 'ENTERPRISE']).optional(),
  extendDays: z.number().int().optional(),
  subscriptionExpiresAt: z.string().datetime().optional(),
  maxBranches: z.number().int().min(1).optional(),
  maxUsers: z.number().int().min(1).optional(),
  name: z.string().min(2).optional(),
  legalName: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  pincode: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  currency: z.string().optional().nullable(),
  zone: z.string().optional().nullable(),
  gstin: z.string().optional().nullable(),
  dlNumber: z.string().optional().nullable(),
  branchName: z.string().optional().nullable(),
  // Chemist user modification & password reset
  adminUserId: z.string().optional().nullable(),
  adminName: z.string().optional().nullable(),
  adminEmail: z.string().optional().nullable(),
  adminPhone: z.string().optional().nullable(),
  resetPassword: z.string().min(6).optional().nullable(),
})

type RouteParams = { params: { id: string } }

// PATCH /api/platform/organizations/:id - Super Admin Manage Chemist Shop & Zones
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const superAdmin = await requireSuperAdmin()

    const body: unknown = await req.json()
    const input = patchOrgSchema.parse(body)

    const existing = await prisma.organization.findUnique({
      where: { id: params.id },
      include: {
        branches: { where: { isHeadOffice: true } },
        users: { orderBy: { createdAt: 'asc' } },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Organization not found' } },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (input.status) updateData.status = input.status
    if (input.subscriptionPlan) updateData.subscriptionPlan = input.subscriptionPlan
    if (input.maxBranches !== undefined) updateData.maxBranches = input.maxBranches
    if (input.maxUsers !== undefined) updateData.maxUsers = input.maxUsers
    if (input.name) updateData.name = input.name.trim()
    if (input.legalName !== undefined) updateData.legalName = input.legalName?.trim() || null
    if (input.email !== undefined) updateData.email = input.email?.trim() || null
    if (input.phone !== undefined) updateData.phone = input.phone?.trim() || null
    if (input.address !== undefined) updateData.address = input.address?.trim() || null
    if (input.city !== undefined) updateData.city = input.city?.trim() || null
    if (input.state !== undefined) updateData.state = input.state?.trim() || null
    if (input.pincode !== undefined) updateData.pincode = input.pincode?.trim() || null
    if (input.gstin !== undefined) updateData.gstin = input.gstin?.trim() || null
    if (input.dlNumber !== undefined) updateData.dlNumber = input.dlNumber?.trim() || null

    // Normalize Sovereign Territory and Currency
    if (input.country) {
      let resolvedCountry = input.country.trim()
      let resolvedCurrency = input.currency
      const cUpper = resolvedCountry.toUpperCase()
      if (['OM', 'OMAN'].includes(cUpper)) {
        resolvedCountry = 'Oman'
        resolvedCurrency = 'OMR'
      } else if (['SA', 'KSA', 'SAUDI', 'SAUDI ARABIA'].includes(cUpper)) {
        resolvedCountry = 'Saudi Arabia'
        resolvedCurrency = 'SAR'
      } else if (['BH', 'BAHRAIN'].includes(cUpper)) {
        resolvedCountry = 'Bahrain'
        resolvedCurrency = 'BHD'
      } else if (['QA', 'QATAR'].includes(cUpper)) {
        resolvedCountry = 'Qatar'
        resolvedCurrency = 'QAR'
      } else if (['MV', 'MALDIVES'].includes(cUpper)) {
        resolvedCountry = 'Maldives'
        resolvedCurrency = 'MVR'
      } else if (['IN', 'INDIA'].includes(cUpper)) {
        resolvedCountry = 'India'
        resolvedCurrency = 'INR'
      }
      updateData.country = resolvedCountry
      if (resolvedCurrency) {
        updateData.currency = resolvedCurrency
      }
    }

    if (input.subscriptionExpiresAt) {
      updateData.subscriptionExpiresAt = new Date(input.subscriptionExpiresAt)
    } else if (input.extendDays) {
      const currentExpiry = existing.subscriptionExpiresAt && existing.subscriptionExpiresAt > new Date()
        ? existing.subscriptionExpiresAt
        : new Date()
      updateData.subscriptionExpiresAt = new Date(currentExpiry.getTime() + input.extendDays * 24 * 3600 * 1000)
      if (existing.status === 'EXPIRED') {
        updateData.status = 'ACTIVE'
      }
    }

    // 1. Update Organization
    const updated = await prisma.organization.update({
      where: { id: params.id },
      data: updateData,
    })

    // 2. Synchronize Head Office Branch Details
    const branchUpdate: Record<string, unknown> = {}
    if (input.branchName) branchUpdate.name = input.branchName.trim()
    else if (input.name) branchUpdate.name = input.name.trim()
    if (input.city !== undefined) branchUpdate.city = input.city?.trim() || null
    if (input.state !== undefined) branchUpdate.state = input.state?.trim() || null
    if (input.address !== undefined) branchUpdate.address = input.address?.trim() || null
    if (input.phone !== undefined) branchUpdate.phone = input.phone?.trim() || null
    if (input.pincode !== undefined) branchUpdate.pincode = input.pincode?.trim() || null
    if (input.gstin !== undefined) branchUpdate.gstin = input.gstin?.trim() || null
    if (input.dlNumber !== undefined) branchUpdate.dlNumber = input.dlNumber?.trim() || null

    if (Object.keys(branchUpdate).length > 0) {
      await prisma.branch.updateMany({
        where: { organizationId: params.id, isHeadOffice: true },
        data: branchUpdate,
      })
    }

    // 3. Update Geo-Political Zone Setting
    if (input.zone && input.zone.trim()) {
      await prisma.organizationSetting.upsert({
        where: {
          organizationId_key: {
            organizationId: params.id,
            key: 'GEO_ZONE',
          },
        },
        create: {
          organizationId: params.id,
          key: 'GEO_ZONE',
          value: input.zone.trim(),
        },
        update: {
          value: input.zone.trim(),
        },
      })
    }

    // 4. Update Chemist Personnel & Password Reset
    let targetUser = null
    if (input.adminUserId) {
      targetUser = await prisma.user.findFirst({
        where: { id: input.adminUserId, organizationId: params.id },
      })
    }
    if (!targetUser) {
      targetUser = existing.users[0] || null
    }

    let passwordResetMessage = ''
    if (targetUser) {
      const userUpdate: Record<string, unknown> = {}
      if (input.adminName && input.adminName.trim()) {
        userUpdate.name = input.adminName.trim()
      }
      if (input.adminEmail && input.adminEmail.trim()) {
        userUpdate.email = input.adminEmail.trim().toLowerCase()
      }
      if (input.adminPhone !== undefined) {
        userUpdate.phone = input.adminPhone?.trim() || null
      }

      if (input.resetPassword && input.resetPassword.trim().length >= 6) {
        const rawPassword = input.resetPassword.trim()
        const hashedPassword = await bcrypt.hash(rawPassword, 12)
        userUpdate.password = hashedPassword
        userUpdate.isActive = true
        userUpdate.lockedUntil = null
        userUpdate.failedLoginCount = 0

        // Store in SuperAdmin Credential Vault for instant reference & retrieval
        await prisma.systemSetting.upsert({
          where: {
            category_key: {
              category: 'SUPERADMIN_CREDENTIAL_VAULT',
              key: targetUser.id,
            },
          },
          create: {
            category: 'SUPERADMIN_CREDENTIAL_VAULT',
            key: targetUser.id,
            value: rawPassword,
            dataType: 'string',
            label: `Reset Password for ${targetUser.email}`,
          },
          update: {
            value: rawPassword,
            updatedAt: new Date(),
          },
        })

        // Audit log password reset
        await prisma.auditLog.create({
          data: {
            action: 'PASSWORD_RESET',
            entity: 'User',
            entityId: targetUser.id,
            userId: superAdmin.id,
            newData: {
              resetUser: targetUser.email,
              organizationId: params.id,
              performedBySuperAdmin: true,
            },
          },
        })

        passwordResetMessage = ` Password for ${targetUser.email} has been reset to "${rawPassword}".`
      }

      if (Object.keys(userUpdate).length > 0) {
        await prisma.user.update({
          where: { id: targetUser.id },
          data: userUpdate,
        })
      }
    }

    // 5. Audit Log for Chemist Organization Modification
    try {
      await prisma.auditLog.create({
        data: {
          action: 'UPDATE_ORGANIZATION_AND_ZONE',
          entity: 'Organization',
          entityId: params.id,
          userId: superAdmin.id,
          newData: {
            ...updateData,
            zone: input.zone,
            adminUserId: targetUser?.id,
            adminEmail: targetUser?.email,
          } as any,
        },
      })
    } catch {
      // Non-blocking
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Chemist Shop ${updated.name} updated successfully in zone ${input.zone || 'assigned zone'}.${passwordResetMessage}`,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: err.errors[0]?.message || 'Invalid input' } },
        { status: 400 }
      )
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}
