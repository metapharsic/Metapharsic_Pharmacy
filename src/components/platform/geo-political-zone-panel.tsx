'use client'

import React, { useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Building2,
  ChevronDown,
  ChevronRight,
  Compass,
  Globe,
  HardDrive,
  Layers,
  LogIn,
  MapPin,
  Monitor,
  RefreshCw,
  Search,
  Server,
  Shield,
  ShieldCheck,
  Store,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { GeoPoliticalZoneData, GeoZoneName } from '@/lib/platform/geo-zones'

export function GeoPoliticalZonePanel() {
  const [zones, setZones] = useState<GeoPoliticalZoneData[]>([])
  const [totalLogins, setTotalLogins] = useState(0)
  const [activeSessions, setActiveSessions] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedZone, setSelectedZone] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedZone, setExpandedZone] = useState<string | null>('South Zone')

  const fetchGeoMetrics = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/platform/geo-zones')
      const json = await res.json()
      if (json.success) {
        setZones(json.zones || [])
        setTotalLogins(json.totalLoginsRecorded || 0)
        setActiveSessions(json.activeSessionsTotal || 0)
      } else {
        toast.error(json.error || 'Failed to fetch geo zone telemetry')
      }
    } catch {
      toast.error('Network error loading geo-political zones')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGeoMetrics()
  }, [])

  const toggleExpand = (zoneName: string) => {
    setExpandedZone(expandedZone === zoneName ? null : zoneName)
  }

  const filteredZones = zones.filter((z) => {
    if (selectedZone !== 'ALL' && z.zone !== selectedZone) return false
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      z.zone.toLowerCase().includes(q) ||
      z.states.some((s) => s.toLowerCase().includes(q)) ||
      z.branches.some((b) => b.name.toLowerCase().includes(q) || b.city.toLowerCase().includes(q) || b.shopName.toLowerCase().includes(q))
    )
  })

  return (
    <div className="space-y-6">
      {/* Overview Metric Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Geo-Political Zones</span>
              <Compass className="h-4 w-4 text-teal-600" />
            </div>
            <CardTitle className="text-2xl font-extrabold mt-1 font-mono">
              6 Zones
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            North, South, West, East, Central &amp; Dispensary LAN
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Live Online Sessions</span>
              <Users className="h-4 w-4 text-indigo-600" />
            </div>
            <CardTitle className="text-2xl font-extrabold mt-1 font-mono text-indigo-600 dark:text-indigo-400">
              {activeSessions} Active
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Dispensary personnel currently authenticated in past 30 min
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Area Logins Audited</span>
              <Globe className="h-4 w-4 text-emerald-600" />
            </div>
            <CardTitle className="text-2xl font-extrabold mt-1 font-mono text-emerald-600 dark:text-emerald-400">
              {totalLogins} Logins
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Verified across all regional dispensary nodes &amp; terminals
          </CardContent>
        </Card>
      </div>

      {/* Main Geo-Political Zones Area-Wise Grouping Card */}
      <Card className="border-border/80 shadow-card">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Globe className="h-4 w-4 text-teal-600" />
                <span>Geo-Political Zone &amp; Area-Wise Login Intelligence</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Classifies all active logins and pharmacy branch endpoints by Indian Geo-Political Zones, regional states, cities, and local counter LAN nodes.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-52 sm:w-64">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter zone, state, city, shop..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 text-xs rounded-md border border-input bg-background shadow-xs focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="flex rounded-md border border-border p-0.5 text-xs bg-muted/40">
                {['ALL', 'South Zone', 'West Zone', 'North Zone', 'On-Premises / LAN'].map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setSelectedZone(z)}
                    className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                      selectedZone === z
                        ? 'bg-background shadow-xs text-foreground font-bold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {z}
                  </button>
                ))}
              </div>

              <Button onClick={fetchGeoMetrics} variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-teal-600' : ''}`} />
                <span>Refresh</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-4">
          {/* Zone Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {zones.map((z) => {
              const isSelected = selectedZone === z.zone || selectedZone === 'ALL'
              return (
                <div
                  key={z.zone}
                  onClick={() => toggleExpand(z.zone)}
                  className={`p-3.5 rounded-lg border cursor-pointer select-none transition-all ${
                    expandedZone === z.zone
                      ? 'border-teal-500 bg-teal-50/20 dark:bg-teal-950/20 shadow-xs'
                      : 'border-border/70 hover:border-border bg-card'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-xs text-foreground flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-rose-500" />
                        <span>{z.zone}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {z.organizationsCount} Shops • {z.branches.length} Branches
                      </p>
                    </div>

                    <Badge
                      variant="outline"
                      className="font-mono text-[11px] font-bold border-teal-500/30 text-teal-700 dark:text-teal-300 bg-teal-500/10"
                    >
                      {z.activeSessions} Online
                    </Badge>
                  </div>

                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Activity Share:</span>
                      <span className="font-mono font-bold text-foreground">{z.percentage}%</span>
                    </div>
                    <Progress value={z.percentage} className="h-1.5" />
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {z.states.slice(0, 3).map((st) => (
                      <span key={st} className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                        {st}
                      </span>
                    ))}
                    {z.states.length > 3 && (
                      <span className="text-[9px] px-1 py-0.5 text-muted-foreground">+{z.states.length - 3} more</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* AREA-WISE HIERARCHY TREE */}
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Regional Area-Wise Breakdown ({filteredZones.length} Zones)
              </span>
              <span className="text-[11px] text-muted-foreground">
                Click any zone card above or row below to view branch endpoints
              </span>
            </div>

            <div className="space-y-3">
              {filteredZones.map((z) => {
                const isOpen = expandedZone === z.zone
                return (
                  <div key={z.zone} className="border rounded-lg overflow-hidden bg-card">
                    <div
                      onClick={() => toggleExpand(z.zone)}
                      className="p-3 bg-muted/30 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isOpen ? <ChevronDown className="h-4 w-4 text-teal-600" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        <span className="font-bold text-xs text-foreground">{z.zone}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {z.branches.length} Registered Endpoints
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground text-[11px] font-mono">
                          {z.totalLogins} Logins ({z.percentage}%)
                        </span>
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-bold">
                          {z.activeSessions} Active Personnel
                        </Badge>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="p-3 border-t divide-y divide-border/60">
                        {z.branches.length === 0 ? (
                          <div className="py-4 text-center text-xs text-muted-foreground">
                            No branch dispensary counters mapped in this regional zone yet.
                          </div>
                        ) : (
                          z.branches.map((b) => (
                            <div key={b.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <Store className="h-4 w-4 text-teal-600 shrink-0" />
                                <div>
                                  <div className="font-semibold text-xs text-foreground">
                                    {b.shopName} — <span className="font-normal text-muted-foreground">{b.name}</span>
                                  </div>
                                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                    <MapPin className="h-3 w-3 text-rose-500" />
                                    <span>
                                      {b.city}, {b.state}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 text-xs self-end sm:self-auto">
                                <div className="text-right">
                                  <div className="font-mono text-[11px] font-semibold text-foreground">
                                    {b.activeStaffCount > 0 ? (
                                      <span className="text-emerald-600 font-bold">{b.activeStaffCount} staff active</span>
                                    ) : (
                                      <span className="text-muted-foreground">0 active now</span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    Last Active:{' '}
                                    {b.lastLoginAt
                                      ? new Date(b.lastLoginAt).toLocaleTimeString('en-IN', {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })
                                      : 'Never'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
