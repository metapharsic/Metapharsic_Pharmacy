'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/navigation'
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Mail, Phone, ShieldCheck, Smartphone } from 'lucide-react'
import { toast } from 'sonner'

import { Logo } from '@/components/shared/logo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ROUTES } from '@/lib/constants/routes'

export function ResetPasswordForm() {
  const router = useRouter()

  // Steps: 'request' | 'verify' | 'completed'
  const [step, setStep] = useState<'request' | 'verify' | 'completed'>('request')
  const [identifier, setIdentifier] = useState('')
  const [channel, setChannel] = useState<'email' | 'mobile'>('email')
  const [otp, setOtp] = useState('')
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null)
  const [maskedDestination, setMaskedDestination] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Handle Send OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identifier.trim()) {
      toast.error('Please enter your registered email address or mobile number.')
      return
    }

    setIsSubmitting(true)
    setDevOtpHint(null)

    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request-otp',
          identifier: identifier.trim(),
          channel,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to dispatch OTP. Please check your details.')
        return
      }

      toast.success(data.message || 'OTP dispatched successfully!')
      if (data.maskedDestination) {
        setMaskedDestination(data.maskedDestination)
      }
      if (data.devOtp) {
        setDevOtpHint(data.devOtp)
      }
      setStep('verify')
    } catch {
      toast.error('An unexpected error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Verify & Reset Password
  const handleVerifyReset = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!otp.trim()) {
      toast.error('Please enter the 6-digit OTP code.')
      return
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.')
      return
    }

    setIsSubmitting(true)

    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify-reset',
          identifier: identifier.trim(),
          otp: otp.trim(),
          newPassword,
          confirmPassword,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Password reset failed. Please verify the OTP code.')
        return
      }

      toast.success('Password updated successfully!')
      setStep('completed')
    } catch {
      toast.error('An error occurred during password update.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full max-w-md border-border/80 shadow-card">
      <CardHeader className="space-y-3 pb-4 text-center sm:text-left">
        <div className="flex items-center justify-between">
          <Logo size="md" />
          <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400 border-teal-500/30">
            Secure Recovery
          </Badge>
        </div>
        <div>
          <CardTitle className="text-xl font-bold tracking-tight">
            {step === 'completed'
              ? 'Password Reset Complete'
              : step === 'verify'
              ? 'Verify OTP & Set Password'
              : 'Recover Credentials'}
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            {step === 'completed'
              ? 'Your security credentials have been updated and your account is unlocked.'
              : step === 'verify'
              ? `Enter the 6-digit code sent to ${maskedDestination || 'your registered account'}.`
              : 'Receive a secure one-time password (OTP) via Email or Mobile to reset your key.'}
          </CardDescription>
        </div>
      </CardHeader>

      {/* STEP 1: REQUEST OTP */}
      {step === 'request' && (
        <form onSubmit={handleRequestOtp}>
          <CardContent className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="identifier" className="text-xs font-semibold text-foreground/80">
                Staff Email or Registered Mobile
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="identifier"
                  type="text"
                  placeholder="e.g. admin@pharmacare.local or 9848011223"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={isSubmitting}
                  className="pl-9 text-sm"
                  autoFocus
                  required
                />
              </div>
            </div>

            {/* Delivery Channel Radio/Tabs */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground/80">Deliver OTP Code Via</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setChannel('email')}
                  className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-medium transition-all ${
                    channel === 'email'
                      ? 'border-teal-500 bg-teal-50/50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-300 shadow-sm'
                      : 'border-border/60 hover:bg-muted text-muted-foreground'
                  }`}
                >
                  <Mail className="h-4 w-4" />
                  <span>Email Inbox</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChannel('mobile')}
                  className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-medium transition-all ${
                    channel === 'mobile'
                      ? 'border-teal-500 bg-teal-50/50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-300 shadow-sm'
                      : 'border-border/60 hover:bg-muted text-muted-foreground'
                  }`}
                >
                  <Smartphone className="h-4 w-4" />
                  <span>Mobile / SMS</span>
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span>Dispatching OTP...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  <span>Send Security OTP</span>
                </>
              )}
            </Button>
          </CardContent>

          <CardFooter className="flex justify-center border-t border-border/50 py-3 text-xs">
            <a
              href={ROUTES.LOGIN}
              className="inline-flex items-center gap-1 font-medium text-teal-600 hover:underline dark:text-teal-400"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Dispensary Sign In</span>
            </a>
          </CardFooter>
        </form>
      )}

      {/* STEP 2: VERIFY OTP & RESET PASSWORD */}
      {step === 'verify' && (
        <form onSubmit={handleVerifyReset}>
          <CardContent className="space-y-4 pt-2">
            {devOtpHint && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Dev/Offline Code:</span>
                  <button
                    type="button"
                    onClick={() => setOtp(devOtpHint)}
                    className="rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-800 hover:bg-amber-500/30 dark:text-amber-200"
                  >
                    Auto-Fill ({devOtpHint})
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="otp" className="text-xs font-semibold text-foreground/80">
                6-Digit Security OTP
              </Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="otp"
                  type="text"
                  maxLength={6}
                  placeholder="e.g. 123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  disabled={isSubmitting}
                  className="pl-9 text-base tracking-widest font-mono text-center sm:text-left"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="newPassword" className="text-xs font-semibold text-foreground/80">
                New Password
              </Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isSubmitting}
                  className="pr-10 text-sm"
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-xs font-semibold text-foreground/80">
                Confirm New Password
              </Label>
              <Input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSubmitting}
                className="text-sm"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span>Updating Credentials...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  <span>Update & Unlock Account</span>
                </>
              )}
            </Button>
          </CardContent>

          <CardFooter className="flex items-center justify-between border-t border-border/50 py-3 text-xs">
            <button
              type="button"
              onClick={() => {
                setStep('request')
                setOtp('')
              }}
              className="text-muted-foreground hover:underline"
            >
              Request new OTP
            </button>
            <a
              href={ROUTES.LOGIN}
              className="font-medium text-teal-600 hover:underline dark:text-teal-400"
            >
              Cancel & Sign In
            </a>
          </CardFooter>
        </form>
      )}

      {/* STEP 3: COMPLETED */}
      {step === 'completed' && (
        <div className="space-y-4 p-6 pt-2 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-foreground text-sm">Account Successfully Secured</h3>
            <p className="text-xs text-muted-foreground">
              You can now sign in with your updated credentials and access your pharmacy dispensary counter.
            </p>
          </div>
          <Button
            onClick={() => router.push(ROUTES.LOGIN)}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium"
          >
            Go to Dispensary Sign In
          </Button>
        </div>
      )}
    </Card>
  )
}
