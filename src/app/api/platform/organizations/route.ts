import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requireSuperAdmin } from '@/lib/auth/auth-helpers'
import prisma from '@/lib/db/prisma'
import { listAllOrganizations, onboardChemistShop } from '@/lib/organization/org-service'

const onboardSchema = z.object({
  code: z.string().min(2).max(20).regex(/^[A-Za-z0-9_-]+$/, 'Store code must be alphanumeric'),
  name: z.string().min(2, 'Shop name must be at least 2 characters'),
  adminName: z.string().min(2, 'Admin full name is required'),
  adminEmail: z.string().email('Valid admin email is required'),
  adminPassword: z.string().min(6, 'Password must be at least 6 characters'),
  adminPhone: z.string().optional(),
  gstin: z.string().optional(),
  dlNumber: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  zone: z.string().default('KSA - Central Region (Riyadh)'),
  territoryCode: z.enum(['SA', 'OM', 'BH', 'QA', 'MV', 'IN']).optional(),
  privateCloudVpcId: z.string().optional(),
  subscriptionPlan: z.enum(['TRIAL', 'STARTER', 'GROWTH', 'ENTERPRISE']).default('GROWTH'),
  subscriptionDurationDays: z.number().int().min(1).default(365),
})

export const dynamic = 'force-dynamic'

// GET /api/platform/organizations - List all tenant chemist shops
export async function GET() {
  try {
    await requireSuperAdmin()

    const organizations = await listAllOrganizations()
    return NextResponse.json({ success: true, data: organizations })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}

// POST /api/platform/organizations - 1-Click Onboard & Sovereign Provision Chemist Shop
export async function POST(req: NextRequest) {
  try {
    const superAdmin = await requireSuperAdmin()

    const body: unknown = await req.json()
    const input = onboardSchema.parse(body)

    const result = await onboardChemistShop(input)

    // Audit Log
    try {
      await prisma.auditLog.create({
        data: {
          action: 'ONBOARD_SOVEREIGN_ORGANIZATION',
          entity: 'Organization',
          entityId: result.organization.id,
          userId: superAdmin.id,
          newData: {
            organizationCode: result.organization.code,
            organizationName: result.organization.name,
            adminEmail: result.adminUser.email,
            plan: result.organization.subscriptionPlan,
            territoryCode: result.sovereignReport?.territoryCode,
            phase1ProductsCreated: result.sovereignReport?.phase1ProductsCreated,
            phase2BatchesCreated: result.sovereignReport?.phase2BatchesCreated,
            phase5VpcPod: result.sovereignReport?.phase5VpcPod,
          },
        },
      })
    } catch {
      // Non-blocking
    }

    return NextResponse.json(
      {
        success: true,
        data: result,
        message: `Chemist Shop ${result.organization.name} (${result.organization.code}) onboarded & provisioned across all 5 sovereign phases!`,
      },
      { status: 201 }
    )
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: err.errors[0]?.message || 'Invalid input' } },
        { status: 400 }
      )
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : message.includes('already exists') ? 409 : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}
