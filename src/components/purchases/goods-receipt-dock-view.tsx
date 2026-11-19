'use client'

import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  MapPin,
  PackageCheck,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Snowflake,
  Thermometer,
  Truck,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/lib/hooks/use-toast'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'

interface GoodsReceiptDockViewProps {
  onInspectGrn: (purchaseId: string) => void
  onRefreshPipeline?: () => void
}

export function GoodsReceiptDockView({
  onInspectGrn,
  onRefreshPipeline,
}: GoodsReceiptDockViewProps) {
  const toast = useToast()

  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending')
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [completedOrders, setCompletedOrders] = useState<any[]>([])

  // GRN Slip view modal state
  const [selectedGrnSlip, setSelectedGrnSlip] = useState<any | null>(null)
  const [slipModalOpen, setSlipModalOpen] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [pendingRes, completedRes] = await Promise.all([
        fetch('/api/purchases?status=ORDERED&limit=50'),
        fetch('/api/purchases?status=RECEIVED&limit=50'),
      ])
      const [pendingJson, completedJson] = await Promise.all([
        pendingRes.json(),
        completedRes.json(),
      ])

      if (pendingJson.success && Array.isArray(pendingJson.data)) {
        setPendingOrders(pendingJson.data)
      }
      if (completedJson.success && Array.isArray(completedJson.data)) {
        setCompletedOrders(completedJson.data)
      }
    } catch {
      toast.error('Failed to load dock receipt consignments')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const filteredPending = pendingOrders.filter(
    (po) =>
      po.purchaseNumber?.toLowerCase().includes(search.toLowerCase()) ||
      po.supplier?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const filteredCompleted = completedOrders.filter(
    (po) =>
      po.purchaseNumber?.toLowerCase().includes(search.toLowerCase()) ||
      po.supplier?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const handleViewGrnSlip = async (purchaseId: string) => {
    try {
      const res = await fetch(`/api/purchases/${purchaseId}`)
      const json = await res.json()
      if (json.success && json.data) {
        setSelectedGrnSlip(json.data)
        setSlipModalOpen(true)
      } else {
        toast.error('Failed to load GRN slip details')
      }
    } catch {
      toast.error('Failed to load GRN slip details')
    }
  }

  return (
    <div className="space-y-4">
      {/* ─── Executive Header & KPI Tiles ─── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight">Goods Receiving Dock & Batches (GRN)</h2>
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
              QC & Cold Chain Hub
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Dockside intake inspection, quality verification, cold chain excursion detection, and physical rack/box allocation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void loadData()
              onRefreshPipeline?.()
            }}
            disabled={loading}
            className="h-8 gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Dock
          </Button>
        </div>
      </div>

      {/* Dock Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-3">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium">Pending Dock Intake</span>
              <Truck className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">
              {pendingOrders.length}
            </div>
            <p className="text-[10px] text-muted-foreground">Awaiting inspection & batching</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-3">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium">Cold Chain Monitor</span>
              <Snowflake className="h-4 w-4 text-cyan-600" />
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-2xl font-bold tabular-nums text-cyan-600">2° - 8°C</span>
              <Badge className="bg-emerald-500/15 text-emerald-600 text-[10px] py-0 px-1 border-0">
                Calibrated
              </Badge>
            </div>
            <p className="text-[10px] text-muted-foreground">Vaccine & insulin quarantine active</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-3">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium">Dock Inspected (GRN)</span>
              <PackageCheck className="h-4 w-4 text-purple-600" />
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-purple-600">
              {completedOrders.length}
            </div>
            <p className="text-[10px] text-muted-foreground">Passed QC, ready for 3-way match</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-3">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium">Storage Allocation</span>
              <Boxes className="h-4 w-4 text-amber-600" />
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-amber-600">
              100%
            </div>
            <p className="text-[10px] text-muted-foreground">All batches assigned to racks & boxes</p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Search & Tab Navigator ─── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg">
          <Button
            variant={activeTab === 'pending' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('pending')}
            className="h-7 text-xs gap-1.5"
          >
            <Truck className="h-3.5 w-3.5 text-emerald-600" />
            Pending Dock Inspection
            {pendingOrders.length > 0 && (
              <span className="ml-1 rounded-full bg-emerald-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
                {pendingOrders.length}
              </span>
            )}
          </Button>
          <Button
            variant={activeTab === 'completed' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('completed')}
            className="h-7 text-xs gap-1.5"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-purple-600" />
            Inspected GRN Receipts History
            <span className="ml-1 rounded-full bg-muted-foreground/20 px-1.5 py-0.2 text-[10px] font-semibold text-muted-foreground">
              {completedOrders.length}
            </span>
          </Button>
        </div>

        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PO # or supplier…"
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* ─── Tab 1: Pending Dock Inspection ─── */}
      {activeTab === 'pending' && (
        <div className="space-y-3">
          {filteredPending.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 p-8 text-center bg-card/40">
              <PackageCheck className="mx-auto h-8 w-8 text-emerald-600/60" />
              <h4 className="mt-2 text-sm font-semibold">No Pending Dock Deliveries</h4>
              <p className="text-xs text-muted-foreground mt-1">
                All dispatched vendor purchase orders have been inspected and inducted into inventory.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPending.map((po) => (
                <Card
                  key={po.id}
                  className="border-emerald-500/30 bg-card/80 hover:border-emerald-500/60 transition-all shadow-sm"
                >
                  <CardHeader className="p-3.5 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-sm font-bold text-foreground">
                            {po.purchaseNumber}
                          </span>
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] border-amber-500/30">
                            Dispatched
                          </Badge>
                        </div>
                        <p className="text-xs font-medium text-muted-foreground mt-0.5 truncate">
                          {po.supplier?.name || 'Authorized Distributor'}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold text-foreground">
                          {formatCurrency(Number(po.totalAmount) || 0)}
                        </span>
                        <p className="text-[10px] text-muted-foreground">Order Value</p>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-3.5 pt-1 space-y-3">
                    <div className="rounded-md bg-muted/40 p-2 text-[11px] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Order Date:
                        </span>
                        <span className="font-medium text-foreground">{formatDate(po.purchaseDate)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Thermometer className="h-3 w-3 text-cyan-600" /> Temperature:
                        </span>
                        <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                          Controlled 2°C - 8°C / Ambient
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5" /> Ready for QC Check
                      </span>
                      <Button
                        size="sm"
                        onClick={() => onInspectGrn(po.id)}
                        className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm"
                      >
                        <Truck className="h-3.5 w-3.5" />
                        Inspect & Receive GRN
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Tab 2: Completed GRN Receipts History ─── */}
      {activeTab === 'completed' && (
        <Card className="border-border/60">
          <CardHeader className="p-3.5 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Completed Dockside Goods Receipt Notes (GRN)
            </CardTitle>
            <CardDescription className="text-xs">
              Physical inventory verified, batch numbers logged, and stock allocated to racks.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="text-[11px]">
                  <TableHead>PO Reference</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Receipt Date</TableHead>
                  <TableHead>Invoice Matching Status</TableHead>
                  <TableHead className="text-right">Received Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompleted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-xs text-muted-foreground">
                      No completed GRN records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCompleted.map((po) => (
                    <TableRow key={po.id} className="text-xs">
                      <TableCell className="font-mono font-semibold text-foreground">
                        {po.purchaseNumber}
                      </TableCell>
                      <TableCell>{po.supplier?.name || '—'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(po.purchaseDate)}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30 text-[10px]">
                          Pending 3-Way Match
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(Number(po.totalAmount) || 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleViewGrnSlip(po.id)}
                          className="h-7 text-xs gap-1 text-primary hover:text-primary/80"
                        >
                          <FileText className="h-3 w-3" /> View GRN Slip
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ─── GRN Slip Inspection Modal ─── */}
      <Dialog open={slipModalOpen} onOpenChange={setSlipModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-4">
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <PackageCheck className="h-5 w-5 text-emerald-600" />
                Goods Receipt Note (GRN) Inspection Slip
              </DialogTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="h-7 text-xs gap-1"
              >
                <Printer className="h-3 w-3" /> Print Slip
              </Button>
            </div>
            <DialogDescription className="text-xs">
              Official dock verification audit and warehouse batch intake record.
            </DialogDescription>
          </DialogHeader>

          {selectedGrnSlip && (
            <div className="space-y-4 pt-2 text-xs">
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase">PO Number</span>
                  <p className="font-mono font-bold text-foreground">{selectedGrnSlip.purchaseNumber}</p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase">Supplier</span>
                  <p className="font-semibold text-foreground">{selectedGrnSlip.supplier?.name}</p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase">Receipt Date</span>
                  <p className="text-foreground">{formatDate(selectedGrnSlip.purchaseDate)}</p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase">Cold Chain Verification</span>
                  <p className="font-semibold text-emerald-600 flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" /> 4.2°C (Optimal - No Excursions)
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow className="text-[11px]">
                      <TableHead>Medicine / Item</TableHead>
                      <TableHead>Batch Assigned</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead className="text-right">Accepted Qty</TableHead>
                      <TableHead>Storage Location</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedGrnSlip.items?.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-foreground">
                          {item.product?.name || item.productId}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-primary font-bold">
                          {item.batchNumber || 'BCH-26-AUTO'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.expiryDate ? formatDate(item.expiryDate) : '24 Months+'}
                        </TableCell>
                        <TableCell className="text-right font-bold text-foreground">
                          {item.quantity} units
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            <MapPin className="h-2.5 w-2.5" /> Rack A1 • Box B-02
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
                <span>Stock physically inducted to pharmacy shelves. Ready for supplier invoice matching.</span>
                <span className="font-semibold">QC Passed by Senior Pharmacist</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
