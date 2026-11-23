'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  Cpu,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
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
import { loginSchema, type LoginInput } from '@/lib/validations/auth'
import { ThreadStatusCard, type ThreadItem } from './thread-status-card'
import { LanguageToggle } from '@/components/shared/language-toggle'
import { useI18n } from '@/lib/i18n/i18n-context'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') ?? ROUTES.DASHBOARD
  const { t } = useI18n()

  // Authentication Step: 'CREDENTIALS' (Standard login) vs 'MFA' (2FA Code verification)
  const [authStep, setAuthStep] = useState<'CREDENTIALS' | 'MFA'>('CREDENTIALS')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [mfaCode, setMfaCode] = useState('')
  const [isExecutingThreads, setIsExecutingThreads] = useState(false)
  const [threadResults, setThreadResults] = useState<ThreadItem[] | null>(null)
  const [totalDurationMs, setTotalDurationMs] = useState(0)
  const [showDiagnosticsDialog, setShowDiagnosticsDialog] = useState(false)
  const [diagnosticsData, setDiagnosticsData] = useState<any>(null)

  const getInitialThreads = (): ThreadItem[] => [
    {
      id: 1,
      code: 'THREAD_AUTH',
      name: 'Worker Thread #1: Cryptographic Authentication',
      label: 'BCrypt & Credential Security',
      status: 'RUNNING',
      durationMs: 0,
      details: 'Verifying hash and credential security...',
    },
    {
      id: 2,
      code: 'THREAD_RBAC',
      name: 'Worker Thread #2: Regulatory RBAC & Form 20/21 Matrix',
      label: 'Permissions & Narcotic Clearance',
      status: 'PENDING',
      durationMs: 0,
      details: 'Evaluating Schedule H1 narcotic clearance...',
    },
    {
      id: 3,
      code: 'THREAD_BACKUP',
      name: 'Worker Thread #3: Automated Database Backup Sync',
      label: 'Multi-Domain Login Backup',
      status: 'PENDING',
      durationMs: 0,
      details: 'Executing automated login backup snapshot...',
    },
    {
      id: 4,
      code: 'THREAD_AUDIT',
      name: 'Worker Thread #4: Session Audit & Device Security Registry',
      label: 'Regulatory Audit & Fingerprint',
      status: 'PENDING',
      durationMs: 0,
      details: 'Recording tamper-proof audit event & device telemetry...',
    },
    {
      id: 5,
      code: 'THREAD_CACHE',
      name: 'Worker Thread #5: POS Formulation & Stock Cache Preload',
      label: 'Counter Cache Pre-Flight',
      status: 'PENDING',
      durationMs: 0,
      details: 'Pre-warming catalog cache for sub-second POS barcode dispensing...',
    },
  ]

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      mfaCode: '',
    },
  })

  // Core Multi-Thread Authentication Pipeline
  const executeAuthenticationPipeline = async (email: string, pass: string, code?: string) => {
    setIsExecutingThreads(true)
    setThreadResults(getInitialThreads())

    try {
      // Step 1: Fire backend multi-threaded verification & backup engine
      const multiThreadRes = await fetch('/api/login-threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password: pass,
          mfaCode: code?.trim(),
          deviceFingerprint: 'Standard-Dispensary-Browser',
        }),
      })

      const multiThreadData = await multiThreadRes.json()

      // If server asks for MFA code
      if (multiThreadData.requireMfa && !code) {
        setIsExecutingThreads(false)
        setThreadResults(null)
        setAuthStep('MFA')
        toast.info('Two-Factor Authentication (MFA) required. Please enter your 6-digit code.')
        return
      }

      if (!multiThreadRes.ok || !multiThreadData.success) {
        if (multiThreadData.threads) {
          setThreadResults(multiThreadData.threads)
        }
        setIsExecutingThreads(false)
        toast.error(multiThreadData.error || 'Authentication failed. Please verify your credentials.')
        return
      }

      // Update UI with real thread duration and telemetry
      setThreadResults(multiThreadData.threads)
      setTotalDurationMs(multiThreadData.stats?.totalDurationMs || 0)

      // Step 2: Establish official NextAuth session cookie
      const result = await signIn('credentials', {
        email: email.trim(),
        password: pass,
        mfaCode: code?.trim(),
        redirect: false,
      })

      if (result?.error) {
        setIsExecutingThreads(false)
        toast.error(result.error || 'Session establishment failed. Please try again.')
        return
      }

      toast.success(
        `Authenticated in ${multiThreadData.stats?.totalDurationMs || 0}ms. Dispensary backup verified!`
      )

      // Step 3: Role-based destination redirect
      try {
        const sessionRes = await fetch('/api/auth/session')
        const sessionJson = (await sessionRes.json()) as {
          user?: { roles?: string[]; isSuperAdmin?: boolean }
        } | null
        const roles = sessionJson?.user?.roles ?? []

        setTimeout(() => {
          if (sessionJson?.user?.isSuperAdmin) {
            router.push('/platform')
          } else if (
            roles.includes('cashier') &&
            !roles.includes('owner') &&
            !roles.includes('manager')
          ) {
            router.push(ROUTES.POS)
          } else {
            router.push(callbackUrl)
          }
          router.refresh()
        }, 350)
      } catch {
        router.push(callbackUrl)
        router.refresh()
      }
    } catch {
      setIsExecutingThreads(false)
      toast.error('An unexpected connection error occurred during verification.')
    }
  }

  // Handle standard credential form submit
  const onCredentialsSubmit = async (data: LoginInput) => {
    await executeAuthenticationPipeline(data.email, data.password)
  }

  // Handle MFA 6-digit verification code submit
  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mfaCode || mfaCode.trim().length !== 6) {
      toast.error('Please enter a valid 6-digit verification code.')
      return
    }
    const { email, password } = getValues()
    await executeAuthenticationPipeline(email, password, mfaCode)
  }

  // Fetch thread diagnostics on demand
  const handleOpenDiagnostics = async () => {
    setShowDiagnosticsDialog(true)
    try {
      const res = await fetch('/api/login-threads')
      const data = await res.json()
      setDiagnosticsData(data)
    } catch {
      // Ignore
    }
  }

  return (
    <div className="w-full space-y-4">
      {/* Top Header Controls: Language Toggle */}
      <div className="flex items-center justify-between pb-1">
        <span className="text-xs font-semibold text-muted-foreground">
          {t('territory.title', 'Dispensary Portal')}
        </span>
        <LanguageToggle />
      </div>

      {/* Real-time Thread Status Card during or after execution */}
      {threadResults && (
        <ThreadStatusCard
          threads={threadResults}
          isExecuting={isExecutingThreads}
          totalDurationMs={totalDurationMs}
          onClose={() => setThreadResults(null)}
        />
      )}

      {/* ── STANDARD ENTERPRISE LOGIN VIEW ── */}
      <Card className="w-full max-w-md border-border/80 shadow-card animate-in fade-in duration-200">
        <CardHeader className="space-y-3 pb-4 text-center sm:text-left">
          <div className="flex items-center justify-between">
            <Logo size="md" />
            <Badge
              variant="outline"
              className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1"
            >
              <ShieldCheck className="h-3 w-3 text-teal-600 dark:text-teal-400" />
              <span>Secure Gateway</span>
            </Badge>
          </div>

          <div>
            <CardTitle className="text-xl font-bold tracking-tight">
              {authStep === 'CREDENTIALS'
                ? t('auth.signIn', 'Sign In')
                : t('auth.mfaTitle', 'Two-Factor Authentication')}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {authStep === 'CREDENTIALS'
                ? t('auth.welcomeBack', 'Enter your registered credentials to access your dispensary terminal.')
                : t('auth.mfaSubtitle', 'Enter the 6-digit verification code from your authenticator application.')}
            </CardDescription>
          </div>
        </CardHeader>

        {authStep === 'CREDENTIALS' ? (
          /* STEP 1: CREDENTIALS FORM */
          <form onSubmit={handleSubmit(onCredentialsSubmit)}>
            <CardContent className="space-y-4 pt-2">
              {/* Email / Username Field */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-foreground/80">
                  {t('auth.email', 'Email Address or Username')}
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="text"
                    placeholder="name@pharmacy.com or username"
                    autoComplete="username email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    disabled={isExecutingThreads || isSubmitting}
                    className="pl-9 text-sm"
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-semibold text-foreground/80">
                    {t('auth.enterPassword', 'Password')}
                  </Label>
                  <a
                    href={ROUTES.RESET_PASSWORD}
                    className="text-xs font-medium text-teal-600 hover:text-teal-700 hover:underline dark:text-teal-400"
                  >
                    {t('auth.forgotPassword', 'Forgot password?')}
                  </a>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    disabled={isExecutingThreads || isSubmitting}
                    className="pl-9 pr-10 text-sm font-sans"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500 dark:border-slate-700 dark:bg-slate-900"
                />
                <label
                  htmlFor="rememberMe"
                  className="text-xs text-muted-foreground cursor-pointer select-none"
                >
                  Keep me signed in on this terminal
                </label>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3 pt-3">
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-teal-800 to-teal-700 hover:from-teal-900 hover:to-teal-800 text-white font-medium shadow-teal-glow transition-all"
                disabled={isExecutingThreads || isSubmitting}
              >
                {isExecutingThreads || isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authenticating Credentials...
                  </>
                ) : (
                  'Sign In to Dispensary Terminal'
                )}
              </Button>

              <div className="flex items-center justify-between w-full text-[11px] text-muted-foreground pt-1">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  <span>Automated Database Backup Active</span>
                </div>
                <button
                  type="button"
                  onClick={handleOpenDiagnostics}
                  className="text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 font-mono text-[10.5px]"
                >
                  <Cpu className="h-3 w-3" />
                  <span>Telemetry</span>
                </button>
              </div>
            </CardFooter>
          </form>
        ) : (
          /* STEP 2: TWO-FACTOR AUTHENTICATION (MFA) */
          <form onSubmit={handleMfaSubmit}>
            <CardContent className="space-y-4 pt-2">
              <div className="rounded-xl border border-teal-500/20 bg-teal-500/10 p-3.5 text-xs text-teal-900 dark:text-teal-200 flex items-start gap-3">
                <KeyRound className="h-5 w-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Security Verification Required</p>
                  <p className="text-[11px] leading-relaxed opacity-90">
                    Enter the 6-digit verification code from your authenticator app (Google Authenticator, Microsoft Authenticator, or 1Password).
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mfaCode" className="text-xs font-semibold text-foreground/80">
                  6-Digit Verification Code
                </Label>
                <Input
                  id="mfaCode"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  autoFocus
                  placeholder="000000"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={isExecutingThreads || isSubmitting}
                  className="text-center font-mono text-2xl tracking-[0.4em] font-bold h-12"
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-2.5 pt-2">
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-teal-800 to-teal-700 hover:from-teal-900 hover:to-teal-800 text-white font-medium shadow-teal-glow transition-all"
                disabled={isExecutingThreads || isSubmitting || mfaCode.length !== 6}
              >
                {isExecutingThreads || isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying Two-Factor Code...
                  </>
                ) : (
                  'Verify & Access Terminal'
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setAuthStep('CREDENTIALS')
                  setMfaCode('')
                }}
                disabled={isExecutingThreads || isSubmitting}
                className="w-full text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Back to Credentials
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>

      {/* Diagnostics Dialog */}
      <Dialog open={showDiagnosticsDialog} onOpenChange={setShowDiagnosticsDialog}>
        <DialogContent className="max-w-md bg-slate-950 text-white border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Cpu className="h-4 w-4 text-teal-400" />
              Dispensary Security & Worker Telemetry
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Active background worker threads ensuring real-time integrity and compliance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 pt-2 font-mono text-xs">
            {diagnosticsData?.configuredThreads?.map((thread: any) => (
              <div
                key={thread.id}
                className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800"
              >
                <div>
                  <p className="font-semibold text-slate-200">{thread.name}</p>
                  <p className="text-[10px] text-slate-400">{thread.target}</p>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                  {thread.state}
                </span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
