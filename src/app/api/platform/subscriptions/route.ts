import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/auth-helpers'
import {
  getOrganizationSubscriptions,
  assignNewLicenseKey,
  completePaymentAndAutoRenewLicense,
  sendSubscriptionExpiryNotice,
} from '@/lib/platform/platform-licensing-service'

export async function GET() {
  try {
    await requireSuperAdmin()

    const subscriptions = await getOrganizationSubscriptions()

    return NextResponse.json({
      success: true,
      subscriptions,
    })
  } catch (error: any) {
    const isAuth = error?.message === 'Unauthorized'
    const isForbidden = error?.message?.includes('Forbidden') || error?.message?.includes('privilege')

    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to fetch subscriptions',
      },
      { status: isAuth ? 401 : isForbidden ? 403 : 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    await requireSuperAdmin()
    const body = await req.json()
    const { action, organizationId } = body

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 })
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION 1: GENERATE NEW LICENSE KEY
    // ─────────────────────────────────────────────────────────────
    if (action === 'generate-license') {
      const { durationDays = 30 } = body
      const res = await assignNewLicenseKey(organizationId, Number(durationDays))
      return NextResponse.json({
        success: true,
        message: `New license key generated: ${res.licenseKey}`,
        ...res,
      })
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION 2: PROCESS PAYMENT & AUTO-RENEW LICENSE
    // ─────────────────────────────────────────────────────────────
    if (action === 'process-payment') {
      const { amount = 2999, durationDays = 30, paymentReference, paymentMethod } = body
      const res = await completePaymentAndAutoRenewLicense({
        organizationId,
        amount: Number(amount),
        durationDays: Number(durationDays),
        paymentReference,
        paymentMethod,
      })
      return NextResponse.json({
        ...res,
        message: `Payment registered and license automatically renewed with key: ${res.licenseKey}`,
      })
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION 3: SEND EXPIRY / PAYMENT NOTICE
    // ─────────────────────────────────────────────────────────────
    if (action === 'send-expiry-notice') {
      const res = await sendSubscriptionExpiryNotice(organizationId)
      return NextResponse.json(res)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    const isAuth = error?.message === 'Unauthorized'
    const isForbidden = error?.message?.includes('Forbidden') || error?.message?.includes('privilege')

    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Subscription operation failed',
      },
      { status: isAuth ? 401 : isForbidden ? 403 : 500 }
    )
  }
}
