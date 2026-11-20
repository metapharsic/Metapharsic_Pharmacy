import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getSession } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { prisma } from '@/lib/db/prisma'
import { resolveBranchScope } from '@/lib/inventory/branch-access'
import { DailyClosingDigestService } from '@/lib/reports/daily-closing-digest-service'
import { ExecutiveDigestService } from '@/lib/reports/executive-digest-service'
import { WhatsAppService } from '@/lib/whatsapp/whatsapp-service'

interface PostRequestBody {
  branchId?: string
  phone?: string
  date?: string
  period?: 'daily' | 'weekly' | 'monthly'
  message?: string
}

function checkCanViewDigest(session: Awaited<ReturnType<typeof getSession>>): boolean {
  if (!session?.user) return false
  const roles = (session.user.roles ?? []).map((r: string) => r.toLowerCase())
  if (
    roles.some((r: string) =>
      ['owner', 'admin', 'super_admin', 'manager', 'pharmacist'].includes(r)
    )
  ) {
    return true
  }
  const permissions = session.user.permissions ?? []
  return (
    permissions.includes(PERMISSIONS.REPORTS_SALES) ||
    permissions.includes(PERMISSIONS.REPORTS_FINANCIAL) ||
    permissions.includes(PERMISSIONS.SALES_READ)
  )
}

function checkCanDispatchDigest(session: Awaited<ReturnType<typeof getSession>>): boolean {
  if (!session?.user) return false
  const roles = (session.user.roles ?? []).map((r: string) => r.toLowerCase())
  if (
    roles.some((r: string) =>
      ['owner', 'admin', 'super_admin', 'manager', 'pharmacist'].includes(r)
    )
  ) {
    return true
  }
  const permissions = session.user.permissions ?? []
  return (
    permissions.includes(PERMISSIONS.REPORTS_SALES) ||
    permissions.includes(PERMISSIONS.REPORTS_EXPORT) ||
    permissions.includes(PERMISSIONS.SETTINGS_MANAGE)
  )
}

/**
 * GET /api/reports/daily-closing/whatsapp
 * Preview closing digest, WhatsApp formatted text, and one-click wa.me link.
 * Supports query: ?period=daily|weekly|monthly
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!checkCanViewDigest(session)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Insufficient permissions for closing digest' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(req.url)
    const requestedBranch = searchParams.get('branchId') || undefined
    let branchId: string | undefined = session.user.branchId || undefined
    if (requestedBranch) {
      try {
        const resolved = await resolveBranchScope(session.user, requestedBranch)
        if (resolved) branchId = resolved
      } catch {
        // Fallback to user branch
      }
    }
    const dateParam = searchParams.get('date')
    const targetDate = dateParam ? new Date(dateParam) : new Date()

    const periodParam = (searchParams.get('period') || 'daily').toLowerCase()
    const organizationId = session.user.organizationId || undefined

    let digest
    if (periodParam === 'weekly' || periodParam === 'monthly') {
      digest = await ExecutiveDigestService.generateExecutiveDigest(
        periodParam,
        branchId,
        targetDate,
        organizationId
      )
    } else {
      digest = await DailyClosingDigestService.generateDigest(branchId, targetDate, organizationId)
    }

    return NextResponse.json({
      success: true,
      data: digest,
      canDispatch: checkCanDispatchDigest(session),
    })
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to generate closing digest'
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}

/**
 * POST /api/reports/daily-closing/whatsapp
 * Dispatch digest or custom WhatsApp message.
 * Supports body: { period?: 'daily'|'weekly'|'monthly', phone?: string, message?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!checkCanDispatchDigest(session)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden: Insufficient permissions to dispatch WhatsApp report',
        },
        { status: 403 }
      )
    }

    const body = (await req.json().catch(() => ({}))) as PostRequestBody

    const requestedBranch = typeof body.branchId === 'string' ? body.branchId : undefined
    let branchId: string | undefined = session.user.branchId || undefined
    if (requestedBranch) {
      try {
        const resolved = await resolveBranchScope(session.user, requestedBranch)
        if (resolved) branchId = resolved
      } catch {
        // Fallback to user branch
      }
    }
    const phone =
      typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : undefined
    const dateParam = typeof body.date === 'string' ? body.date : undefined
    const targetDate = dateParam ? new Date(dateParam) : new Date()
    const organizationId = session.user.organizationId || undefined

    // 1. Direct message dispatch (e.g. from WhatsApp invoice sharing dialog)
    if (typeof body.message === 'string' && body.message.trim()) {
      let targetPhone = phone
      if (!targetPhone && organizationId) {
        const orgSetting = await prisma.organizationSetting.findUnique({
          where: {
            organizationId_key: {
              organizationId,
              key: 'WHATSAPP_OWNER_PHONE',
            },
          },
        })
        if (orgSetting?.value) {
          targetPhone = orgSetting.value
        }
      }
      if (!targetPhone) {
        targetPhone = process.env.WHATSAPP_OWNER_PHONE || '+919876543210'
      }

      const sendResult = await WhatsAppService.sendMessage({
        toPhone: targetPhone,
        message: body.message.trim(),
        organizationId,
      })
      return NextResponse.json({
        success: true,
        data: { sendResult },
        message: `Message successfully dispatched to ${sendResult.toPhone} via ${sendResult.providerUsed}`,
      })
    }

    // 2. Executive Digest dispatch for weekly or monthly
    if (body.period === 'weekly' || body.period === 'monthly') {
      const result = await ExecutiveDigestService.sendExecutiveDigest({
        period: body.period,
        branchId,
        recipientPhone: phone,
        date: targetDate,
        organizationId,
      })

      return NextResponse.json({
        success: true,
        data: result,
        message: `Report successfully dispatched to ${result.sendResult.toPhone} via ${result.sendResult.providerUsed}`,
      })
    }

    // 3. Default Daily Closing Digest dispatch
    const result = await DailyClosingDigestService.sendClosingDigest(
      branchId,
      phone,
      targetDate,
      organizationId
    )

    return NextResponse.json({
      success: true,
      data: result,
      message: `Report successfully dispatched to ${result.sendResult.toPhone} via ${result.sendResult.providerUsed}`,
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to send WhatsApp digest'
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}
