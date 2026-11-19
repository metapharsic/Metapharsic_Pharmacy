import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/auth-helpers'
import {
  getCashDrawerAnalytics,
  isCameraDrawerEnabled,
  recordCashDrawerOpen,
} from '@/lib/camera/camera-drawer-service'

function checkAdminRole(user: { roles?: string[]; isSuperAdmin?: boolean }) {
  if (user.isSuperAdmin) return true
  const roles = user.roles?.map((r) => r.toLowerCase()) || []
  return roles.includes('admin') || roles.includes('owner') || roles.includes('manager')
}

const recordEventSchema = z.object({
  eventType: z.enum(['AUTO_CASH_COLLECTED', 'MANUAL_ADMIN_OPEN', 'SENSOR_DETECTED']),
  invoiceNumber: z.string().optional(),
  cashAmount: z.number().optional().default(0),
  snapshotData: z.string().optional(), // Base64 JPEG/WebP frame from mapped camera
  deviceId: z.string().optional(),
  notes: z.string().optional(),
})

// GET /api/camera/drawer-events — Store Admin Analytics & 48-Hour Audit Log
export async function GET() {
  try {
    const user = await requireAuth()

    if (!checkAdminRole(user)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Camera intelligence and cash drawer metrics are restricted to Store Administrators.',
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

    const analytics = await getCashDrawerAnalytics(orgId, user.id, user.isSuperAdmin)

    return NextResponse.json({
      success: true,
      data: analytics,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ success: false, error: { message: msg } }, { status: 500 })
  }
}

// POST /api/camera/drawer-events — Record cash drawer opening with camera snapshot
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const orgId = user.organizationId

    if (!orgId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'User organization not found' } },
        { status: 404 }
      )
    }

    // SuperAdmin enterprise gate check
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

    const body = await req.json()
    const parsed = recordEventSchema.parse(body)

    // If manual admin open or sensor inspection, ensure user is admin
    if (parsed.eventType === 'MANUAL_ADMIN_OPEN' && !checkAdminRole(user)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Manual cash drawer override is restricted to Store Administrators.',
          },
        },
        { status: 403 }
      )
    }

    const branchId = user.branchId || 'default-branch'

    const event = await recordCashDrawerOpen({
      organizationId: orgId,
      branchId,
      userId: user.id,
      eventType: parsed.eventType,
      invoiceNumber: parsed.invoiceNumber,
      cashAmount: parsed.cashAmount,
      snapshotData: parsed.snapshotData,
      deviceId: parsed.deviceId,
      notes: parsed.notes,
    })

    return NextResponse.json({
      success: true,
      data: {
        id: event.id,
        eventType: event.eventType,
        openedAt: event.openedAt,
        invoiceNumber: event.invoiceNumber,
        cashAmount: Number(event.cashAmount),
        storageRetentionHours: 48,
      },
    })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: err.errors[0]?.message || 'Invalid input' } },
        { status: 400 }
      )
    }
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ success: false, error: { message: msg } }, { status: 500 })
  }
}
