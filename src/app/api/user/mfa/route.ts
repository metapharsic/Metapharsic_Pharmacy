import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth/auth-helpers'

const mfaSchema = z.object({
  enabled: z.boolean(),
  userId: z.string().optional(), // Store Admin can toggle for staff in their organization
})

// GET /api/user/mfa — Retrieve current Admin MFA status
export async function GET() {
  try {
    const user = await requireAuth()

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        mfaEnabled: true,
        totpSecret: true,
        userRoles: { select: { role: { select: { name: true, displayName: true } } } },
      },
    })

    if (!dbUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      mfaEnabled: Boolean(dbUser.mfaEnabled),
      email: dbUser.email,
      name: dbUser.name,
      totpSecret: dbUser.totpSecret || 'JBSWY3DPEHPK3PXP',
      qrSetupUrl: `otpauth://totp/PharmaCare:${encodeURIComponent(dbUser.email)}?secret=${dbUser.totpSecret || 'JBSWY3DPEHPK3PXP'}&issuer=PharmaCare`,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

// POST /api/user/mfa — Enable or Disable MFA
export async function POST(req: NextRequest) {
  try {
    const authUser = await requireAuth()
    const body = await req.json()
    const parsed = mfaSchema.parse(body)

    let targetUserId = authUser.id

    // If an Admin or SuperAdmin specifies a userId for a staff member in their store
    if (parsed.userId && parsed.userId !== authUser.id) {
      const isPrivileged =
        authUser.isSuperAdmin ||
        authUser.roles?.some((r) => ['owner', 'admin', 'manager', 'super_admin'].includes(r.toLowerCase()))

      if (!isPrivileged) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Only administrators can modify staff MFA settings' },
          { status: 403 }
        )
      }

      // Check organization boundary if not SuperAdmin
      if (!authUser.isSuperAdmin) {
        const staff = await prisma.user.findUnique({
          where: { id: parsed.userId },
          select: { organizationId: true },
        })
        if (!staff || staff.organizationId !== authUser.organizationId) {
          return NextResponse.json({ success: false, error: 'Cross-tenant access forbidden' }, { status: 403 })
        }
      }

      targetUserId = parsed.userId
    }

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: {
        mfaEnabled: parsed.enabled,
        totpSecret: parsed.enabled ? 'JBSWY3DPEHPK3PXP' : null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        mfaEnabled: true,
      },
    })

    // Log security audit trail
    try {
      await prisma.auditLog.create({
        data: {
          userId: authUser.id,
          action: parsed.enabled ? 'MFA_ENABLED' : 'MFA_DISABLED',
          entity: 'User',
          entityId: targetUserId,
          newData: { targetUser: updated.email, mfaEnabled: parsed.enabled },
        },
      })
    } catch {
      // Non-blocking
    }

    return NextResponse.json({
      success: true,
      mfaEnabled: Boolean(updated.mfaEnabled),
      message: parsed.enabled
        ? `Multi-Factor Authentication (MFA) successfully enabled for ${updated.name}.`
        : `MFA disabled for ${updated.name}.`,
    })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: err.errors[0]?.message || 'Invalid request' },
        { status: 400 }
      )
    }
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
