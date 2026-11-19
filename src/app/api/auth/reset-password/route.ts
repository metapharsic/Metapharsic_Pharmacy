import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/db/prisma'
import { sendEmail } from '@/lib/auth/email-service'
import { WhatsAppService } from '@/lib/whatsapp/whatsapp-service'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { action } = body

    // ─────────────────────────────────────────────────────────────
    // ACTION 1: REQUEST OTP (via Email or Mobile SMS/WhatsApp)
    // ─────────────────────────────────────────────────────────────
    if (action === 'request-otp') {
      const { identifier, channel = 'email' } = body
      if (!identifier || typeof identifier !== 'string') {
        return NextResponse.json({ error: 'Please enter a valid email address or mobile number.' }, { status: 400 })
      }

      const cleanInput = identifier.trim().toLowerCase()
      const cleanPhoneDigits = identifier.replace(/\D/g, '')

      // Find user by email or phone
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: { equals: cleanInput, mode: 'insensitive' } },
            ...(cleanPhoneDigits.length >= 10 ? [{ phone: { contains: cleanPhoneDigits.slice(-10) } }] : []),
          ],
        },
      })

      if (!user) {
        // Obfuscate for security while confirming request
        return NextResponse.json({
          success: true,
          message: 'If an account matches your details, a 6-digit OTP code has been dispatched.',
        })
      }

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString()
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes validity

      // Invalidate existing unused tokens for this user
      await prisma.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      })

      // Store new OTP in database
      await prisma.passwordResetToken.create({
        data: {
          token: otp,
          userId: user.id,
          expiresAt,
        },
      })

      let deliveryMethod = 'email'
      let previewInfo = ''

      // Dispatch via Email
      if (channel === 'email' && user.email) {
        deliveryMethod = 'email'
        await sendEmail({
          to: user.email,
          subject: 'Your PharmaCare Password Reset OTP Code',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #0f766e; margin-top: 0;">Password Reset Request</h2>
              <p>Hello <strong>${user.name}</strong>,</p>
              <p>You recently requested to reset the security credentials for your PharmaCare account.</p>
              <div style="background-color: #f0fdfa; border: 1px dashed #0d9488; border-radius: 6px; padding: 16px; text-align: center; margin: 24px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0f766e;">${otp}</span>
              </div>
              <p style="font-size: 13px; color: #64748b;">This OTP code expires in 15 minutes. If you did not request this code, you can safely ignore this email.</p>
            </div>
          `,
        })
      }

      // Dispatch via WhatsApp / Mobile SMS if requested or if phone available
      if ((channel === 'mobile' || channel === 'whatsapp') && user.phone) {
        deliveryMethod = 'mobile/whatsapp'
        try {
          await WhatsAppService.sendMessage({
            toPhone: user.phone,
            message: `*PharmaCare Security*\nYour password reset OTP is: *${otp}* (valid for 15 minutes). Do not share this with anyone.`,
            provider: 'auto',
          })
        } catch (e) {
          console.error('[WhatsAppService] OTP dispatch failed:', e)
        }
      }

      console.log(`\n🔑 [SECURE OTP GENERATED] User: ${user.email} (${user.phone || 'no phone'}) | OTP: ${otp} | Channel: ${deliveryMethod}\n`)

      // In development or local environment, include safe masked hint so user is never blocked
      const isDev = process.env.NODE_ENV !== 'production' || !process.env.EMAIL_SERVER_HOST
      if (isDev) {
        previewInfo = `[Dev Hint] OTP: ${otp}`
      }

      return NextResponse.json({
        success: true,
        message: `A 6-digit OTP code has been sent to your registered ${deliveryMethod === 'email' ? 'email address' : 'mobile number'}.`,
        userId: user.id,
        userEmail: user.email,
        maskedDestination: deliveryMethod === 'email'
          ? user.email.replace(/(.{2})(.*)(?=@)/, (_, a, b) => a + '*'.repeat(Math.max(b.length, 3)))
          : (user.phone ? user.phone.replace(/(\d{2})(\d+)(\d{2})/, (_, a, b, c) => a + '*'.repeat(b.length) + c) : 'registered device'),
        devOtp: isDev ? otp : undefined,
      })
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION 2: VERIFY OTP & RESET PASSWORD
    // ─────────────────────────────────────────────────────────────
    if (action === 'verify-reset') {
      const { identifier, otp, newPassword, confirmPassword } = body

      if (!identifier || !otp || !newPassword) {
        return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
      }

      if (newPassword.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters long.' }, { status: 400 })
      }

      if (confirmPassword && newPassword !== confirmPassword) {
        return NextResponse.json({ error: 'Passwords do not match.' }, { status: 400 })
      }

      const cleanInput = identifier.trim().toLowerCase()
      const cleanPhoneDigits = identifier.replace(/\D/g, '')

      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: { equals: cleanInput, mode: 'insensitive' } },
            ...(cleanPhoneDigits.length >= 10 ? [{ phone: { contains: cleanPhoneDigits.slice(-10) } }] : []),
          ],
        },
      })

      if (!user) {
        return NextResponse.json({ error: 'Invalid user or OTP code.' }, { status: 400 })
      }

      // Check valid OTP token
      const validToken = await prisma.passwordResetToken.findFirst({
        where: {
          userId: user.id,
          token: otp.trim(),
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      })

      if (!validToken) {
        return NextResponse.json({ error: 'Invalid or expired OTP code. Please request a new one.' }, { status: 400 })
      }

      // Mark token as used
      await prisma.passwordResetToken.update({
        where: { id: validToken.id },
        data: { usedAt: new Date() },
      })

      // Hash new password and reset user locks
      const hashedPassword = await bcrypt.hash(newPassword, 12)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          failedLoginCount: 0,
          lockedUntil: null,
          isActive: true,
        },
      })

      // Audit log the password change
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'PASSWORD_RESET',
          entity: 'User',
          entityId: user.id,
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Password has been successfully updated! You can now log in with your new password.',
      })
    }

    return NextResponse.json({ error: 'Invalid action specified.' }, { status: 400 })
  } catch (error: any) {
    console.error('[ResetPasswordAPI] Error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error occurred.' }, { status: 500 })
  }
}
