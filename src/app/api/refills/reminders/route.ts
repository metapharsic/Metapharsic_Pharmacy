import { getSession } from '@/lib/auth/auth-helpers'
import { prisma } from '@/lib/db/prisma'
import { RefillRetentionService } from '@/lib/retention/refill-retention-service'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    let orgId = session.user.organizationId
    if (!orgId) {
      const searchOrg = req.nextUrl.searchParams.get('organizationId')
      if (searchOrg) {
        orgId = searchOrg
      } else {
        const firstOrg = await prisma.organization.findFirst({ select: { id: true } })
        orgId = firstOrg?.id || null
      }
    }

    if (!orgId) {
      return NextResponse.json({ success: false, error: 'No organization found' }, { status: 404 })
    }

    const summary = await RefillRetentionService.getRefillRetentionSummary(orgId)

    return NextResponse.json({
      success: true,
      data: summary,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch refill reminders'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      phone?: string
      message?: string
      organizationId?: string
    }

    let orgId = session.user.organizationId
    if (!orgId) {
      if (body.organizationId) {
        orgId = body.organizationId
      } else {
        const firstOrg = await prisma.organization.findFirst({ select: { id: true } })
        orgId = firstOrg?.id || null
      }
    }

    if (!orgId) {
      return NextResponse.json({ success: false, error: 'Organization ID missing' }, { status: 400 })
    }

    if (!body.phone || !body.message) {
      return NextResponse.json(
        { success: false, error: 'Recipient phone and message text are required' },
        { status: 400 }
      )
    }

    const sendResult = await RefillRetentionService.dispatchRefillReminder({
      organizationId: orgId,
      recipientPhone: body.phone,
      message: body.message,
    })

    return NextResponse.json({
      success: true,
      data: { sendResult },
      message: `Refill reminder dispatched to ${sendResult.toPhone} via ${sendResult.providerUsed}`,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to dispatch refill reminder'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
