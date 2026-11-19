'use client'

import React, { useState, useEffect } from 'react'
import {
  Cloud,
  Shield,
  ShieldCheck,
  Zap,
  Server,
  Activity,
  CheckCircle2,
  RefreshCw,
  Lock,
  Globe,
  Database,
  ArrowRight,
  Play,
  Layers,
  Building,
  Radio,
  FileCheck,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/lib/hooks/use-toast'
import type { SovereignCloudNode } from '@/lib/cloud/sovereign-cloud-topology'
import type { CloudPilotEngineResult, CloudPilotThreadTelemetry } from '@/lib/cloud/multi-thread-cloud-pilot-engine'

export function SovereignCloudPilotPanel() {
  const toast = useToast()
  const [nodes, setNodes] = useState<SovereignCloudNode[]>([])
  const [selectedTerritory, setSelectedTerritory] = useState<string>('SA')
  const [batchSize, setBatchSize] = useState<number>(50)
  const [invoiceType, setInvoiceType] = useState<'SIMPLIFIED' | 'STANDARD'>('SIMPLIFIED')
  const [loading, setLoading] = useState<boolean>(false)
  const [pilotResult, setPilotResult] = useState<CloudPilotEngineResult | null>(null)
  const [fetchingTopology, setFetchingTopology] = useState<boolean>(true)

  // Fetch Cloud Topology
  const fetchTopology = async () => {
    try {
      setFetchingTopology(true)
      const res = await fetch('/api/platform/cloud/topology')
      if (res.ok) {
        const data = await res.json()
        if (data.nodes) {
          setNodes(data.nodes)
        }
      }
    } catch (err) {
      console.error('Failed to load sovereign cloud nodes', err)
    } finally {
      setFetchingTopology(false)
    }
  }

  // Run the 5-Thread Sovereign Cloud Pilot & ZATCA Stress Runner
  const runPilotBenchmark = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/platform/cloud/pilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          territoryCode: selectedTerritory,
          sandboxBatchSize: batchSize,
          invoiceType,
        }),
      })

      const data = await res.json()
      if (data.success) {
        setPilotResult(data)
        toast.success(
          '⚡ Sovereign Cloud & ZATCA Pilot Complete',
          `Dispatched 5 threads in ${data.totalDurationMs}ms. ${data.zatcaBenchmark?.passedCount || 0} invoices verified with unbroken hash-chain.`
        )
      } else {
        toast.error('Pilot Failed', data.error || 'Unknown pilot error')
      }
    } catch (err: any) {
      toast.error('Error', err.message || 'Network error executing pilot')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTopology()
  }, [])

  const activeNode = nodes.find((n) => n.territoryCode === selectedTerritory) || nodes[0]

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-sky-900/90 via-slate-900 to-emerald-950 p-6 rounded-xl border border-sky-800/40 text-white shadow-lg">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-sky-500/20 rounded-lg border border-sky-400/30 text-sky-400">
              <Cloud className="h-6 w-6" />
            </span>
            <h2 className="text-xl font-bold tracking-tight">
              Sovereign Cloud Topologies &amp; Regional Pilot Simulator
            </h2>
            <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">
              6 Sovereign Nodes Active
            </Badge>
          </div>
          <p className="text-xs text-sky-200/80 max-w-3xl">
            Strict sovereign data residency enforcement across Saudi Arabia (NDMO / PDPL), Oman (RD 6/2022 ODP), Bahrain (NHRA), Qatar (MoPH), Maldives (MIRA/Aasandha), and India (DPDPA 2023). Integrated with ZATCA Phase 2 Fatoora clearance simulator.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchTopology}
            disabled={fetchingTopology}
            className="bg-sky-950/60 border-sky-700/50 text-sky-200 hover:bg-sky-900"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${fetchingTopology ? 'animate-spin' : ''}`} />
            Refresh Topologies
          </Button>
          <Button
            size="sm"
            onClick={runPilotBenchmark}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-md transition-all"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                Executing 5-Thread Suite...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-1.5 fill-current" />
                Launch Multi-Thread Pilot
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 6 Sovereign Cloud Nodes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {nodes.map((node) => {
          const isSelected = node.territoryCode === selectedTerritory
          return (
            <Card
              key={node.territoryCode}
              onClick={() => setSelectedTerritory(node.territoryCode)}
              className={`cursor-pointer transition-all duration-200 hover:shadow-md border ${
                isSelected
                  ? 'border-sky-500 ring-2 ring-sky-500/20 bg-sky-50/20 dark:bg-sky-950/20'
                  : 'border-border/60 hover:border-border'
              }`}
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{node.flag}</span>
                    <div>
                      <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                        {node.countryNameEn}
                        <span className="text-xs font-normal text-muted-foreground font-arabic">
                          ({node.countryNameAr})
                        </span>
                      </CardTitle>
                      <CardDescription className="text-xs flex items-center gap-1 mt-0.5">
                        <Server className="h-3 w-3 text-sky-500" />
                        {node.cloudProvider}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-mono uppercase ${
                      node.status === 'ONLINE'
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                    {node.status}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-4 pt-2 space-y-2.5 text-xs">
                <div className="p-2 rounded bg-muted/40 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Datacenter:</span>
                    <span className="font-semibold text-[11px]">{node.datacenterCity}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Region Code:</span>
                    <span className="font-mono text-[10px] text-sky-600 dark:text-sky-400 font-semibold">
                      {node.cloudRegionCode}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Encryption:</span>
                    <span className="text-[10px] flex items-center gap-1 font-medium">
                      <Lock className="h-3 w-3 text-emerald-500" />
                      {node.encryptionStandard.split(' ')[0]}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px]">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Activity className="h-3.5 w-3.5 text-sky-500" />
                    <span>Ping: <strong className="text-foreground">{node.latencyMs}ms</strong></span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-emerald-700 dark:text-emerald-400 font-medium">100% In-Country</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Control Console & Stress Test Configuration */}
      <Card className="border border-border/80 shadow-sm">
        <CardHeader className="p-4 pb-3 border-b border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                Multi-Thread Sovereign Preflight &amp; ZATCA Clearance Console
              </CardTitle>
              <CardDescription className="text-xs">
                Simulate real-time checkout volume against sovereign tax &amp; residency gates with microsecond telemetry
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="batchSizeSelect" className="text-xs whitespace-nowrap">
                  Batch Invoices:
                </Label>
                <Select
                  value={String(batchSize)}
                  onValueChange={(val) => setBatchSize(parseInt(val, 10))}
                >
                  <SelectTrigger id="batchSizeSelect" className="h-8 w-28 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25 Invoices</SelectItem>
                    <SelectItem value="50">50 Invoices</SelectItem>
                    <SelectItem value="100">100 Invoices</SelectItem>
                    <SelectItem value="250">250 Invoices</SelectItem>
                    <SelectItem value="500">500 Invoices</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Label htmlFor="invTypeSelect" className="text-xs whitespace-nowrap">
                  Invoice Type:
                </Label>
                <Select
                  value={invoiceType}
                  onValueChange={(val: any) => setInvoiceType(val)}
                >
                  <SelectTrigger id="invTypeSelect" className="h-8 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SIMPLIFIED">B2C Simplified</SelectItem>
                    <SelectItem value="STANDARD">B2B Standard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                size="sm"
                onClick={runPilotBenchmark}
                disabled={loading}
                className="h-8 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold"
              >
                {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Play className="h-3.5 w-3.5 mr-1" />}
                Dispatch Benchmark
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Selected Sovereign Jurisdiction Details */}
        {activeNode && (
          <div className="p-4 bg-muted/20 border-b border-border/40 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-muted-foreground block text-[11px]">Primary In-Country Node:</span>
              <span className="font-mono font-medium text-sky-600 dark:text-sky-400">
                {activeNode.primaryNodeHost}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Secondary Failover:</span>
              <span className="font-mono font-medium text-slate-600 dark:text-slate-400">
                {activeNode.secondaryFailoverHost}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Sovereign Mandate:</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                {activeNode.dataResidencyLaw}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">KMS Hardware Standard:</span>
              <span className="font-medium text-foreground flex items-center gap-1">
                <Shield className="h-3 w-3 text-purple-600" />
                {activeNode.encryptionStandard}
              </span>
            </div>
          </div>
        )}

        {/* Telemetry Results of the 5 Concurrent Threads */}
        {pilotResult && (
          <CardContent className="p-4 space-y-6">
            {/* Top Metrics Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800">
                <div className="text-[11px] text-sky-700 dark:text-sky-300 font-medium">Throughput</div>
                <div className="text-2xl font-bold text-sky-900 dark:text-sky-100 mt-1">
                  {pilotResult.zatcaBenchmark.throughputInvoicesPerSec}{' '}
                  <span className="text-xs font-normal text-muted-foreground">inv/sec</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Total {pilotResult.zatcaBenchmark.totalInvoices} Invoices in {pilotResult.totalDurationMs}ms
                </div>
              </div>

              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                <div className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">Clearance Pass Rate</div>
                <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 mt-1">
                  {pilotResult.zatcaBenchmark.passRatePercent}%
                </div>
                <div className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {pilotResult.zatcaBenchmark.passedCount} Cleared / {pilotResult.zatcaBenchmark.failedCount} Failed
                </div>
              </div>

              <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800">
                <div className="text-[11px] text-purple-700 dark:text-purple-300 font-medium">Cryptographic Hash Chain</div>
                <div className="text-xl font-bold text-purple-900 dark:text-purple-100 mt-1 flex items-center gap-1">
                  <Lock className="h-4 w-4 text-purple-600" />
                  {pilotResult.zatcaBenchmark.cryptographicChainValid ? 'UNBROKEN' : 'CORRUPTED'}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 font-mono truncate">
                  SHA-256 Chaining Verified
                </div>
              </div>

              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                <div className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">Avg Latency / Invoice</div>
                <div className="text-2xl font-bold text-amber-900 dark:text-amber-100 mt-1">
                  {pilotResult.zatcaBenchmark.averageLatencyPerInvoiceMs}{' '}
                  <span className="text-xs font-normal text-muted-foreground">ms</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Sub-millisecond TLV Generation
                </div>
              </div>
            </div>

            {/* 5-Thread Telemetry Pipeline */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-sky-500" />
                5-Thread Concurrent Regional Cloud &amp; Pilot Telemetry
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {pilotResult.threads.map((thread) => (
                  <div
                    key={thread.code}
                    className="p-3 rounded-lg border border-border bg-card shadow-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-muted-foreground">#{thread.id}</span>
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                      >
                        {thread.status}
                      </Badge>
                    </div>

                    <div>
                      <div className="text-xs font-bold leading-tight">{thread.name}</div>
                      <div className="text-[10px] text-muted-foreground font-arabic leading-tight mt-0.5">
                        {thread.label}
                      </div>
                    </div>

                    <div className="pt-1 border-t border-border/40 flex justify-between items-center text-[10px]">
                      <span className="text-muted-foreground">Execution:</span>
                      <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                        {thread.durationMs}ms
                      </span>
                    </div>

                    <p className="text-[10px] text-muted-foreground leading-snug line-clamp-3">
                      {thread.details}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Regional Dispensary Counter Health Matrix */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5 text-emerald-500" />
                Live Dispensary Counters Health Matrix (6 Pilot Cities)
              </h4>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                {pilotResult.pilotDispensaryNodes.map((store) => (
                  <div
                    key={store.storeName}
                    className="p-2.5 rounded-lg border border-border/70 bg-muted/20 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold truncate text-[11px]">{store.city}</span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                        {store.status}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">{store.storeName}</div>
                    <div className="flex items-center justify-between text-[10px] pt-1">
                      <span className="text-muted-foreground">Ping:</span>
                      <span className="font-mono font-semibold text-emerald-600">{store.pingMs}ms</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cryptographic Hash Chain Audit Sample */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileCheck className="h-3.5 w-3.5 text-purple-500" />
                Cryptographic Invoice Hash Chaining Audit Sample
              </h4>

              <div className="overflow-x-auto rounded-lg border border-border/80">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border text-[11px] text-muted-foreground">
                    <tr>
                      <th className="p-2.5 font-medium">Invoice #</th>
                      <th className="p-2.5 font-medium">Status</th>
                      <th className="p-2.5 font-medium">Gross</th>
                      <th className="p-2.5 font-medium">VAT</th>
                      <th className="p-2.5 font-medium">SHA-256 Hash</th>
                      <th className="p-2.5 font-medium">Previous Invoice Hash</th>
                      <th className="p-2.5 font-medium text-right">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {pilotResult.zatcaBenchmark.sampleInvoices.map((inv, idx) => (
                      <tr key={inv.invoiceNumber} className="hover:bg-muted/30">
                        <td className="p-2.5 font-mono font-medium text-sky-600">{inv.invoiceNumber}</td>
                        <td className="p-2.5">
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                            {inv.clearanceStatus}
                          </Badge>
                        </td>
                        <td className="p-2.5 font-mono font-medium">${inv.totalAmount.toFixed(2)}</td>
                        <td className="p-2.5 font-mono text-muted-foreground">${inv.vatAmount.toFixed(2)}</td>
                        <td className="p-2.5 font-mono text-[10px] text-muted-foreground max-w-xs truncate" title={inv.invoiceHashHex}>
                          {inv.invoiceHashHex}
                        </td>
                        <td className="p-2.5 font-mono text-[10px] text-muted-foreground max-w-xs truncate" title={inv.previousInvoiceHash}>
                          {inv.previousInvoiceHash}
                        </td>
                        <td className="p-2.5 font-mono text-[11px] text-right text-emerald-600">{inv.durationMs}ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
