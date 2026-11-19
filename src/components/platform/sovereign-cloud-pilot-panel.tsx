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
  Cpu,
  HardDrive,
  Sliders,
  Settings2,
  KeyRound,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/lib/hooks/use-toast'
import type { SovereignCloudNode, PrivateCloudDeploymentMode, NodeQuarantineStatus } from '@/lib/cloud/sovereign-cloud-topology'
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

  // Node Provisioning Modal State
  const [provisionModalOpen, setProvisionModalOpen] = useState<boolean>(false)
  const [provisioningNode, setProvisioningNode] = useState<SovereignCloudNode | null>(null)
  const [deploymentMode, setDeploymentMode] = useState<PrivateCloudDeploymentMode>('DEDICATED_PRIVATE_VPC')
  const [vpcId, setVpcId] = useState<string>('')
  const [privateSubnetCidr, setPrivateSubnetCidr] = useState<string>('')
  const [dedicatedDbEndpoint, setDedicatedDbEndpoint] = useState<string>('')
  const [dedicatedDbPoolSize, setDedicatedDbPoolSize] = useState<number>(50)
  const [hsmKeyArn, setHsmKeyArn] = useState<string>('')
  const [assignedSuperAdmin, setAssignedSuperAdmin] = useState<string>('')
  const [allocatedVcpu, setAllocatedVcpu] = useState<number>(64)
  const [allocatedRamGb, setAllocatedRamGb] = useState<number>(256)
  const [allocatedStorageTb, setAllocatedStorageTb] = useState<number>(10)
  const [backupRetentionDays, setBackupRetentionDays] = useState<number>(3650)
  const [crossBorderEgressBlocked, setCrossBorderEgressBlocked] = useState<boolean>(true)
  const [quarantineStatus, setQuarantineStatus] = useState<NodeQuarantineStatus>('OPERATIONAL')
  const [savingProvision, setSavingProvision] = useState<boolean>(false)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)

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

  // Open the Provisioning Modal for a specific node
  const handleOpenProvisionModal = (node: SovereignCloudNode) => {
    setProvisioningNode(node)
    setDeploymentMode(node.deploymentMode || 'DEDICATED_PRIVATE_VPC')
    setVpcId(node.vpcId || `vpc-${node.territoryCode.toLowerCase()}-pri-001`)
    setPrivateSubnetCidr(node.privateSubnetCidr || '10.240.10.0/24')
    setDedicatedDbEndpoint(node.dedicatedDbEndpoint || `postgresql://${node.territoryCode.toLowerCase()}-db.internal:5432/sovereign_rx`)
    setDedicatedDbPoolSize(node.dedicatedDbPoolSize || 50)
    setHsmKeyArn(node.hsmKeyArn || `arn:aws:kms:me-central-1:hsm-${node.territoryCode.toLowerCase()}-default`)
    setAssignedSuperAdmin(node.assignedSuperAdmin || 'superadmin@metapharsic.com')
    setAllocatedVcpu(node.allocatedVcpu || 64)
    setAllocatedRamGb(node.allocatedRamGb || 256)
    setAllocatedStorageTb(node.allocatedStorageTb || 10)
    setBackupRetentionDays(node.backupRetentionDays || 3650)
    setCrossBorderEgressBlocked(node.crossBorderEgressBlocked !== false)
    setQuarantineStatus(node.quarantineStatus || 'OPERATIONAL')
    setProvisionModalOpen(true)
  }

  // Save Provisioning Configuration
  const handleSaveProvisioning = async () => {
    if (!provisioningNode) return
    try {
      setSavingProvision(true)
      const res = await fetch('/api/platform/cloud/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'provision',
          territoryCode: provisioningNode.territoryCode,
          deploymentMode,
          vpcId,
          privateSubnetCidr,
          dedicatedDbEndpoint,
          dedicatedDbPoolSize,
          hsmKeyArn,
          assignedSuperAdmin,
          allocatedVcpu,
          allocatedRamGb,
          allocatedStorageTb,
          backupRetentionDays,
          crossBorderEgressBlocked,
          quarantineStatus,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(
          '🛡️ Private Cloud Node Provisioned',
          `Sovereign node ${provisioningNode.territoryCode} updated: ${deploymentMode} with 100% In-Country Data Residency.`
        )
        setProvisionModalOpen(false)
        if (data.nodes) {
          setNodes(data.nodes)
        } else {
          fetchTopology()
        }
      } else {
        toast.error('Provisioning Failed', data.error || 'Server error provisioning node')
      }
    } catch (err: any) {
      toast.error('Provisioning Error', err.message || 'Network error')
    } finally {
      setSavingProvision(false)
    }
  }

  // Rotate Sovereign Hardware HSM Key
  const handleRotateKey = async () => {
    if (!provisioningNode) return
    try {
      setActionInProgress('rotate-key')
      const res = await fetch('/api/platform/cloud/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rotate-keys',
          territoryCode: provisioningNode.territoryCode,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setHsmKeyArn(data.newKeyArn)
        toast.success('🔑 Hardware HSM Key Rotated', data.message)
        if (data.nodes) setNodes(data.nodes)
      } else {
        toast.error('Key Rotation Failed', data.error || 'Server failed to rotate key')
      }
    } catch (err: any) {
      toast.error('Error', err.message)
    } finally {
      setActionInProgress(null)
    }
  }

  // Trigger DR Failover Test
  const handleTriggerFailover = async () => {
    if (!provisioningNode) return
    try {
      setActionInProgress('failover')
      const res = await fetch('/api/platform/cloud/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'failover',
          territoryCode: provisioningNode.territoryCode,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('⚡ DR Failover Executed', data.message)
        if (data.nodes) setNodes(data.nodes)
        setProvisionModalOpen(false)
      } else {
        toast.error('Failover Failed', data.error)
      }
    } catch (err: any) {
      toast.error('Error', err.message)
    } finally {
      setActionInProgress(null)
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
            <Badge variant="outline" className="bg-sky-500/20 text-sky-300 border-sky-500/30 text-xs font-mono">
              Private Cloud VPC
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
              className={`cursor-pointer transition-all duration-200 hover:shadow-md border relative ${
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
                  <div className="flex items-center gap-1.5">
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
                  {node.vpcId && (
                    <div className="flex justify-between items-center pt-0.5 border-t border-border/30">
                      <span className="text-muted-foreground">Private VPC:</span>
                      <span className="font-mono text-[10px] text-purple-600 dark:text-purple-400 font-medium">
                        {node.vpcId}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px]">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Activity className="h-3.5 w-3.5 text-sky-500" />
                    <span>Ping: <strong className="text-foreground">{node.latencyMs}ms</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-emerald-700 dark:text-emerald-400 font-medium">100% In-Country</span>
                    </div>
                    {/* Direct Configure & Provision Button */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenProvisionModal(node)
                      }}
                      className="h-6 px-2 text-[10px] border-sky-500/40 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40 font-semibold gap-1"
                    >
                      <Sliders className="h-2.5 w-2.5" />
                      <span>Provision</span>
                    </Button>
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

        {/* Selected Sovereign Jurisdiction Details with Configure Drawer */}
        {activeNode && (
          <div className="p-4 bg-muted/20 border-b border-border/40 grid grid-cols-1 md:grid-cols-5 gap-4 text-xs items-center">
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
            <div className="flex md:justify-end">
              <Button
                size="sm"
                onClick={() => handleOpenProvisionModal(activeNode)}
                className="h-8 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-xs gap-1.5"
              >
                <Settings2 className="h-3.5 w-3.5" />
                <span>Provision {activeNode.territoryCode} Node</span>
              </Button>
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

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL: PRIVATE CLOUD NODE PROVISIONING & INFRASTRUCTURE       */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Dialog open={provisionModalOpen} onOpenChange={setProvisionModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Cloud className="h-5 w-5 text-sky-600" />
              <span>
                Provision Sovereign Private Cloud Node: {provisioningNode?.countryNameEn} ({provisioningNode?.flag} {provisioningNode?.territoryCode})
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure dedicated Private Cloud VPC architecture, in-country database connection pooling, Hardware HSM keys, and data residency policies governed by SuperAdmin.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* ROW 1: DEPLOYMENT MODE & RESIDENCY STATUS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Private Cloud Architecture</Label>
                <Select
                  value={deploymentMode}
                  onValueChange={(val: any) => setDeploymentMode(val)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DEDICATED_PRIVATE_VPC">Dedicated Private Cloud (Dedicated VPC)</SelectItem>
                    <SelectItem value="ON_PREM_POD">On-Premises Sovereign Datacenter Pod</SelectItem>
                    <SelectItem value="HYBRID_SOVEREIGN">Hybrid Sovereign Edge Cluster</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Node Operational State</Label>
                <Select
                  value={quarantineStatus}
                  onValueChange={(val: any) => setQuarantineStatus(val)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPERATIONAL">OPERATIONAL — Active Traffic</SelectItem>
                    <SelectItem value="QUARANTINED">QUARANTINED — Strict Isolation</SelectItem>
                    <SelectItem value="MAINTENANCE">MAINTENANCE — Scheduled Updates</SelectItem>
                    <SelectItem value="DR_FAILOVER">DR_FAILOVER — Secondary Host</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ROW 2: PRIVATE VPC ID & SUBNET CIDR */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Dedicated Private VPC ID</Label>
                <Input
                  type="text"
                  value={vpcId}
                  onChange={(e) => setVpcId(e.target.value)}
                  className="h-8 font-mono text-xs"
                  placeholder="vpc-sa-central-pri-991"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Private Subnet CIDR Block</Label>
                <Input
                  type="text"
                  value={privateSubnetCidr}
                  onChange={(e) => setPrivateSubnetCidr(e.target.value)}
                  className="h-8 font-mono text-xs"
                  placeholder="10.240.10.0/24"
                />
              </div>
            </div>

            {/* ROW 3: DEDICATED IN-COUNTRY DATABASE ENDPOINT & POOL SIZE */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold">Dedicated In-Country Database Endpoint</Label>
                <Input
                  type="text"
                  value={dedicatedDbEndpoint}
                  onChange={(e) => setDedicatedDbEndpoint(e.target.value)}
                  className="h-8 font-mono text-xs"
                  placeholder="postgresql://sa-db.internal:5432/sovereign_rx"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Connection Pool Size</Label>
                <Input
                  type="number"
                  value={dedicatedDbPoolSize}
                  onChange={(e) => setDedicatedDbPoolSize(Number(e.target.value))}
                  className="h-8 font-mono text-xs"
                  min={10}
                  max={500}
                />
              </div>
            </div>

            {/* ROW 4: HARDWARE HSM KEY & ROTATION */}
            <div className="space-y-1.5 p-3 rounded-lg border border-purple-500/30 bg-purple-50/20 dark:bg-purple-950/20">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" />
                  Hardware Security Module (HSM) Encryption Key ARN
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleRotateKey}
                  disabled={actionInProgress === 'rotate-key'}
                  className="h-6 text-[10px] border-purple-400 text-purple-700 dark:text-purple-300 gap-1 font-semibold"
                >
                  <KeyRound className={`h-3 w-3 ${actionInProgress === 'rotate-key' ? 'animate-spin' : ''}`} />
                  <span>Rotate HSM Key</span>
                </Button>
              </div>
              <Input
                type="text"
                value={hsmKeyArn}
                onChange={(e) => setHsmKeyArn(e.target.value)}
                className="h-8 font-mono text-xs text-purple-900 dark:text-purple-200"
              />
              <p className="text-[10px] text-muted-foreground">
                Complies with FIPS 140-2 Level 3 hardware boundary standards. Decryption keys never exit physical in-country HSM.
              </p>
            </div>

            {/* ROW 5: COMPUTE & STORAGE ALLOCATIONS */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <Cpu className="h-3 w-3 text-sky-500" /> Allocated vCPU
                </Label>
                <Input
                  type="number"
                  value={allocatedVcpu}
                  onChange={(e) => setAllocatedVcpu(Number(e.target.value))}
                  className="h-8 font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <Activity className="h-3 w-3 text-emerald-500" /> RAM (GB)
                </Label>
                <Input
                  type="number"
                  value={allocatedRamGb}
                  onChange={(e) => setAllocatedRamGb(Number(e.target.value))}
                  className="h-8 font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <HardDrive className="h-3 w-3 text-amber-500" /> NVMe Storage (TB)
                </Label>
                <Input
                  type="number"
                  value={allocatedStorageTb}
                  onChange={(e) => setAllocatedStorageTb(Number(e.target.value))}
                  className="h-8 font-mono text-xs"
                />
              </div>
            </div>

            {/* ROW 6: SUPERADMIN GOVERNOR & ZERO-EGRESS LOCKDOWN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Assigned SuperAdmin Governor</Label>
                <Input
                  type="email"
                  value={assignedSuperAdmin}
                  onChange={(e) => setAssignedSuperAdmin(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="superadmin@metapharsic.com"
                />
              </div>

              <div className="flex items-center justify-between p-2 rounded bg-muted/40 self-end h-8">
                <div className="text-[11px] font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Strict In-Country Zero Egress</span>
                </div>
                <Switch
                  checked={crossBorderEgressBlocked}
                  onCheckedChange={setCrossBorderEgressBlocked}
                />
              </div>
            </div>

            {/* DISASTER RECOVERY ACTIONS */}
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-amber-500/30 bg-amber-50/20 dark:bg-amber-950/20 text-xs">
              <div>
                <span className="font-semibold text-amber-800 dark:text-amber-300 block">
                  Disaster Recovery &amp; Failover Preflight
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Secondary host standby: {provisioningNode?.secondaryFailoverHost}
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleTriggerFailover}
                disabled={actionInProgress === 'failover'}
                className="h-7 text-[11px] border-amber-500 text-amber-800 dark:text-amber-200 gap-1 font-semibold"
              >
                <RotateCcw className={`h-3 w-3 ${actionInProgress === 'failover' ? 'animate-spin' : ''}`} />
                <span>Trigger Failover Test</span>
              </Button>
            </div>
          </div>

          <DialogFooter className="border-t pt-3 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setProvisionModalOpen(false)}
              disabled={savingProvision}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveProvisioning}
              disabled={savingProvision}
              className="bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs shadow-xs"
            >
              {savingProvision ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Deploying Private Topology...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  Save &amp; Provision Node
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
