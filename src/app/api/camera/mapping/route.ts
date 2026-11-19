import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/auth-helpers'
import {
  getStoreCameraMapping,
  isCameraDrawerEnabled,
  saveStoreCameraMapping,
} from '@/lib/camera/camera-drawer-service'

const saveMappingSchema = z.object({
  cameraName: z.string().min(1).default('Counter Overhead Camera'),
  deviceId: z.string().min(1),
  streamType: z.enum(['WEBCAM', 'RTSP', 'IP_CAM']).default('WEBCAM'),
  ipStreamUrl: z.string().optional().nullable(),
  autoOpenDrawer: z.boolean().default(true),
  captureOnOpen: z.boolean().default(true),
})

function checkAdminRole(user: { roles?: string[]; isSuperAdmin?: boolean }) {
  if (user.isSuperAdmin) return true
  const roles = user.roles?.map((r) => r.toLowerCase()) || []
  return roles.includes('admin') || roles.includes('owner') || roles.includes('manager')
}

// GET /api/camera/mapping — Fetch camera mapping for the authenticated store admin
export async function GET() {
  try {
    const user = await requireAuth()

    if (!checkAdminRole(user)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Camera and cash drawer management is restricted to Store Administrators.',
          },
        },
        { status: 403 }
      )
    }

    const orgId = user.organizationId
    if (!orgId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'User organization not found' } },
        { status: 404 }
      )
    }

    const isEnabled = user.isSuperAdmin ? true : await isCameraDrawerEnabled(orgId)
    const mapping = await getStoreCameraMapping(orgId, user.id)

    return NextResponse.json({
      success: true,
      enabled: isEnabled,
      data: mapping,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ success: false, error: { message: msg } }, { status: 500 })
  }
}

// POST /api/camera/mapping — Save or map camera to this specific user counter
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()

    if (!checkAdminRole(user)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Camera and cash drawer management is restricted to Store Administrators.',
          },
        },
        { status: 403 }
      )
    }

    const orgId = user.organizationId
    if (!orgId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'User organization not found' } },
        { status: 404 }
      )
    }

    const isEnabled = user.isSuperAdmin ? true : await isCameraDrawerEnabled(orgId)
    if (!isEnabled) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PRIVILEGE_REQUIRED',
            message:
              'In-Store Camera & Cash Drawer Vision Intelligence is an advanced enterprise privilege. Contact your platform SuperAdmin to activate this feature.',
          },
        },
        { status: 403 }
      )
    }

    const body = await req.json()
    const parsed = saveMappingSchema.parse(body)

    const branchId = user.branchId || 'default-branch'
    const saved = await saveStoreCameraMapping({
      organizationId: orgId,
      branchId,
      userId: user.id, // Strictly bound to this specific admin (no merging of cameras)
      cameraName: parsed.cameraName,
      deviceId: parsed.deviceId,
      streamType: parsed.streamType,
      ipStreamUrl: parsed.ipStreamUrl || undefined,
      autoOpenDrawer: parsed.autoOpenDrawer,
      captureOnOpen: parsed.captureOnOpen,
    })

    return NextResponse.json({ success: true, data: saved })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ success: false, error: { message: msg } }, { status: 500 })
  }
}
