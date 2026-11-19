import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

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
  gstin: z.string().optional(),
  dlNumber: z.string().optional(),
})

type RouteParams = { params: { id: string } }

// PATCH /api/platform/organizations/:id - Super Admin Manage Chemist Shop
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const superAdmin = await requireSuperAdmin()

    const body: unknown = await req.json()
    const input = patchOrgSchema.parse(body)

    const existing = await prisma.organization.findUnique({
      where: { id: params.id },
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
    if (input.name) updateData.name = input.name
    if (input.gstin !== undefined) updateData.gstin = input.gstin
    if (input.dlNumber !== undefined) updateData.dlNumber = input.dlNumber

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

    const updated = await prisma.organization.update({
      where: { id: params.id },
      data: updateData,
    })

    // Audit Log
    try {
      await prisma.auditLog.create({
        data: {
          action: 'UPDATE_ORGANIZATION_SUBSCRIPTION',
          entity: 'Organization',
          entityId: params.id,
          userId: superAdmin.id,
          newData: updateData as any,
        },
      })
    } catch {
      // Non-blocking
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Organization ${updated.name} updated successfully`,
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

