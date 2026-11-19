import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/auth-helpers'
import { prisma } from '@/lib/db/prisma'

const DEFAULT_WIDGETS = [
  'revenue_kpi',
  'low_stock',
  'expiry_critical',
  'refill_reminders',
  'whatsapp_sms',
  'customer_followups',
  'camera_drawer',
  'recent_sales',
  'pending_purchases',
  'staff_online',
  'tally_sync',
  'statutory_tax',
]

export async function GET() {
  try {
    const user = await requireAuth()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = user.id
    const setting = await prisma.systemSetting.findUnique({
      where: {
        category_key: {
          category: 'DASHBOARD_PREFERENCE',
          key: userId,
        },
      },
    })

    if (setting) {
      try {
        const parsed = JSON.parse(setting.value)
        return NextResponse.json({
          success: true,
          widgets: parsed.widgets || DEFAULT_WIDGETS,
          layout: parsed.layout || 'grid',
        })
      } catch {
        // Fallback to default
      }
    }

    return NextResponse.json({
      success: true,
      widgets: DEFAULT_WIDGETS,
      layout: 'grid',
    })
  } catch (error: any) {
    console.error('Failed to get dashboard preferences:', error)
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = user.id
    const body = await req.json()
    const widgets = Array.isArray(body.widgets) && body.widgets.length > 0 ? body.widgets : DEFAULT_WIDGETS
    const layout = body.layout === 'compact' ? 'compact' : 'grid'

    const valStr = JSON.stringify({
      widgets,
      layout,
      updatedAt: new Date().toISOString(),
    })

    await prisma.systemSetting.upsert({
      where: {
        category_key: {
          category: 'DASHBOARD_PREFERENCE',
          key: userId,
        },
      },
      create: {
        category: 'DASHBOARD_PREFERENCE',
        key: userId,
        value: valStr,
        dataType: 'json',
        label: `Dashboard preferences for ${user.email || userId}`,
      },
      update: {
        value: valStr,
        dataType: 'json',
      },
    })

    return NextResponse.json({
      success: true,
      widgets,
      layout,
    })
  } catch (error: any) {
    console.error('Failed to update dashboard preferences:', error)
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}
