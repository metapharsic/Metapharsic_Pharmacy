'use client'

// ─────────────────────────────────────────────────────────────
// Component — PurchasesView
// Orchestrates the Complete Pharmacy Purchase Management Lifecycle:
// 1. Pipeline Overview & AP Due-Date Ageing
// 2. PR (Purchase Requisitions with Auto-Reorder & ADS calculation)
// 3. RFQ / Supplier Quotation Comparison Matrix (Landed cost & risk)
// 4. PO (Purchase Orders & Commitments)
// 5. GRN (Advanced Goods Receipt with QC Inspection & Cold-Chain)
// 6. Purchase Invoices (3-Way Matching: PO vs GRN vs Bill)
// 7. Accounts Payable & Supplier Payments (Ledger & Ageing)
// 8. Purchase Returns & Debit Notes
// ─────────────────────────────────────────────────────────────
import {
  FileText,
  GitCompare,
  PackageCheck,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  ShoppingCart,
  Sparkles,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { AdvancedGrnModal } from '@/components/purchases/advanced-grn-modal'
import { AgencyPurchasesView } from '@/components/purchases/agency-purchases-view'
import { AutoPoModal } from '@/components/purchases/auto-po-modal'
import { GoodsReceiptDockView } from '@/components/purchases/goods-receipt-dock-view'
import { NewPurchaseOrderDialog } from '@/components/purchases/new-purchase-order-dialog'
import {
  PurchaseLifecycleTabs,
  type PurchaseStage,
} from '@/components/purchases/purchase-lifecycle-tabs'
import { PurchasePipelineMetrics } from '@/components/purchases/purchase-pipeline-metrics'
import { PurchaseRequisitionsView } from '@/components/purchases/purchase-requisitions-view'
import { PurchaseReturnsView } from '@/components/purchases/purchase-returns-view'
import { PurchasesTable, type PurchaseRow } from '@/components/purchases/purchases-table'
import { SupplierPaymentsView } from '@/components/purchases/supplier-payments-view'
import { SupplierQuotationsMatrix } from '@/components/purchases/supplier-quotations-matrix'
import { SuppliersView } from '@/components/suppliers/suppliers-view'
import { ThreeWayMatchHubView } from '@/components/purchases/three-way-match-hub-view'
import { ThreeWayMatchModal } from '@/components/purchases/three-way-match-modal'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/lib/hooks/use-toast'

interface PurchasesViewProps {
  initialRows: PurchaseRow[]
  initialPagination: { page: number; limit: number; total: number; pages: number }
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ORDERED', label: 'Ordered' },
  { value: 'SENT', label: 'Sent' },
  { value: 'PARTIALLY_RECEIVED', label: 'Partially Received' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'INVOICED', label: 'Invoiced' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

export function PurchasesView({ initialRows, initialPagination }: PurchasesViewProps) {
  const toast = useToast()

  const [currentStage, setCurrentStage] = useState<PurchaseStage>('overview')
  const [pipelineData, setPipelineData] = useState<any | null>(null)
  const [pipelineLoading, setPipelineLoading] = useState(false)

  // PO Table state
  const [rows, setRows] = useState<PurchaseRow[]>(initialRows)
  const [totalPages, setTotalPages] = useState(initialPagination.pages)
  const [page, setPage] = useState(initialPagination.page)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [autoPoOpen, setAutoPoOpen] = useState(false)

  // Active Modals for GRN and 3-Way Match
  const [activePurchaseDetail, setActivePurchaseDetail] = useState<any | null>(null)
  const [grnModalOpen, setGrnModalOpen] = useState(false)
  const [threeWayMatchOpen, setThreeWayMatchOpen] = useState(false)

  // Returns data for returns tab
  const [returnsData, setReturnsData] = useState<any[]>([])
  const [returnsStats, setReturnsStats] = useState({
    totalReturns: 0,
    totalDebitAmount: 0,
    pendingReturnsCount: 0,
  })

  // Sync URL stage query parameter on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search)
      const stageParam = sp.get('stage') as PurchaseStage | null
      const validStages: PurchaseStage[] = [
        'overview',
        'requisitions',
        'quotations',
        'orders',
        'receipts',
        'invoices',
        'payments',
        'agencies',
        'returns',
        'suppliers',
      ]
      if (stageParam && validStages.includes(stageParam)) {
        setCurrentStage(stageParam)
      }
    }
  }, [])

  const handleSelectStage = useCallback((stage: PurchaseStage) => {
    setCurrentStage(stage)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('stage', stage)
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  // Load Pipeline Analytics
  const loadPipeline = useCallback(async () => {
    setPipelineLoading(true)
    try {
      const res = await fetch('/api/purchases/pipeline')
      const json = await res.json()
      if (json.success && json.data) {
        setPipelineData(json.data)
      }
    } catch {
      // Ignore
    } finally {
      setPipelineLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPipeline()
  }, [loadPipeline])

  // Load POs
  const loadPos = useCallback(
    async (opts?: { page?: number; reset?: boolean; status?: string }) => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('page', String(opts?.reset ? 1 : (opts?.page ?? page)))
        params.set('limit', '20')
        if (debouncedSearch) params.set('search', debouncedSearch)

        const filterToUse = opts?.status !== undefined ? opts.status : statusFilter
        if (filterToUse) params.set('status', filterToUse)

        const res = await fetch(`/api/purchases?${params.toString()}`)
        const json = (await res.json()) as {
          success: boolean
          data?: PurchaseRow[]
          pagination?: { page: number; total: number; pages: number }
        }
        if (json.success) {
          setRows(json.data ?? [])
          setTotalPages(json.pagination?.pages ?? 1)
          setPage(json.pagination?.page ?? 1)
        } else {
          toast.error('Failed to load purchase orders')
        }
      } catch {
        toast.error('Failed to load purchase orders')
      } finally {
        setLoading(false)
      }
    },
    [page, debouncedSearch, statusFilter, toast]
  )

  useEffect(() => {
    if (currentStage === 'orders') {
      void loadPos({ reset: true })
    }
  }, [debouncedSearch, statusFilter, currentStage]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadReturns = useCallback(async () => {
    try {
      const res = await fetch('/api/purchase-returns?limit=100')
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        const rList = json.data.map((pr: any) => ({
          id: pr.id,
          returnNumber: pr.returnNumber,
          purchaseId: pr.purchase?.id || pr.purchaseId,
          purchaseNumber: pr.purchase?.purchaseNumber || '—',
          supplierId: pr.supplier?.id || pr.supplierId,
          supplierName: pr.supplier?.name || '—',
          returnDate: pr.returnDate ? new Date(pr.returnDate).toISOString() : new Date().toISOString(),
          reason: pr.reason,
          totalAmount: Number(pr.totalAmount) || 0,
          status: pr.status,
        }))
        setReturnsData(rList)
        setReturnsStats({
          totalReturns: rList.length,
          totalDebitAmount: rList.reduce((s: number, r: any) => s + r.totalAmount, 0),
          pendingReturnsCount: rList.filter((r: any) => r.status === 'PENDING').length,
        })
      }
    } catch {
      // Ignore
    }
  }, [])

  useEffect(() => {
    if (currentStage === 'returns') {
      void loadReturns()
    }
  }, [currentStage, loadReturns])

  // Agencies data for agency bills tab
  const [agenciesData, setAgenciesData] = useState<any[]>([])
  const loadAgencies = useCallback(async () => {
    try {
      const res = await fetch('/api/purchases/agency')
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setAgenciesData(json.data)
      }
    } catch {
      // Ignore
    }
  }, [])

  useEffect(() => {
    if (currentStage === 'agencies') {
      void loadAgencies()
    }
  }, [currentStage, loadAgencies])

  // Fetch full purchase detail to open GRN or 3-Way Match modal
  const handleOpenGrnForPo = async (purchaseId: string) => {
    try {
      const res = await fetch(`/api/purchases/${purchaseId}`)
      const json = await res.json()
      if (json.success && json.data) {
        setActivePurchaseDetail(json.data)
        setGrnModalOpen(true)
      } else {
        toast.error('Failed to load purchase details for GRN')
      }
    } catch {
      toast.error('Failed to load purchase details for GRN')
    }
  }

  const handleOpenMatchForPo = async (purchaseId: string) => {
    try {
      const res = await fetch(`/api/purchases/${purchaseId}`)
      const json = await res.json()
      if (json.success && json.data) {
        setActivePurchaseDetail(json.data)
        setThreeWayMatchOpen(true)
      } else {
        toast.error('Failed to load purchase details for invoice match')
      }
    } catch {
      toast.error('Failed to load purchase details for invoice match')
    }
  }

  // Lifecycle stage badge counters
  const counts = {
    requisitionsPending: pipelineData?.counts?.requisitionsPending ?? 0,
    quotesActive: pipelineData?.counts?.quotesActive ?? 0,
    ordersOpen: pipelineData?.statusBreakdown?.ordered ?? 0,
    pendingReceival:
      (pipelineData?.statusBreakdown?.ordered ?? 0) +
      (pipelineData?.statusBreakdown?.partiallyReceived ?? 0),
    pendingInvoicing: pipelineData?.statusBreakdown?.received ?? 0,
    overduePayables: pipelineData?.payables?.overdue > 0 ? 1 : 0,
    agenciesCount: agenciesData.length,
    pendingReturns: pipelineData?.counts?.pendingReturns ?? 0,
    suppliersCount: pipelineData?.counts?.suppliersCount ?? 0,
  }

  return (
    <div className="space-y-4">
      {/* Complete Pharmacy Purchase Lifecycle Navigator */}
      <PurchaseLifecycleTabs
        currentStage={currentStage}
        onSelectStage={handleSelectStage}
        counts={counts}
      />

      {/* ─── Stage 1: Pipeline Overview ─── */}
      {currentStage === 'overview' && (
        <PurchasePipelineMetrics
          data={pipelineData}
          loading={pipelineLoading}
          onNavigateToTab={(tab) => handleSelectStage(tab as PurchaseStage)}
          onQuickAction={(action) => {
            if (action.type === 'GRN_PENDING' && action.poId) {
              void handleOpenGrnForPo(action.poId)
            } else if (action.type === 'MATCH_PENDING' && action.poId) {
              void handleOpenMatchForPo(action.poId)
            } else if (action.targetStage) {
              handleSelectStage(action.targetStage as PurchaseStage)
            }
          }}
        />
      )}

      {/* ─── Stage 2: Purchase Requisitions (PR) ─── */}
      {currentStage === 'requisitions' && <PurchaseRequisitionsView />}

      {/* ─── Stage 3: RFQ & Supplier Quotation Matrix ─── */}
      {currentStage === 'quotations' && <SupplierQuotationsMatrix />}

      {/* ─── Stage 4: Purchase Orders (PO) ─── */}
      {currentStage === 'orders' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search PO number or supplier…"
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoPoOpen(true)}
              className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
            >
              <Sparkles className="h-4 w-4" />
              Auto-Generate POs
            </Button>
            <NewPurchaseOrderDialog
              onSuccess={() => {
                void loadPos({ reset: true })
                void loadPipeline()
              }}
              triggerButton={
                <Button
                  size="sm"
                  className="gap-1.5 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" />
                  New Purchase Order
                </Button>
              }
            />
            <div className="ml-auto flex items-center gap-2">
              <div className="text-sm text-muted-foreground">
                Page {page} of {Math.max(totalPages, 1)}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => loadPos({ page: page - 1 })}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => loadPos({ page: page + 1 })}
              >
                Next
              </Button>
            </div>
          </div>

          <PurchasesTable
            rows={rows}
            isLoading={loading}
            onReceive={handleOpenGrnForPo}
            onInvoiceMatch={handleOpenMatchForPo}
          />
        </div>
      )}

      {/* ─── Stage 4: Goods Receipt Note (GRN Dock & Batches) ─── */}
      {currentStage === 'receipts' && (
        <GoodsReceiptDockView
          onInspectGrn={handleOpenGrnForPo}
          onRefreshPipeline={loadPipeline}
        />
      )}

      {/* ─── Stage 5: 3-Way Match & Supplier Invoicing ─── */}
      {currentStage === 'invoices' && (
        <ThreeWayMatchHubView
          onMatchInvoice={handleOpenMatchForPo}
          onRefreshPipeline={loadPipeline}
        />
      )}

      {/* ─── Stage 6: Accounts Payable & Payments ─── */}
      {currentStage === 'payments' && <SupplierPaymentsView />}

      {/* ─── Stage 7: Agency & Distributor-Wise Purchase Management ─── */}
      {currentStage === 'agencies' && (
        <AgencyPurchasesView initialAgencies={agenciesData} />
      )}

      {/* ─── Stage 8: Purchase Returns & Debit Notes ─── */}
      {currentStage === 'returns' && (
        <div className="space-y-4">
          <PurchaseReturnsView
            returns={returnsData}
            stats={returnsStats}
            canCreate={true}
            onRefresh={loadReturns}
          />
        </div>
      )}

      {/* ─── Stage 9: Supplier Master Management ─── */}
      {currentStage === 'suppliers' && (
        <SuppliersView />
      )}

      {/* ─── Dialogs & Modals ─── */}
      <AutoPoModal
        open={autoPoOpen}
        onOpenChange={setAutoPoOpen}
        onSuccess={() => {
          void loadPos({ reset: true })
          void loadPipeline()
        }}
      />

      <AdvancedGrnModal
        open={grnModalOpen}
        onOpenChange={setGrnModalOpen}
        purchase={activePurchaseDetail}
        onSuccess={() => {
          void loadPos({ reset: true })
          void loadPipeline()
        }}
      />

      <ThreeWayMatchModal
        open={threeWayMatchOpen}
        onOpenChange={setThreeWayMatchOpen}
        purchase={activePurchaseDetail}
        onSuccess={() => {
          void loadPos({ reset: true })
          void loadPipeline()
        }}
      />
    </div>
  )
}