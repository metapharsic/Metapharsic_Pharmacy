'use client'

import { Bell, Clock, Cpu, Database, Globe, Keyboard, Monitor, Shield, ShoppingCart, Store, Volume2, VolumeX } from 'lucide-react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/constants/routes'
import { isSoundMuted, toggleSound, playClickSound } from '@/lib/sound/sound-effects'
import { useShortcuts } from '@/components/shared/keyboard-shortcuts-provider'
import { useDatabaseBackup } from '@/components/shared/database-backup-provider'
import { LanguageToggle } from '@/components/shared/language-toggle'
import { useI18n } from '@/lib/i18n/i18n-context'
import { cn } from '@/lib/utils/cn'

export function Header() {
  const { data: session } = useSession()
  const { openShortcuts } = useShortcuts()
  const { openBackup } = useDatabaseBackup()
  const { t, locale, dir } = useI18n()
  const [timeStr, setTimeStr] = useState<string>('')
  const [dateStr, setDateStr] = useState<string>('')

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setTimeStr(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      )
      setDateStr(
        now.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
      )
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  const userRoles = session?.user?.roles ?? []
  const isOwner = userRoles.includes('owner')
  const roleLabel = isOwner
    ? 'Admin'
    : userRoles.includes('manager')
      ? 'Store Manager'
      : userRoles.includes('pharmacist')
        ? 'Pharmacist'
        : userRoles.includes('cashier')
          ? 'Cashier'
          : (userRoles[0] ?? 'Staff')

  const [soundMuted, setSoundMutedState] = useState<boolean>(false)

  useEffect(() => {
    setSoundMutedState(isSoundMuted())
    const handleToggle = (e: Event) => {
      const customEvent = e as CustomEvent<{ muted: boolean }>
      setSoundMutedState(customEvent.detail.muted)
    }
    window.addEventListener('mpharm:sound-toggle', handleToggle)
    return () => window.removeEventListener('mpharm:sound-toggle', handleToggle)
  }, [])

  const handleSoundToggle = () => {
    const newMuted = toggleSound()
    setSoundMutedState(newMuted)
    if (!newMuted) {
      playClickSound()
    }
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border/70 bg-card px-6 select-none shadow-subtle">
      {/* Left Station Metadata */}
      <div className="flex items-center gap-3">
        {session?.user?.isSuperAdmin ? (
          <>
            {/* AWS Root Control Plane Pill */}
            <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-800 dark:text-amber-300">
              <Shield className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="font-bold tracking-tight">AWS ROOT CONTROL PLANE</span>
              <Badge variant="outline" className="font-mono text-[9px] px-1 py-0 uppercase bg-background/80 border-amber-500/40 text-amber-700 dark:text-amber-300">
                GLOBAL
              </Badge>
            </div>

            <div className="hidden lg:flex items-center gap-2 rounded-lg border border-border/70 bg-muted/40 px-2.5 py-1 text-xs">
              <Globe className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              <span className="font-semibold text-foreground/90">ap-south-1</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] text-muted-foreground">5 Parallel Threads</span>
            </div>

            <div className="hidden sm:flex items-center gap-2" suppressHydrationWarning>
              <Badge variant="outline" className="text-[11px] font-semibold border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300" suppressHydrationWarning>
                Root Admin
              </Badge>
              <span className="text-xs text-muted-foreground" suppressHydrationWarning>
                Operator: <span className="font-medium text-foreground" suppressHydrationWarning>{session?.user?.name ?? 'SuperAdmin'}</span>
              </span>
            </div>
          </>
        ) : (
          <>
            {/* Active Chemist Shop Tenant Pill */}
            {session?.user?.organization && (
              <div className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs">
                <Store className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="font-semibold text-foreground truncate max-w-[150px] sm:max-w-[200px]">
                  {session.user.organization.name}
                </span>
                <Badge variant="outline" className="font-mono text-[9px] px-1 py-0 uppercase bg-background/80">
                  {session.user.organization.code}
                </Badge>
              </div>
            )}

            <div className="hidden lg:flex items-center gap-2 rounded-lg border border-border/70 bg-muted/40 px-2.5 py-1 text-xs">
              <Monitor className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              <span className="font-semibold text-foreground/90">Terminal 01</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] text-muted-foreground">Dispensary</span>
            </div>

            <div className="hidden sm:flex items-center gap-2" suppressHydrationWarning>
              <Badge variant="teal" className="text-[11px] font-semibold" suppressHydrationWarning>
                {roleLabel}
              </Badge>
              <span className="text-xs text-muted-foreground" suppressHydrationWarning>
                Operator: <span className="font-medium text-foreground" suppressHydrationWarning>{session?.user?.name ?? 'Staff'}</span>
              </span>
            </div>
          </>
        )}
      </div>

      {/* Right Actions & Live Clock */}
      <div className="flex items-center gap-3">
        {/* Real-time Dispensary Clock */}
        <div className="hidden md:flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-1 text-xs tabular-nums text-muted-foreground" suppressHydrationWarning>
          <Clock className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
          <span className="font-semibold text-foreground" suppressHydrationWarning>{timeStr}</span>
          <span className="text-border">|</span>
          <span className="text-[11px]" suppressHydrationWarning>{dateStr}</span>
        </div>

        {/* Action Button: Multi-Thread Telemetry for SuperAdmin vs POS Fast-Key for Normal Dispensaries */}
        {session?.user?.isSuperAdmin ? (
          <Button
            asChild
            size="sm"
            className="gap-2 bg-gradient-to-r from-teal-800 to-teal-700 hover:from-teal-900 hover:to-teal-800 text-white font-medium shadow-teal-glow text-xs"
          >
            <Link href="/platform?tab=monitoring">
              <Cpu className="h-3.5 w-3.5" />
              <span>Telemetry & Threads</span>
            </Link>
          </Button>
        ) : (
          <Button
            asChild
            size="sm"
            className="gap-2 bg-gradient-to-r from-teal-800 to-teal-700 hover:from-teal-900 hover:to-teal-800 text-white font-medium shadow-teal-glow text-xs"
          >
            <Link href={ROUTES.POS}>
              <ShoppingCart className="h-3.5 w-3.5" />
              <span>Open POS / Billing</span>
              <kbd className="hidden sm:inline-block rounded bg-teal-950/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-teal-200">
                F2
              </kbd>
            </Link>
          </Button>
        )}

        {/* Chemist Fast Keyboard Shortcuts Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={openShortcuts}
          className="gap-1.5 text-xs font-semibold h-8.5 rounded-lg border-border/70 hover:border-teal-500/50 hover:bg-teal-500/10 text-slate-700 dark:text-slate-300"
          title="Chemist Fast Keyboard Shortcuts Cheat Sheet (Press F1 anytime)"
        >
          <Keyboard className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
          <span className="hidden sm:inline">{t('nav.shortcuts', 'Shortcuts')}</span>
          <kbd className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-mono font-bold text-muted-foreground border">
            F1
          </kbd>
        </Button>

        {/* Database Excel Backup Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={openBackup}
          className="gap-1.5 text-xs font-semibold h-8.5 rounded-lg border-border/70 hover:border-teal-500/50 hover:bg-teal-500/10 text-slate-700 dark:text-slate-300"
          title="Download Multi-Thread Database Backup in Excel (.xlsx) or Send to Email"
        >
          <Database className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="hidden sm:inline">{t('nav.backup', 'Backup')}</span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </Button>

        {/* Dual-Script Sovereign Territory & Language Selector */}
        <LanguageToggle />

        {/* Procedural Audio Feedback Mute / Unmute Toggle */}
        <Button
          variant="outline"
          size="icon"
          onClick={handleSoundToggle}
          title={soundMuted ? 'Audio Feedback Muted (Click to enable sounds)' : 'Audio Feedback Active (Scanner & chimes enabled)'}
          aria-label={soundMuted ? 'Unmute sounds' : 'Mute sounds'}
          className={cn(
            'h-8.5 w-8.5 rounded-lg border-border/70 transition-colors',
            soundMuted ? 'text-muted-foreground' : 'text-teal-600 dark:text-teal-400 bg-teal-500/10 border-teal-500/30'
          )}
        >
          {soundMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>

        {/* Notification Bell */}
        <Button variant="outline" size="icon" className="relative h-8.5 w-8.5 rounded-lg border-border/70">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-teal-600 text-[10px] font-bold text-white shadow-xs">
            3
          </span>
        </Button>
      </div>
    </header>
  )
}
