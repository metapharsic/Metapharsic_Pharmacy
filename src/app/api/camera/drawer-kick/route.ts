import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/auth-helpers'
import {
  isCameraDrawerEnabled,
  recordCashDrawerOpen,
} from '@/lib/camera/camera-drawer-service'

function checkAdminRole(user: { roles?: string[]; isSuperAdmin?: boolean }) {
  if (user.isSuperAdmin) return true
  const roles = user.roles?.map((r) => r.toLowerCase()) || []
  return roles.includes('admin') || roles.includes('owner') || roles.includes('manager')
}

const kickSchema = z.object({
  snapshotData: z.string().optional(),
  reason: z.string().default('Store Admin Manual Drawer Kick / Inspection'),
  deviceId: z.string().optional(),
})

// POST /api/camera/drawer-kick — Trigger Cash Drawer Hardware Pulse (ESC/POS: \x1b\x70\x00\x19\xfa)
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()

    if (!checkAdminRole(user)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Manual cash drawer actuation is restricted to Store Administrators.',
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
              'In-Store Camera & Cash Drawer Vision Intelligence is an enterprise privilege granted by SuperAdmin.',
          },
        },
        { status: 403 }
      )
    }

    let body = {}
    try {
      body = await req.json()
    } catch {
      // Body can be empty
    }
    const parsed = kickSchema.parse(body)

    const branchId = user.branchId || 'default-branch'

    // ESC/POS Standard Drawer Kick Pulse:
    // ESC p 0 25 250 -> Hex: 1b 70 00 19 fa
    const escposHex = '1b700019fa'
    const escposBase64 = Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]).toString('base64')

    const event = await recordCashDrawerOpen({
      organizationId: orgId,
      branchId,
      userId: user.id,
      eventType: 'MANUAL_ADMIN_OPEN',
      cashAmount: 0,
      snapshotData: parsed.snapshotData,
      deviceId: parsed.deviceId,
      notes: parsed.reason,
    })

    return NextResponse.json({
      success: true,
      message: 'Cash drawer kick pulse dispatched.',
      escposHex,
      escposBase64,
      event: {
        id: event.id,
        eventType: event.eventType,
        openedAt: event.openedAt,
        notes: event.notes,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ success: false, error: { message: msg } }, { status: 500 })
  }
}
