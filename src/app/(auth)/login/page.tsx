import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Activity, CheckCircle2, Database, ShieldAlert, Sparkles } from 'lucide-react'

import { LoginForm } from '@/components/auth/login-form'
import { Logo } from '@/components/shared/logo'

export const metadata: Metadata = {
  title: 'Sign In | PharmaCare Dispensary OS',
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen w-full flex-col lg:flex-row rtl:lg:flex-row-reverse bg-background">
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
              <span>Next-Gen Dispensary Operating Infrastructure</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white leading-tight">
              Enterprise Pharmacy Management, Engineered for Safety.
              <span className="block text-xl font-normal text-teal-200 mt-1 font-arabic">
                منظومة إدارة الصيدليات الإكلينيكية المتقدمة
              </span>
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Standardized clinical pharmacy operations featuring sub-second POS barcode billing, automated FEFO batch expiration safeguards, strict narcotic registers, and zero-bleed multi-tenant data isolation.
            </p>
          </div>

          {/* Core Security & Compliance Pillars */}
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="px-3 py-1 rounded-lg bg-white/10 border border-white/15 text-[11px] font-medium text-teal-300 flex items-center gap-1.5">
              <ShieldAlert className="h-3 w-3" /> Dual-Factor Security
            </span>
            <span className="px-3 py-1 rounded-lg bg-white/10 border border-white/15 text-[11px] font-medium text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3" /> FEFO Expiry Safeguard
            </span>
            <span className="px-3 py-1 rounded-lg bg-white/10 border border-white/15 text-[11px] font-medium text-cyan-300 flex items-center gap-1.5">
              <Activity className="h-3 w-3" /> Sub-Second POS
            </span>
            <span className="px-3 py-1 rounded-lg bg-white/10 border border-white/15 text-[11px] font-medium text-amber-300 flex items-center gap-1.5">
              <Database className="h-3 w-3" /> Auto Ledger & CSV Sync
            </span>
          </div>

          {/* Feature Badges */}
          <div className="grid gap-3.5 pt-2">
            <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-md transition-colors hover:bg-white/[0.08]">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/20 text-teal-300">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-white">Schedule & Controlled Drug Registry</p>
                <p className="text-slate-300/80 mt-0.5">
                  Strict regulatory logging with prescribing doctor credentials and customer identity verification.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-md transition-colors hover:bg-white/[0.08]">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300">
                <Activity className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-white">Sub-Second POS & Barcode Dispensing</p>
                <p className="text-slate-300/80 mt-0.5">
                  Real-time batch deduction, FEFO inventory alerts, and instant multi-tender bill finalization.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-md transition-colors hover:bg-white/[0.08]">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300">
                <Database className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-white">Automated Accounting & Tax Sync</p>
                <p className="text-slate-300/80 mt-0.5">
                  Universal CSV accounting export with automatic bill allocations and real-time ledger balancing.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Clinical System Status Footer */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300 font-medium">Dispensary Terminal Secured</span>
            <span className="text-slate-300">• Multi-Tenant Protected</span>
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
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  )
}

