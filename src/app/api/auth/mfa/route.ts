import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth/auth-helpers'
import { generateTotpSecret, generateTotp, verifyTotp, getTotpUri } from '@/lib/auth/totp-service'

// GET /api/auth/mfa — Get MFA status or generate new setup secret
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, mfaEnabled: true, totpSecret: true },
    })

    if (!dbUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    // If MFA is not yet enabled, provide a fresh secret and otpauth URI for setup
    const secret = dbUser.totpSecret || generateTotpSecret()
    const uri = getTotpUri(dbUser.email, secret, 'PharmaCare Dispensary OS')

    // If secret wasn't saved yet, save it tentatively
    if (!dbUser.totpSecret) {
      await prisma.user.update({
        where: { id: dbUser.id },
        data: { totpSecret: secret },
      })
    }

    return NextResponse.json({
      success: true,
      mfaEnabled: dbUser.mfaEnabled,
      secret,
      uri,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to inspect MFA state' },
      { status: 500 }
    )
  }
}

// POST /api/auth/mfa — Verify code & enable, or disable with password
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { action, code, secret, password } = body

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, password: true, mfaEnabled: true, totpSecret: true },
    })

    if (!dbUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    if (action === 'enable' || action === 'verify') {
      const activeSecret = secret || dbUser.totpSecret
      if (!activeSecret) {
        return NextResponse.json(
          { success: false, error: 'No MFA secret found. Please generate a QR code first.' },
          { status: 400 }
        )
      }

      if (!code || typeof code !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Please enter the 6-digit verification code.' },
          { status: 400 }
        )
      }

      const isValid = verifyTotp(code, activeSecret)
      if (!isValid) {
        return NextResponse.json(
          { success: false, error: 'Invalid verification code. Please check your authenticator app.' },
          { status: 400 }
        )
      }

      await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          mfaEnabled: true,
          totpSecret: activeSecret,
        },
      })

      // Record audit
      await prisma.auditLog.create({
        data: {
          userId: dbUser.id,
          action: 'MFA_ENABLED',
          entity: 'User',
          entityId: dbUser.id,
          newData: { method: 'TOTP_RFC6238' },
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Two-Factor Authentication (MFA) enabled successfully!',
      })
    }

    if (action === 'disable') {
      if (!password && !user.isSuperAdmin) {
        return NextResponse.json(
          { success: false, error: 'Password required to disable MFA' },
          { status: 400 }
        )
      }

      if (password && dbUser.password) {
        const passwordMatches = await bcrypt.compare(password, dbUser.password)
        if (!passwordMatches) {
          return NextResponse.json({ success: false, error: 'Incorrect password' }, { status: 400 })
        }
      }

      await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          mfaEnabled: false,
        },
      })

      await prisma.auditLog.create({
        data: {
          userId: dbUser.id,
          action: 'MFA_DISABLED',
          entity: 'User',
          entityId: dbUser.id,
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Two-Factor Authentication disabled successfully.',
      })
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'MFA operation failed' },
      { status: 500 }
    )
  }
}
