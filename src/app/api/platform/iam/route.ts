import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSuperAdmin } from '@/lib/auth/auth-helpers'
import prisma from '@/lib/db/prisma'
import { getPlatformIAMPolicy, updatePlatformIAMPolicy } from '@/lib/platform/iam-service'

const iamPolicySchema = z.object({
  minPasswordLength: z.number().int().min(6).max(32),
  requireUppercase: z.boolean(),
  requireSpecialChar: z.boolean(),
  requireNumber: z.boolean(),
  passwordExpiryDays: z.number().int().min(0).max(365),

  maxFailedAttempts: z.number().int().min(2).max(10),
  lockoutDurationMinutes: z.number().int().min(1).max(1440),
  sessionInactivityTimeoutMinutes: z.number().int().min(5).max(1440),

  enforceMfaForSuperAdmin: z.boolean(),
  enforceMfaForStoreOwners: z.boolean(),
  ipWhitelistEnabled: z.boolean(),
  allowedIpRanges: z.array(z.string()),

  geoFencingEnforced: z.boolean(),
  allowedZones: z.array(z.string()),
  allowDispensaryAfterHours: z.boolean(),

  allowConcurrentLogins: z.boolean(),
})

export const dynamic = 'force-dynamic'

// GET /api/platform/iam - Retrieve active platform IAM policy
export async function GET() {
  try {
    await requireSuperAdmin()
    const policy = await getPlatformIAMPolicy()
    return NextResponse.json({ success: true, policy })
  } catch (err: any) {
    const isAuth = err?.message === 'Unauthorized'
    const isForbidden = err?.message?.includes('Forbidden')
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch IAM policy' },
      { status: isAuth ? 401 : isForbidden ? 403 : 500 }
    )
  }
}

// POST /api/platform/iam - Update platform IAM policy
export async function POST(req: NextRequest) {
  try {
    const superAdmin = await requireSuperAdmin()
    const body: unknown = await req.json()
    const validated = iamPolicySchema.parse(body)

    const updated = await updatePlatformIAMPolicy(validated)

    // Audit log IAM update
    try {
      await prisma.auditLog.create({
        data: {
          action: 'IAM_POLICY_UPDATE',
          entity: 'SystemSetting',
          entityId: 'PLATFORM_IAM_RULES_POLICY',
          userId: superAdmin.id,
          newData: validated as any,
        },
      })
    } catch {
      // Non-blocking
    }

    return NextResponse.json({
      success: true,
      policy: updated,
      message: 'Platform IAM Governance and Security Rules policy updated successfully!',
    })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: err.errors[0]?.message || 'Invalid IAM policy configuration' },
        { status: 400 }
      )
    }
    const isAuth = err?.message === 'Unauthorized'
    const isForbidden = err?.message?.includes('Forbidden')
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to update IAM policy' },
      { status: isAuth ? 401 : isForbidden ? 403 : 500 }
    )
  }
}
