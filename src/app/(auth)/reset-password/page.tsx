import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Activity, CheckCircle2, Database, KeyRound, ShieldAlert, Sparkles } from 'lucide-react'

import { ResetPasswordForm } from '@/components/auth/reset-password-form'
import { Logo } from '@/components/shared/logo'

export const metadata: Metadata = {
  title: 'Reset Password | PharmaCare Dispensary OS',
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen w-full flex-col lg:flex-row bg-background">
      {/* Left Showcase Panel — Enterprise Healthcare Showcase */}
      <div className="relative hidden w-full lg:flex lg:w-1/2 flex-col justify-between p-12 bg-clinical-mesh text-white overflow-hidden">
        {/* Ambient glow decoration */}
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-teal-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10">
          <Logo size="lg" variant="white" subtitle="Next-Gen Clinical Infrastructure" />
        </div>

        {/* Value Proposition & Feature Highlights */}
        <div className="relative z-10 max-w-lg space-y-8 my-auto py-8">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-500/10 px-3 py-1 text-xs font-medium text-teal-200">
              <Sparkles className="h-3.5 w-3.5 text-teal-300" />
              <span>Multi-Factor Authentication & Account Recovery</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white leading-tight">
              Clinical Security & Zero-Trust Dispensary Safeguards.
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Automated OTP dispatch via Email & Mobile SMS/WhatsApp, cryptographic session tokens, and instant lockout recovery for authorized pharmacy personnel.
            </p>
          </div>

          {/* Security Features */}
          <div className="grid gap-3.5 pt-2">
            <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-md transition-colors hover:bg-white/[0.08]">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/20 text-teal-300">
                <KeyRound className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-white">One-Time Password (OTP) Recovery</p>
                <p className="text-slate-300/80 mt-0.5">
                  15-minute time-based single-use recovery tokens delivered securely to verified clinical staff contacts.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-md transition-colors hover:bg-white/[0.08]">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-white">Automated Account Lockout Clearance</p>
                <p className="text-slate-300/80 mt-0.5">
                  Instant reset of failed attempt counters and automatic unlock of locked pharmacy accounts upon verification.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Clinical System Status Footer */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300 font-medium">Security Recovery Node Active</span>
            <span className="text-slate-300">• v2.4 Enterprise</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-300">
            <CheckCircle2 className="h-3.5 w-3.5 text-teal-400" />
            <span>256-Bit TLS Secured</span>
          </div>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-10 lg:p-16 bg-slate-50/50 dark:bg-background">
        <div className="w-full max-w-md">
          <Suspense>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </main>
  )
}
