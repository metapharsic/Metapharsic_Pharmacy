'use client'

import React, { useEffect, useState } from 'react'
import {
  Clock,
  Globe,
  KeyRound,
  Lock,
  Moon,
  RefreshCw,
  Save,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sun,
  UserCheck,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { PlatformIAMPolicy } from '@/lib/platform/iam-service'
import { TerritoryCode, getAllTerritories } from '@/lib/territory/territory-config'

export function IAMPolicyPanel() {
  const [policy, setPolicy] = useState<PlatformIAMPolicy | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const territories = getAllTerritories()

  const fetchPolicy = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/platform/iam')
      const json = await res.json()
      if (json.success && json.policy) {
        setPolicy(json.policy)
      } else {
        toast.error(json.error || 'Failed to load IAM policy')
      }
    } catch {
      toast.error('Network error loading IAM policy')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPolicy()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!policy) return
    setSaving(true)
    try {
      const res = await fetch('/api/platform/iam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy),
      })
      const json = await res.json()
      if (json.success && json.policy) {
        setPolicy(json.policy)
        toast.success(json.message || 'Sovereign IAM Security Rules updated successfully!')
      } else {
        toast.error(json.error || 'Failed to update IAM policy')
      }
    } catch {
      toast.error('Network error updating IAM policy')
    } finally {
      setSaving(false)
    }
  }

  const toggleTerritory = (code: TerritoryCode) => {
    if (!policy) return
    const current = policy.allowedTerritories || []
    const updated = current.includes(code)
      ? current.filter((c) => c !== code)
      : [...current, code]
    setPolicy({ ...policy, allowedTerritories: updated })
  }

  if (loading && !policy) {
    return (
      <div className="flex h-64 items-center justify-center space-x-2 text-muted-foreground">
        <RefreshCw className="h-5 w-5 animate-spin text-teal-600" />
        <span className="text-sm font-medium">Loading Platform IAM Security Governance Rules...</span>
      </div>
    )
  }

  if (!policy) return null

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-teal-600" />
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              IAM & Sovereign Geopolitical Security Policies
            </h2>
            <Badge variant="outline" className="border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300 font-mono text-[11px]">
              Active Multi-Territory Gate
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure sovereign boundaries, cross-border lockout gates, shift timing, Ramadan operating hours, and multi-tier RBAC clearance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchPolicy}
            disabled={loading || saving}
            className="h-8.5 text-xs gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Reset</span>
          </Button>

          <Button
            type="submit"
            size="sm"
            disabled={saving}
            className="h-8.5 text-xs gap-1.5 bg-gradient-to-r from-teal-800 to-teal-700 hover:from-teal-900 hover:to-teal-800 text-white font-medium shadow-teal-glow"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{saving ? 'Publishing Policy...' : 'Save & Publish IAM Rules'}</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. SOVEREIGN GEOFENCING & CROSS-BORDER GOVERNANCE */}
        <Card className="border-border/80 shadow-sm border-teal-500/30 bg-teal-500/[0.02]">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-teal-600" />
              <CardTitle className="text-sm font-bold">
                Sovereign Geofencing & Cross-Border Governance
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Enforce strict sovereign territory boundaries to comply with GCC, Maldives, and Indian health data sovereignty laws.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-foreground">Enforce Strict Sovereign Geofencing</div>
                <div className="text-[11px] text-muted-foreground">
                  Validates client IP and timezone against branch territory on every login.
                </div>
              </div>
              <Switch
                checked={policy.geoFencingEnforced}
                onCheckedChange={(checked) => setPolicy({ ...policy, geoFencingEnforced: checked })}
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <div>
                <div className="font-semibold text-foreground">Block Cross-Border Account Access</div>
                <div className="text-[11px] text-muted-foreground">
                  Rejects login if a staff account registered in one sovereign territory is accessed from outside.
                </div>
              </div>
              <Switch
                checked={policy.blockCrossBorderLogins}
                onCheckedChange={(checked) => setPolicy({ ...policy, blockCrossBorderLogins: checked })}
              />
            </div>

            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs font-semibold block">
                Permitted Sovereign Territories (Global Headquarters Gate):
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {territories.map((t) => {
                  const isChecked = (policy.allowedTerritories || []).includes(t.code)
                  return (
                    <button
                      key={t.code}
                      type="button"
                      onClick={() => toggleTerritory(t.code)}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-colors ${
                        isChecked
                          ? 'border-teal-500 bg-teal-500/10 text-teal-900 dark:text-teal-200 font-semibold'
                          : 'border-border/70 bg-card text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <span className="text-base">{t.flag}</span>
                      <div className="truncate">
                        <span className="block font-medium truncate">{t.nameEn.split(' ')[0]}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{t.currency.code} ({t.currency.decimals} Dec)</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. SHIFT TIMING, RAMADAN & PRAYER SCHEDULE */}
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-600" />
              <CardTitle className="text-sm font-bold">
                Shift Timing, Ramadan & Prayer Schedule Controls
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Manage operating shift hours, Ramadan night schedules, and automated prayer time pauses across GCC dispensary counters.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-foreground">Allow Dispensary Logins After-Hours</div>
                <div className="text-[11px] text-muted-foreground">
                  If disabled, counter staff cannot log in outside authorized shift hours.
                </div>
              </div>
              <Switch
                checked={policy.allowDispensaryAfterHours}
                onCheckedChange={(checked) => setPolicy({ ...policy, allowDispensaryAfterHours: checked })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t">
              <div className="space-y-1">
                <Label htmlFor="shift-start" className="text-xs font-semibold flex items-center gap-1">
                  <Sun className="h-3.5 w-3.5 text-amber-500" />
                  <span>Shift Opening Hour</span>
                </Label>
                <Input
                  id="shift-start"
                  type="number"
                  min={0}
                  max={23}
                  value={policy.shiftStartHour || 7}
                  onChange={(e) => setPolicy({ ...policy, shiftStartHour: parseInt(e.target.value, 10) || 7 })}
                  className="h-8 text-xs font-mono"
                />
                <span className="text-[10px] text-muted-foreground">Default: 07:00 AM (Zone Time)</span>
              </div>

              <div className="space-y-1">
                <Label htmlFor="shift-end" className="text-xs font-semibold flex items-center gap-1">
                  <Moon className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Shift Closing Hour</span>
                </Label>
                <Input
                  id="shift-end"
                  type="number"
                  min={1}
                  max={24}
                  value={policy.shiftEndHour || 24}
                  onChange={(e) => setPolicy({ ...policy, shiftEndHour: parseInt(e.target.value, 10) || 24 })}
                  className="h-8 text-xs font-mono"
                />
                <span className="text-[10px] text-muted-foreground">Default: 00:00 Midnight</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <div>
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <span>Ramadan Operating Hours Override</span>
                  <Badge variant="outline" className="text-[9px] font-mono border-amber-500/40 text-amber-700 bg-amber-500/10">
                    GCC Extended
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Extends dispensary counter access until 03:00 AM for night dispensary operations.
                </div>
              </div>
              <Switch
                checked={policy.enableRamadanHours || false}
                onCheckedChange={(checked) => setPolicy({ ...policy, enableRamadanHours: checked })}
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <div>
                <div className="font-semibold text-foreground">Prayer Time Session Pause</div>
                <div className="text-[11px] text-muted-foreground">
                  Prevents session timeout during national prayer calls in Saudi Arabia and Gulf regions.
                </div>
              </div>
              <Switch
                checked={policy.enablePrayerTimePauses || false}
                onCheckedChange={(checked) => setPolicy({ ...policy, enablePrayerTimePauses: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* 3. PASSWORD COMPLEXITY & CREDENTIAL SECURITY */}
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-amber-600" />
              <CardTitle className="text-sm font-bold">Password Complexity & Expiry Rules</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Enforce cryptographic security standards across chemist store accounts.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="min-len" className="text-xs font-semibold">Minimum Password Length</Label>
                <Input
                  id="min-len"
                  type="number"
                  min={6}
                  max={32}
                  value={policy.minPasswordLength}
                  onChange={(e) => setPolicy({ ...policy, minPasswordLength: parseInt(e.target.value, 10) || 8 })}
                  className="h-8 text-xs font-mono"
                />
                <span className="text-[10px] text-muted-foreground">Recommended: 8+ characters</span>
              </div>

              <div className="space-y-1">
                <Label htmlFor="expiry-days" className="text-xs font-semibold">Password Expiry (Days)</Label>
                <Input
                  id="expiry-days"
                  type="number"
                  min={30}
                  max={365}
                  value={policy.passwordExpiryDays}
                  onChange={(e) => setPolicy({ ...policy, passwordExpiryDays: parseInt(e.target.value, 10) || 90 })}
                  className="h-8 text-xs font-mono"
                />
                <span className="text-[10px] text-muted-foreground">Enforces periodic credential rotation</span>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-foreground">Require Uppercase Letter (A-Z)</div>
                  <div className="text-[11px] text-muted-foreground">At least one capital letter</div>
                </div>
                <Switch
                  checked={policy.requireUppercase}
                  onCheckedChange={(checked) => setPolicy({ ...policy, requireUppercase: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-foreground">Require Numeric Digit (0-9)</div>
                  <div className="text-[11px] text-muted-foreground">At least one numeral</div>
                </div>
                <Switch
                  checked={policy.requireNumber}
                  onCheckedChange={(checked) => setPolicy({ ...policy, requireNumber: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-foreground">Require Special Character (!@#$)</div>
                  <div className="text-[11px] text-muted-foreground">At least one non-alphanumeric character</div>
                </div>
                <Switch
                  checked={policy.requireSpecialChar}
                  onCheckedChange={(checked) => setPolicy({ ...policy, requireSpecialChar: checked })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4. BRUTE-FORCE LOCKOUT & CONCURRENT SESSIONS */}
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-rose-600" />
              <CardTitle className="text-sm font-bold">Brute-Force Lockout & Session Limits</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Automatically locks compromised accounts and controls concurrent counter POS logins.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="max-attempts" className="text-xs font-semibold">Max Failed Login Attempts</Label>
                <Input
                  id="max-attempts"
                  type="number"
                  min={2}
                  max={10}
                  value={policy.maxFailedAttempts}
                  onChange={(e) => setPolicy({ ...policy, maxFailedAttempts: parseInt(e.target.value, 10) || 5 })}
                  className="h-8 text-xs font-mono"
                />
                <span className="text-[10px] text-muted-foreground">Locks user on reaching limit</span>
              </div>

              <div className="space-y-1">
                <Label htmlFor="lock-mins" className="text-xs font-semibold">Lockout Duration (Minutes)</Label>
                <Input
                  id="lock-mins"
                  type="number"
                  min={1}
                  max={1440}
                  value={policy.lockoutDurationMinutes}
                  onChange={(e) => setPolicy({ ...policy, lockoutDurationMinutes: parseInt(e.target.value, 10) || 15 })}
                  className="h-8 text-xs font-mono"
                />
                <span className="text-[10px] text-muted-foreground">Auto-unlocks after timeout</span>
              </div>
            </div>

            <div className="space-y-1 pt-2 border-t">
              <Label htmlFor="session-timeout" className="text-xs font-semibold">Session Idle Timeout (Minutes)</Label>
              <Input
                id="session-timeout"
                type="number"
                min={5}
                max={1440}
                value={policy.sessionInactivityTimeoutMinutes}
                onChange={(e) => setPolicy({ ...policy, sessionInactivityTimeoutMinutes: parseInt(e.target.value, 10) || 60 })}
                className="h-8 text-xs font-mono w-1/2"
              />
              <span className="text-[10px] text-muted-foreground">Inactivity duration before requiring re-authentication</span>
            </div>

            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-foreground">Allow Concurrent Sessions</div>
                  <div className="text-[11px] text-muted-foreground">Permit multiple POS counters to log into the same user account</div>
                </div>
                <Switch
                  checked={policy.allowConcurrentLogins}
                  onCheckedChange={(checked) => setPolicy({ ...policy, allowConcurrentLogins: checked })}
                />
              </div>
            </div>

            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-foreground">Enforce MFA for SuperAdmin Role</div>
                  <div className="text-[11px] text-muted-foreground">Mandates TOTP code verification for platform control plane</div>
                </div>
                <Switch
                  checked={policy.enforceMfaForSuperAdmin}
                  onCheckedChange={(checked) => setPolicy({ ...policy, enforceMfaForSuperAdmin: checked })}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </form>
  )
}
