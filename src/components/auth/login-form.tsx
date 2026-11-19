'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  Cpu,
  Eye,
  EyeOff,
  Fingerprint,
  Layers,
  LayoutGrid,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { useState, useEffect } from 'react'
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
import { TouchPad, DEFAULT_CHEMIST_PROFILES } from './touch-pad'
import { ThreadStatusCard, type ThreadItem } from './thread-status-card'
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

  // View Mode: 'touchpad' (Mobile / POS Keypad) vs 'standard' (Desktop form)
  const [viewMode, setViewMode] = useState<'touchpad' | 'standard'>('touchpad')
  const [showPassword, setShowPassword] = useState(false)
  const [isExecutingThreads, setIsExecutingThreads] = useState(false)
  const [threadResults, setThreadResults] = useState<ThreadItem[] | null>(null)
  const [totalDurationMs, setTotalDurationMs] = useState(0)
  const [showDiagnosticsDialog, setShowDiagnosticsDialog] = useState(false)
  const [diagnosticsData, setDiagnosticsData] = useState<any>(null)

  // Default initial thread state for immediate UI feedback
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
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: DEFAULT_CHEMIST_PROFILES[0].email,
      password: '',
    },
  })

  // Core Multi-Thread Authentication Pipeline
  const executeAuthenticationPipeline = async (email: string, pass: string) => {
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
          deviceFingerprint: viewMode === 'touchpad' ? 'Mobile-Touch-Pad-POS' : 'Standard-Desktop-Browser',
        }),
      })

      const multiThreadData = await multiThreadRes.json()

      if (!multiThreadRes.ok || !multiThreadData.success) {
        if (multiThreadData.threads) {
          setThreadResults(multiThreadData.threads)
        }
        setIsExecutingThreads(false)
        toast.error(multiThreadData.error || 'Authentication failed. Please verify credentials.')
        return
      }

      // Update UI with real thread duration and telemetry
      setThreadResults(multiThreadData.threads)
      setTotalDurationMs(multiThreadData.stats?.totalDurationMs || 0)

      // Step 2: Establish official NextAuth session cookie
      const result = await signIn('credentials', {
        email: email.trim(),
        password: pass,
        redirect: false,
      })

      if (result?.error) {
        setIsExecutingThreads(false)
        toast.error('Session establishment failed. Please try again.')
        return
      }

      toast.success(
        `All 5 threads verified in ${multiThreadData.stats?.totalDurationMs || 0}ms. Backup enabled!`
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
    } catch (err: any) {
      setIsExecutingThreads(false)
      toast.error('An unexpected connection error occurred during thread execution.')
    }
  }

  // Handle standard form submit
  const onStandardSubmit = async (data: LoginInput) => {
    await executeAuthenticationPipeline(data.email, data.password)
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
      {/* View Switcher Controls (Mobile Touch Pad View vs Desktop Standard View) */}
      <div className="flex items-center justify-between rounded-xl bg-slate-200/70 p-1 dark:bg-slate-900 border border-border">
        <button
          type="button"
          onClick={() => setViewMode('touchpad')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-1.5 text-xs font-bold transition-all ${
            viewMode === 'touchpad'
              ? 'bg-teal-700 text-white shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Smartphone className="h-3.5 w-3.5" />
          <span>Mobile Touch Pad View</span>
        </button>
        <button
          type="button"
          onClick={() => setViewMode('standard')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-1.5 text-xs font-bold transition-all ${
            viewMode === 'standard'
              ? 'bg-teal-700 text-white shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          <span>Standard Login View</span>
        </button>
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

      {/* ── MODE 1: MOBILE TOUCH PAD VIEW ── */}
      {viewMode === 'touchpad' ? (
        <div className="animate-in fade-in duration-200">
          <TouchPad
            onMultiThreadSubmit={executeAuthenticationPipeline}
            isSubmitting={isExecutingThreads || isSubmitting}
            onSwitchToDesktop={() => setViewMode('standard')}
            onOpenDiagnostics={handleOpenDiagnostics}
          />
        </div>
      ) : (
        /* ── MODE 2: STANDARD FORM VIEW ── */
        <Card className="w-full max-w-md border-border/80 shadow-card animate-in fade-in duration-200">
          <CardHeader className="space-y-3 pb-4 text-center sm:text-left">
            <div className="flex items-center justify-between">
              <Logo size="md" />
              <Badge
                variant="outline"
                className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Dispensary Security
              </Badge>
            </div>
            <div>
              <CardTitle className="text-xl font-bold tracking-tight">
                Chemist Dispensary Sign In
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Enter authorized chemist credentials • Multi-threaded backup enabled
              </CardDescription>
            </div>
          </CardHeader>

          <form onSubmit={handleSubmit(onStandardSubmit)}>
            <CardContent className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-foreground/80">
                  Staff Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="staff@pharmacare.local"
                    autoComplete="email"
                    disabled={isExecutingThreads || isSubmitting}
                    className="pl-9 text-sm"
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-semibold text-foreground/80">
                    Password
                  </Label>
                  <a
                    href={ROUTES.RESET_PASSWORD}
                    className="text-xs font-medium text-teal-600 hover:text-teal-700 hover:underline dark:text-teal-400"
                  >
                    Forgot key?
                  </a>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter authorized password"
                    autoComplete="current-password"
                    disabled={isExecutingThreads || isSubmitting}
                    className="pl-9 pr-10 text-sm"
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

              {/* Quick Fill Demo Badges */}
              <div className="pt-1">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1.5">
                  Chemist Counter Accounts:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {DEFAULT_CHEMIST_PROFILES.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => {
                        setValue('email', p.email)
                        if (p.defaultPin) setValue('password', p.defaultPin)
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-teal-50 dark:hover:bg-teal-950/40 hover:border-teal-300 transition-colors"
                    >
                      <span>{p.avatarIcon || '💊'}</span>
                      <span>{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3 pt-2">
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-teal-800 to-teal-700 hover:from-teal-900 hover:to-teal-800 text-white font-medium shadow-teal-glow transition-all"
                disabled={isExecutingThreads || isSubmitting}
              >
                {isExecutingThreads || isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Executing 5 Security & Backup Threads...
                  </>
                ) : (
                  'Access Dispensary System (Multi-Thread)'
                )}
              </Button>

              <div className="flex items-center justify-between w-full text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  <span>Backup Enabled on Login</span>
                </div>
                <button
                  type="button"
                  onClick={handleOpenDiagnostics}
                  className="text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 font-mono text-[10.5px]"
                >
                  <Cpu className="h-3 w-3" />
                  <span>Thread Status</span>
                </button>
              </div>
            </CardFooter>
          </form>
        </Card>
      )}

      {/* Thread Diagnostics Dialog */}
      <Dialog open={showDiagnosticsDialog} onOpenChange={setShowDiagnosticsDialog}>
        <DialogContent className="max-w-md bg-slate-950 text-white border-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-bold text-teal-300">
              <Cpu className="h-4 w-4" />
              <span>Multi-Thread Topology & Pre-Flight Status</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Live status of the 5 concurrent worker threads wired into user login.
            </DialogDescription>
          </DialogHeader>

          {diagnosticsData ? (
            <div className="space-y-3 py-2 text-xs">
              <div className="rounded-lg bg-slate-900 p-3 border border-slate-800 space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Engine:</span>
                  <span className="font-mono text-teal-300">{diagnosticsData.engine}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Dispensary Status:</span>
                  <span className="font-mono text-emerald-400">{diagnosticsData.status}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Formulations Pre-Cached:</span>
                  <span className="font-mono text-teal-300">
                    {diagnosticsData.systemMetrics?.activeFormulations ?? 0}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Wired Worker Threads:
                </span>
                {diagnosticsData.configuredThreads?.map((th: any) => (
                  <div
                    key={th.id}
                    className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/60 p-2"
                  >
                    <div>
                      <p className="font-semibold text-slate-200 text-[11px]">{th.name}</p>
                      <p className="text-[10px] text-slate-400">{th.target}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-[9px] font-mono"
                    >
                      {th.state}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-6 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-teal-400" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
