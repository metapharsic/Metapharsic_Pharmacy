import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/auth-helpers'
import { NotificationService, NotificationType } from '@/lib/notifications/notification-service'

export const dynamic = 'force-dynamic'

/**
 * GET /api/notifications
 * Synchronizes and retrieves notifications scoped strictly to the authenticated user.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const unreadOnly = searchParams.get('unreadOnly') === 'true'
    const typeParam = searchParams.get('type') as NotificationType | null
    const skipSync = searchParams.get('skipSync') === 'true'

    // Automatically sync live database alerts (low stock, batch expiry, dues, refills)
    if (!skipSync) {
      await NotificationService.syncUserNotifications(session.user.id)
    }

    const [notifications, summary] = await Promise.all([
      NotificationService.getUserNotifications(session.user.id, {
        unreadOnly,
        type: typeParam || undefined,
        limit: 40,
      }),
      NotificationService.getNotificationSummary(session.user.id),
    ])

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount: summary.unreadCount,
      summary,
      user: {
        id: session.user.id,
        name: session.user.name,
        organizationId: session.user.organizationId,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch notifications'
    console.error('[API /api/notifications] GET error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

/**
 * PATCH /api/notifications
 * Marks one or all notifications as read for the authenticated user.
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      id?: string
      all?: boolean
    }

    if (body.all) {
      await NotificationService.markAllAsRead(session.user.id)
    } else if (body.id) {
      await NotificationService.markAsRead(body.id, session.user.id)
    } else {
      return NextResponse.json({ success: false, error: 'Provide "id" or "all: true"' }, { status: 400 })
    }

    const unreadCount = await NotificationService.getUnreadCount(session.user.id)

    return NextResponse.json({
      success: true,
      unreadCount,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update notifications'
    console.error('[API /api/notifications] PATCH error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

/**
 * DELETE /api/notifications
 * Deletes a single notification or clears all read notifications for the authenticated user.
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const clearRead = searchParams.get('clearRead') === 'true'

    if (clearRead) {
      const cleared = await NotificationService.clearRead(session.user.id)
      return NextResponse.json({ success: true, clearedCount: cleared })
    } else if (id) {
      const deleted = await NotificationService.deleteNotification(id, session.user.id)
      return NextResponse.json({ success: true, deleted })
    } else {
      return NextResponse.json({ success: false, error: 'Provide "id" or "clearRead=true"' }, { status: 400 })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete notifications'
    console.error('[API /api/notifications] DELETE error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
