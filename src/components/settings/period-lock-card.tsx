'use client'

import { useState, useEffect } from 'react'
import { Lock, Unlock, ShieldAlert, ShieldCheck, History, Calendar, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/lib/hooks/use-toast'
import { formatDateTime } from '@/lib/utils/date'

interface AuditEntry {
  id: string
  action: string
  createdAt: string
  user?: { name: string; email: string }
  newData?: { lockDate?: string; allowAdminBypass?: boolean }
}

export function PeriodLockCard() {
  const [lockDate, setLockDate] = useState<string>('')
  const [allowAdminBypass, setAllowAdminBypass] = useState<boolean>(true)
  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([])
  const toast = useToast()

  const fetchStatus = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/finance/period-lock')
      const data = await res.json()
      if (data.success && data.data) {
        setLockDate(data.data.lockDate || '')
        setAllowAdminBypass(Boolean(data.data.allowAdminBypass))
      }

      // Live fetch audit log history from PostgreSQL audit_logs table
      const auditRes = await fetch('/api/audit?entity=SystemSetting&search=accounting.lock_date&limit=5')
      const auditData = await auditRes.json()
      if (auditData.success && auditData.data) {
        setAuditLogs(auditData.data)
      }
    } catch {
      toast.error('Failed to load financial period status')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  const handleSave = async (newDate: string | null) => {
    setSaving(true)
    try {
      const res = await fetch('/api/finance/period-lock', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lockDate: newDate,
          allowAdminBypass,
        }),
      })

      const result = await res.json()
      if (result.success) {
        setLockDate(result.data.lockDate || '')
        setAllowAdminBypass(Boolean(result.data.allowAdminBypass))
        toast.success(result.message || 'Period lock configuration updated')
        fetchStatus()
      } else {
        toast.error(result.error?.message || 'Failed to update period lock')
      }
    } catch {
      toast.error('Network error updating period lock')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              Financial Period Locking &amp; Backdated Voucher Freeze
            </CardTitle>
            <CardDescription className="text-xs">
              Prevents backdated sales, purchases, or voucher entries prior to the locked date (Tally &amp; Marg ERP parity)
            </CardDescription>
          </div>
          <div>
            {lockDate ? (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1.5 py-1 px-2.5">
                <ShieldAlert className="h-3.5 w-3.5" />
                Vouchers Locked Prior to: {lockDate}
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1.5 py-1 px-2.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                Period Open (No Date Lock)
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg border border-border/50">
          <div className="space-y-2">
            <Label htmlFor="lockDateInput" className="text-xs font-semibold flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              Cutoff Lock Date (YYYY-MM-DD)
            </Label>
            <div className="flex gap-2">
              <Input
                id="lockDateInput"
                type="date"
                value={lockDate}
                onChange={(e) => setLockDate(e.target.value)}
                disabled={loading || saving}
                className="font-mono text-xs max-w-xs"
              />
              <Button
                type="button"
                onClick={() => handleSave(lockDate)}
                disabled={loading || saving || !lockDate}
                size="sm"
                className="gap-1 text-xs"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Enforce Lock
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Any sale, purchase, or receipt voucher dated strictly prior to this date will be rejected at the API level.
            </p>
          </div>

          <div className="space-y-3">
            <Label className="text-xs font-semibold">Security &amp; Override Permissions</Label>
            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="adminBypass"
                checked={allowAdminBypass}
                onChange={(e) => setAllowAdminBypass(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="adminBypass" className="text-xs font-normal cursor-pointer">
                Allow Administrators (Super Admin / Admin) to record backdated entries with audit trail
              </Label>
            </div>

            {lockDate && (
              <div className="pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleSave('')}
                  disabled={loading || saving}
                  className="gap-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 border-rose-200 dark:border-rose-900/40"
                >
                  <Unlock className="h-3.5 w-3.5" />
                  Release Period Lock (Unlock All Dates)
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Live Audit Log Section directly from PostgreSQL audit_logs */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <History className="h-3.5 w-3.5" />
            <span>Recent Period Lock Governance Activity (PostgreSQL Live Audit Log)</span>
          </div>

          {auditLogs.length > 0 ? (
            <div className="border border-border/60 rounded-md divide-y divide-border/40 text-xs overflow-hidden">
              {auditLogs.map((log) => {
                const newDataObj = typeof log.newData === 'string' ? (() => { try { return JSON.parse(log.newData) } catch { return null } })() : log.newData
                const displayLock = newDataObj?.lockDate ? `Locked prior to ${newDataObj.lockDate}` : 'Lock cleared (open)'
                return (
                  <div key={log.id} className="p-2.5 flex items-center justify-between hover:bg-muted/20">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono text-[10px] py-0 px-1.5">
                        {log.action}
                      </Badge>
                      <span className="font-medium text-foreground">
                        {displayLock}
                      </span>
                      <span className="text-muted-foreground text-[11px]">
                        by {log.user?.name || log.user?.email || 'System Administrator'}
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {formatDateTime(log.createdAt)}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="p-3 text-xs text-muted-foreground bg-muted/20 rounded-md text-center">
              No recent period lock changes recorded in audit logs.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
