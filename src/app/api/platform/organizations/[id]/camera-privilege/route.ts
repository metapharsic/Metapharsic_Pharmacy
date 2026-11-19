import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSuperAdmin } from '@/lib/auth/auth-helpers'
import {
  isCameraDrawerEnabled,
  setCameraDrawerPrivilege,
} from '@/lib/camera/camera-drawer-service'
import prisma from '@/lib/db/prisma'

type RouteParams = { params: { id: string } }

const privilegeSchema = z.object({
  enabled: z.boolean(),
})

// GET /api/platform/organizations/[id]/camera-privilege
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await requireSuperAdmin()

    const org = await prisma.organization.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, code: true },
    })

    if (!org) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Organization not found' } },
        { status: 404 }
      )
    }

    const enabled = await isCameraDrawerEnabled(params.id)

    return NextResponse.json({
      success: true,
      organizationId: org.id,
      organizationName: org.name,
      enabled,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}

// POST /api/platform/organizations/[id]/camera-privilege
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const superAdmin = await requireSuperAdmin()

    const org = await prisma.organization.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, code: true },
    })

    if (!org) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Organization not found' } },
        { status: 404 }
      )
    }

    const body: unknown = await req.json()
    const parsed = privilegeSchema.parse(body)

    await setCameraDrawerPrivilege(params.id, parsed.enabled)

    try {
      await prisma.auditLog.create({
        data: {
          action: 'UPDATE_CAMERA_DRAWER_PRIVILEGE',
          entity: 'Organization',
          entityId: params.id,
          userId: superAdmin.id,
          newData: {
            organizationName: org.name,
            featureCameraDrawerEnabled: parsed.enabled,
          },
        },
      })
    } catch {
      // Non-blocking
    }

    return NextResponse.json({
      success: true,
      message: `Camera & Cash Drawer Vision privilege for ${org.name} has been ${
        parsed.enabled ? 'GRANTED' : 'REVOKED'
      }.`,
      organizationId: org.id,
      enabled: parsed.enabled,
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
