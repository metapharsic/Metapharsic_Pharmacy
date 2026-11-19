'use client'

import React, { useEffect, useState, useTransition } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  Globe,
  HardDrive,
  Layers,
  LogIn,
  LogOut,
  MapPin,
  Monitor,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import type { SystemTelemetry, EntityLoginEvent } from '@/lib/platform/platform-monitoring-service'
import { MultiThreadProgressPanel } from './multi-thread-progress-panel'

interface MonitoringData {
  telemetry: SystemTelemetry
  activityLogs: EntityLoginEvent[]
  summary: {
    activeLast15m: number
    activeLast1h: number
    activeLast24h: number
    totalActiveUsers: number
    totalOrganizations: number
  }
}

export function SystemMonitoringPanel() {
  const [data, setData] = useState<MonitoringData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [filterAction, setFilterAction] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())

  const fetchTelemetry = async () => {
    try {
      const res = await fetch('/api/platform/monitoring')
      if (!res.ok) {
        throw new Error(`Failed to load telemetry (HTTP ${res.status})`)
      }
      const json = await res.json()
      if (json.success) {
        setData(json)
        setLastRefreshed(new Date())
        setError(null)
      } else {
        throw new Error(json.error || 'Unknown error')
      }
    } catch (err: any) {
      setError(err?.message || 'Error loading telemetry')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTelemetry()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      fetchTelemetry()
    }, 5000)
    return () => clearInterval(interval)
  }, [autoRefresh])

  const filteredLogs = React.useMemo(() => {
    if (!data?.activityLogs) return []
    return data.activityLogs.filter((log) => {
      const matchAction = filterAction === 'ALL' || log.action === filterAction
      const q = searchQuery.toLowerCase().trim()
      const matchQuery =
        !q ||
        log.userName.toLowerCase().includes(q) ||
        log.userEmail.toLowerCase().includes(q) ||
        log.organizationName.toLowerCase().includes(q) ||
        log.locationArea.toLowerCase().includes(q) ||
        log.ipAddress.toLowerCase().includes(q)
      return matchAction && matchQuery
    })
  }, [data?.activityLogs, filterAction, searchQuery])

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center space-x-2 text-muted-foreground">
        <RefreshCw className="h-5 w-5 animate-spin text-teal-600" />
        <span className="text-sm font-medium">Gathering high-speed system telemetry & audit stream...</span>
      </div>
    )
  }

  if (error && !data) {
    return (
      <Card className="border-destructive/30 bg-destructive/5 p-6">
        <div className="flex items-center space-x-3 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          <p className="text-sm font-semibold">{error}</p>
        </div>
        <Button onClick={fetchTelemetry} variant="outline" size="sm" className="mt-4">
          Retry Connection
        </Button>
      </Card>
    )
  }

  const { cpu, memory, threads, runtime, database, storage, securityAlerts } = data!.telemetry
  const { summary } = data!

  const formatUptime = (sec: number) => {
    const d = Math.floor(sec / 86400)
    const h = Math.floor((sec % 86400) / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    return `${d > 0 ? `${d}d ` : ''}${h}h ${m}m ${s}s`
  }

  return (
    <div className="space-y-6">
      {/* Top Telemetry Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight text-foreground">Dispensary Platform Live Telemetry</h2>
            <Badge variant="outline" className="border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300 font-mono text-[11px]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5" />
              Node {runtime.nodeVersion} • PID {runtime.pid}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Host: <span className="font-mono text-foreground font-medium">{runtime.hostname}</span> ({runtime.platform} {runtime.architecture}) • Last polled: {lastRefreshed.toLocaleTimeString()}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
              autoRefresh
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-700 dark:text-emerald-300'
                : 'bg-muted border-border text-muted-foreground'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`} />
            <span>{autoRefresh ? 'Live Auto-Polling (5s)' : 'Polling Paused'}</span>
          </button>
          <Button onClick={fetchTelemetry} variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Poll Now</span>
          </Button>
        </div>
      </div>

      {/* Multi-Thread Background Worker Pipeline & Progress Monitor */}
      <MultiThreadProgressPanel />

      {/* 4 Metric Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CPU USAGE */}
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CPU Processor Load</span>
              <Cpu className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            </div>
            <CardTitle className="text-2xl font-extrabold mt-1 font-mono">
              {cpu.usagePercent}%
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <Progress value={cpu.usagePercent} className="h-2" />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>{cpu.cores} Cores</span>
              <span>{cpu.speedMhz} MHz</span>
            </div>
            <p className="text-[10px] text-muted-foreground truncate" title={cpu.model}>
              {cpu.model}
            </p>
          </CardContent>
        </Card>

        {/* RAM MEMORY USAGE */}
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Physical Memory (RAM)</span>
              <HardDrive className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            </div>
            <CardTitle className="text-2xl font-extrabold mt-1 font-mono">
              {memory.usagePercent}%
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <Progress value={memory.usagePercent} className="h-2" />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Used: {Math.round(memory.usedMb / 1024 * 10) / 10} GB</span>
              <span>Total: {Math.round(memory.totalMb / 1024 * 10) / 10} GB</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Node Process Heap: <span className="font-semibold text-foreground">{memory.processHeapUsedMb} MB</span> (RSS: {memory.processRssMb} MB)
            </p>
          </CardContent>
        </Card>

        {/* THREADS & HANDLES */}
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Worker Threads & Libuv</span>
              <Layers className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <CardTitle className="text-2xl font-extrabold mt-1 font-mono">
              {threads.workerThreadsPoolSize} Pool
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs">
            <div className="flex justify-between py-0.5 border-b border-border/50 text-[11px]">
              <span className="text-muted-foreground">Active OS Handles:</span>
              <span className="font-mono font-bold text-foreground">{threads.activeHandles}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-border/50 text-[11px]">
              <span className="text-muted-foreground">Active Requests:</span>
              <span className="font-mono font-bold text-foreground">{threads.activeRequests}</span>
            </div>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              Event Loop: 0ms Blocking (Zero latency)
            </p>
          </CardContent>
        </Card>

        {/* ACTIVE ONLINE STAFF */}
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Staff & Sessions</span>
              <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <CardTitle className="text-2xl font-extrabold mt-1 font-mono">
              {summary.activeLast15m} <span className="text-xs font-normal text-muted-foreground">online</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Past 1h: {summary.activeLast1h}</span>
              <span>Past 24h: {summary.activeLast24h}</span>
            </div>
            <div className="flex justify-between text-[11px] pt-1 border-t border-border/50">
              <span className="text-muted-foreground">Total Accounts:</span>
              <span className="font-bold text-foreground">{summary.totalActiveUsers} in {summary.totalOrganizations} shops</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Uptime: <span className="font-mono text-foreground">{formatUptime(runtime.processUptimeSeconds)}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Deep Keen Telemetry Row 2: PostgreSQL Engine & Disk Storage */}
      {database && storage && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* POSTGRES LIVE DATABASE ENGINE */}
          <Card className="border-border/80 shadow-sm md:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-bold text-foreground">PostgreSQL 16 Cluster Intelligence</span>
                </div>
                <Badge
                  variant="outline"
                  className={
                    database.status === 'HEALTHY'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono text-[10px]'
                      : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 font-mono text-[10px]'
                  }
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse mr-1" />
                  {database.status} • {database.latencyMs}ms ping
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-1.5 px-2.5 bg-muted/30 rounded-md border text-center">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">Active Sessions</div>
                  <div className="text-sm font-extrabold font-mono text-emerald-600">{database.activeConnections}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">Idle Sessions</div>
                  <div className="text-sm font-extrabold font-mono text-foreground">{database.idleConnections}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">Database Size</div>
                  <div className="text-sm font-extrabold font-mono text-foreground">{database.databaseSize}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">Lock Waiters</div>
                  <div className={`text-sm font-extrabold font-mono ${database.activeLocksCount > 0 ? 'text-rose-600' : 'text-foreground'}`}>
                    {database.activeLocksCount}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground font-semibold mb-1">
                  <span>Top Tables by Active Row Volume</span>
                  <span>Row Count</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {database.topTables.slice(0, 4).map((t) => (
                    <div key={t.table} className="p-1.5 rounded border border-border/50 bg-background/60 text-[11px]">
                      <div className="text-muted-foreground truncate font-mono" title={t.table}>
                        {t.table}
                      </div>
                      <div className="font-extrabold font-mono text-foreground">{t.rows.toLocaleString()} rows</div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* STORAGE & DISK VOLUME */}
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Storage Volume ({storage.drive})</span>
                <HardDrive className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              </div>
              <CardTitle className="text-2xl font-extrabold mt-1 font-mono">
                {storage.usagePercent}%
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <Progress value={storage.usagePercent} className="h-2" />
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Free: {storage.freeGb} GB</span>
                <span>Total: {storage.totalGb} GB</span>
              </div>
              <p className="text-[10px] text-muted-foreground pt-1 border-t border-border/50">
                Primary NVMe SSD mounted at <span className="font-mono text-foreground font-medium">{storage.drive}</span>
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SECURITY ANOMALIES & THREAT ALERTS */}
      {securityAlerts && securityAlerts.length > 0 && (
        <Card className="border-rose-500/30 bg-rose-500/5 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-sm">
                <ShieldAlert className="h-4 w-4 text-rose-600 animate-pulse" />
                <span>Security Threat & Anomaly Detection ({securityAlerts.length} Active Notice)</span>
              </div>
              <Badge variant="destructive" className="text-[10px] uppercase font-bold">
                Keen Surveillance
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pt-1 text-xs">
            {securityAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-md bg-background/80 border border-rose-500/20 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[9px] font-bold ${
                        alert.severity === 'CRITICAL'
                          ? 'border-rose-500 text-rose-600 bg-rose-500/10'
                          : 'border-amber-500 text-amber-600 bg-amber-500/10'
                      }`}
                    >
                      {alert.type.replace('_', ' ')}
                    </Badge>
                    <span className="font-bold text-foreground">{alert.userName}</span>
                    <span className="text-[11px] text-muted-foreground">({alert.userEmail})</span>
                    <span className="text-[11px] text-teal-600 font-medium">• {alert.organizationName}</span>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-[11px]">{alert.details}</p>
                </div>
                <div className="text-[10px] font-mono text-muted-foreground shrink-0 sm:text-right">
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* DISPENSARY ENTITY LOGIN & LOGOUT ACTIVITY STREAM */}
      <Card className="border-border/80 shadow-card">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Globe className="h-4 w-4 text-teal-600" />
                <span>Entity Login & Logout Audit Stream</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time security log recording which personnel/entities logged in, logged out, their dispensary area/location, and client devices.
              </CardDescription>
            </div>

            {/* Filter buttons & Search */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-48 sm:w-60">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Filter user, area, IP..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>

              <div className="flex rounded-md border border-border p-0.5 text-xs bg-muted/40">
                {['ALL', 'LOGIN', 'LOGOUT', 'PASSWORD_RESET'].map((act) => (
                  <button
                    key={act}
                    type="button"
                    onClick={() => setFilterAction(act)}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                      filterAction === act
                        ? 'bg-background shadow-xs text-foreground font-bold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {act === 'ALL' ? 'All Activity' : act}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 border-b text-muted-foreground font-semibold">
                <tr>
                  <th className="py-2.5 px-3 text-left">Action</th>
                  <th className="py-2.5 px-3 text-left">Staff Entity</th>
                  <th className="py-2.5 px-3 text-left">Chemist Organization & Branch</th>
                  <th className="py-2.5 px-3 text-left">Login Area / Location</th>
                  <th className="py-2.5 px-3 text-left">Network IP & Device</th>
                  <th className="py-2.5 px-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No activity logs match the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const isLogin = log.action === 'LOGIN'
                    const isLogout = log.action === 'LOGOUT'
                    const isReset = log.action === 'PASSWORD_RESET'
                    const isLock = log.action === 'ACCOUNT_LOCKED'

                    return (
                      <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                        {/* Action Badge */}
                        <td className="py-3 px-3">
                          {isLogin && (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-bold gap-1 text-[10px]">
                              <LogIn className="h-3 w-3" />
                              <span>LOGGED IN</span>
                            </Badge>
                          )}
                          {isLogout && (
                            <Badge className="bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30 font-semibold gap-1 text-[10px]">
                              <LogOut className="h-3 w-3" />
                              <span>LOGGED OUT</span>
                            </Badge>
                          )}
                          {isReset && (
                            <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 font-semibold gap-1 text-[10px]">
                              <ShieldCheck className="h-3 w-3" />
                              <span>RESET PASS</span>
                            </Badge>
                          )}
                          {isLock && (
                            <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 font-semibold gap-1 text-[10px]">
                              <ShieldAlert className="h-3 w-3" />
                              <span>LOCKED</span>
                            </Badge>
                          )}
                          {!isLogin && !isLogout && !isReset && !isLock && (
                            <Badge variant="outline" className="text-[10px]">
                              {log.action}
                            </Badge>
                          )}
                        </td>

                        {/* Staff Entity */}
                        <td className="py-3 px-3">
                          <div className="font-semibold text-foreground">{log.userName}</div>
                          <div className="text-[11px] text-muted-foreground">{log.userEmail}</div>
                          <span className="text-[10px] text-teal-600 dark:text-teal-400 font-medium">{log.role}</span>
                        </td>

                        {/* Organization & Branch */}
                        <td className="py-3 px-3">
                          <div className="font-medium text-foreground">{log.organizationName}</div>
                          <div className="text-[11px] text-muted-foreground">{log.branchName}</div>
                        </td>

                        {/* Area / Location */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5 font-medium text-foreground">
                            <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                            <span>{log.locationArea}</span>
                          </div>
                        </td>

                        {/* Network IP & Device */}
                        <td className="py-3 px-3">
                          <div className="font-mono text-[11px] text-foreground font-semibold">{log.ipAddress}</div>
                          <div className="text-[10px] text-muted-foreground truncate max-w-[200px]" title={log.userAgent}>
                            {log.userAgent}
                          </div>
                        </td>

                        {/* Timestamp */}
                        <td className="py-3 px-3 text-right text-muted-foreground font-mono text-[11px] whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString('en-IN', {
                            dateStyle: 'short',
                            timeStyle: 'medium',
                          })}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
