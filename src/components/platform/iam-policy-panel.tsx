'use client'

import React, { useEffect, useState } from 'react'
import {
  Clock,
  Globe,
  KeyRound,
  Lock,
  RefreshCw,
  Save,
  Shield,
  ShieldAlert,
  ShieldCheck,
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

export function IAMPolicyPanel() {
  const [policy, setPolicy] = useState<PlatformIAMPolicy | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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
        toast.success(json.message || 'IAM Security Rules updated successfully!')
      } else {
        toast.error(json.error || 'Failed to update IAM policy')
      }
    } catch {
      toast.error('Network error updating IAM policy')
    } finally {
      setSaving(false)
    }
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
            <h2 className="text-lg font-bold tracking-tight text-foreground">IAM & Platform Security Policy Rules</h2>
            <Badge variant="outline" className="border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300 font-mono text-[11px]">
              Active Enforcement
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure authentication rules, lockout thresholds, privilege escalation guards, password complexity, and after-hours shift controls.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchPolicy}
            disabled={saving}
            className="h-8 gap-1.5 text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Reload</span>
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="h-8 gap-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{saving ? 'Applying IAM Rules...' : 'Save & Enforce Rules'}</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. PASSWORD COMPLEXITY & EXPIRY RULES */}
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-teal-600" />
              <CardTitle className="text-sm font-bold">Password Complexity & Expiration</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Enforce cryptographic requirements for all tenant administrators and dispensary counters.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="min-pass" className="text-xs font-semibold">Minimum Password Length</Label>
                <Input
                  id="min-pass"
                  type="number"
                  min={6}
                  max={32}
                  value={policy.minPasswordLength}
                  onChange={(e) => setPolicy({ ...policy, minPasswordLength: parseInt(e.target.value, 10) || 8 })}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="pass-expiry" className="text-xs font-semibold">Password Expiry (Days)</Label>
                <Input
                  id="pass-expiry"
                  type="number"
                  min={0}
                  max={365}
                  value={policy.passwordExpiryDays}
                  onChange={(e) => setPolicy({ ...policy, passwordExpiryDays: parseInt(e.target.value, 10) || 0 })}
                  className="h-8 text-xs font-mono"
                />
                <span className="text-[10px] text-muted-foreground">0 = never expires</span>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-foreground">Require Uppercase Letter (A-Z)</div>
                  <div className="text-[11px] text-muted-foreground">At least one uppercase character</div>
                </div>
                <Switch
                  checked={policy.requireUppercase}
                  onCheckedChange={(checked) => setPolicy({ ...policy, requireUppercase: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-foreground">Require Numeric Digit (0-9)</div>
                  <div className="text-[11px] text-muted-foreground">At least one numerical digit</div>
                </div>
                <Switch
                  checked={policy.requireNumber}
                  onCheckedChange={(checked) => setPolicy({ ...policy, requireNumber: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-foreground">Require Special Symbol (!@#$...)</div>
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

        {/* 2. BRUTE-FORCE LOCKOUT & SESSIONS */}
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-rose-600" />
              <CardTitle className="text-sm font-bold">Brute-Force & Account Lockout Thresholds</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Automatically locks compromised accounts after threshold failures to prevent dictionary attacks.
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
          </CardContent>
        </Card>

        {/* 3. MULTI-FACTOR AUTH & PRIVILEGED ACCESS */}
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <CardTitle className="text-sm font-bold">Multi-Factor Authentication (MFA) Rules</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Enforce mandatory two-step verification for high-privilege executive identities.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-foreground">Enforce MFA for SuperAdmin Role</div>
                <div className="text-[11px] text-muted-foreground">Mandates TOTP authenticator app for platform control plane</div>
              </div>
              <Switch
                checked={policy.enforceMfaForSuperAdmin}
                onCheckedChange={(checked) => setPolicy({ ...policy, enforceMfaForSuperAdmin: checked })}
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <div>
                <div className="font-semibold text-foreground">Enforce MFA for Chemist Store Owners</div>
                <div className="text-[11px] text-muted-foreground">Requires OTP code verification for tenant owners</div>
              </div>
              <Switch
                checked={policy.enforceMfaForStoreOwners}
                onCheckedChange={(checked) => setPolicy({ ...policy, enforceMfaForStoreOwners: checked })}
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <div>
                <div className="font-semibold text-foreground">Dispensary Subnet IP Whitelisting</div>
                <div className="text-[11px] text-muted-foreground">Restrict platform operations to verified corporate subnets</div>
              </div>
              <Switch
                checked={policy.ipWhitelistEnabled}
                onCheckedChange={(checked) => setPolicy({ ...policy, ipWhitelistEnabled: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* 4. SHIFT TIMING & AFTER-HOURS GOVERNANCE */}
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-600" />
              <CardTitle className="text-sm font-bold">Shift Timing & After-Hours Governance</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Prevent unauthorized nighttime access to billing, inventory, and narcotic drug registers.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-foreground">Allow Dispensary Logins After-Hours</div>
                <div className="text-[11px] text-muted-foreground">
                  If disabled, cashier/pharmacist logins outside 06:00 – 23:00 are rejected by IAM.
                </div>
              </div>
              <Switch
                checked={policy.allowDispensaryAfterHours}
                onCheckedChange={(checked) => setPolicy({ ...policy, allowDispensaryAfterHours: checked })}
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <div>
                <div className="font-semibold text-foreground">Enforce Strict Geo-Fencing</div>
                <div className="text-[11px] text-muted-foreground">
                  Reject sessions originating from unregistered Geo-Political zones.
                </div>
              </div>
              <Switch
                checked={policy.geoFencingEnforced}
                onCheckedChange={(checked) => setPolicy({ ...policy, geoFencingEnforced: checked })}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </form>
  )
}
