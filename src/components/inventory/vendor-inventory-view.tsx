'use client'

import { formatRack } from '@/lib/utils/rack'

import {
  AlertTriangle,
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  Layers,
  MapPin,
  Package,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Truck,
  Undo2,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/lib/hooks/use-toast'
import type { VendorInventorySummary } from '@/lib/inventory/inventory-analytics-service'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'

interface VendorInventoryViewProps {
  branchId: string
  onOpenAutoPo?: () => void
}

export function VendorInventoryView({ branchId, onOpenAutoPo }: VendorInventoryViewProps) {
  const router = useRouter()
  const toast = useToast()

  const [vendors, setVendors] = useState<VendorInventorySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedVendorId, setExpandedVendorId] = useState<string | null>(null)

  const loadVendorStock = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (branchId && branchId !== 'all') params.set('branchId', branchId)

      const res = await fetch(`/api/inventory/vendor-stock?${params.toString()}`)
      const json = await res.json()
      if (json.success && json.data) {
        setVendors(json.data as VendorInventorySummary[])
        if ((json.data as VendorInventorySummary[]).length > 0) {
          setExpandedVendorId((json.data as VendorInventorySummary[])[0].supplierId)
        }
      } else {
        toast.error('Failed to load vendor inventory')
      }
    } catch {
      toast.error('Network error loading vendor inventory')
    } finally {
      setLoading(false)
    }
  }, [branchId, toast])

  useEffect(() => {
    void loadVendorStock()
  }, [loadVendorStock])

  const toggleVendor = (id: string) => {
    setExpandedVendorId((prev) => (prev === id ? null : id))
  }

  // Filter vendors by search
  const filteredVendors = vendors.filter((v) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      v.supplierName.toLowerCase().includes(q) ||
      (v.contactPerson && v.contactPerson.toLowerCase().includes(q)) ||
      (v.phone && v.phone.toLowerCase().includes(q)) ||
      v.batches.some(
        (b) =>
          b.productName.toLowerCase().includes(q) ||
          b.batchNumber.toLowerCase().includes(q) ||
          b.sku.toLowerCase().includes(q)
      )
    )
  })

  // Export vendor summary CSV
  const handleExportCsv = (v?: VendorInventorySummary) => {
    const targetVendors = v ? [v] : filteredVendors
    if (targetVendors.length === 0) {
      toast.error('No vendor inventory to export')
      return
    }

    const headers = [
      'Vendor Name',
      'Contact Person',
      'Phone',
      'Batch Number',
      'Product Name',
      'SKU',
      'Location',
      'Expiry Date',
      'Available Units',
      'Cost Price',
      'MRP',
      'Near Expiry Status',
    ]

    const csvRows = [headers.join(',')]
    for (const vendor of targetVendors) {
      for (const b of vendor.batches) {
        const loc = `${b.rack || ''} ${b.shelf || ''} ${b.box || ''}`.trim()
        csvRows.push(
          [
            `"${vendor.supplierName.replace(/"/g, '""')}"`,
            `"${vendor.contactPerson || ''}"`,
            `"${vendor.phone || ''}"`,
            `"${b.batchNumber}"`,
            `"${b.productName.replace(/"/g, '""')}"`,
            `"${b.sku}"`,
            `"${loc}"`,
            `"${formatDate(new Date(b.expiryDate))}"`,
            b.availableQuantity,
            b.costPrice,
            b.mrp,
            b.isNearExpiry ? 'NEAR_EXPIRY (<60d)' : 'VALID',
          ].join(',')
        )
      }
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mpharm-vendor-inventory-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Vendor Statement Exported', `${targetVendors.length} vendors exported`)
  }

  return (
    <div className="space-y-4">
      {/* Header and Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-gradient-to-r from-card to-background p-4 shadow-xs">
        <div className="space-y-1">
          <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" />
            <span>Vendor &amp; Distributor Specific Inventory</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Track exact inventory valuation, batches, and return-eligible stock supplied by each vendor.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by vendor, medicine, batch…"
              className="pl-8 h-8 text-xs"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExportCsv()}
            className="h-8 gap-1 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export All</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadVendorStock()}
            disabled={loading}
            className="h-8 gap-1 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Vendor Cards List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/60 bg-card p-4 space-y-2">
              <Skeleton className="h-5 w-48" />
              <div className="grid grid-cols-4 gap-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredVendors.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-8 text-center space-y-2">
          <Building2 className="h-8 w-8 text-muted-foreground/60 mx-auto" />
          <p className="text-sm font-semibold text-foreground">No vendor inventory records</p>
          <p className="text-xs text-muted-foreground">
            No active batches linked to suppliers matched your search.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredVendors.map((vendor) => {
            const isExpanded = expandedVendorId === vendor.supplierId
            return (
              <div
                key={vendor.supplierId}
                className="rounded-xl border border-border/70 bg-card shadow-xs overflow-hidden transition-all hover:border-primary/40"
              >
                {/* Vendor Summary Card Header */}
                <div
                  onClick={() => toggleVendor(vendor.supplierId)}
                  className="p-4 bg-muted/25 cursor-pointer hover:bg-muted/40 transition-colors border-b border-border/50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-primary" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">
                            {vendor.supplierName}
                          </span>
                          {vendor.dlNumber && (
                            <Badge variant="outline" className="text-[10px] font-mono">
                              DL: {vendor.dlNumber}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          {vendor.contactPerson && <span>{vendor.contactPerson}</span>}
                          {vendor.phone && (
                            <span className="flex items-center gap-1 font-mono">
                              <Phone className="h-3 w-3" />
                              {vendor.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Vendor Metric Badges */}
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                          Stock Valuation (Cost)
                        </span>
                        <span className="font-mono text-sm font-bold text-foreground">
                          {formatCurrency(vendor.totalValuationAtCost)}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                          Active Stock
                        </span>
                        <span className="font-mono text-sm font-semibold text-foreground">
                          {vendor.totalAvailableUnits} units · {vendor.totalSkus} SKUs
                        </span>
                      </div>

                      {vendor.nearExpiryUnitsCount > 0 && (
                        <div className="text-right">
                          <Badge
                            variant="destructive"
                            className="gap-1 text-[10px] font-mono bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                          >
                            <AlertTriangle className="h-3 w-3" />
                            <span>
                              {vendor.nearExpiryUnitsCount} expiring ({formatCurrency(vendor.nearExpiryValuationAtCost)})
                            </span>
                          </Badge>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 ml-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportCsv(vendor)}
                          className="h-7 text-xs gap-1"
                          title="Export statement for this supplier"
                        >
                          <Download className="h-3 w-3" />
                          <span className="hidden sm:inline">Statement</span>
                        </Button>

                        <Button
                          size="sm"
                          onClick={() => router.push('/purchases/returns/new')}
                          className="h-7 text-xs gap-1 bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-xs"
                          title="Initiate supplier return"
                        >
                          <Undo2 className="h-3 w-3" />
                          <span className="hidden sm:inline">Return</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Vendor Batches Table */}
                {isExpanded && (
                  <div className="p-3">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 text-xs">
                          <TableHead className="font-semibold">Batch Number</TableHead>
                          <TableHead className="font-semibold">Product Name &amp; SKU</TableHead>
                          <TableHead className="font-semibold">Shelf Location</TableHead>
                          <TableHead className="font-semibold">Expiry &amp; Return Window</TableHead>
                          <TableHead className="font-semibold text-right">Cost Price</TableHead>
                          <TableHead className="font-semibold text-right">MRP</TableHead>
                          <TableHead className="font-semibold text-right pr-4">Available Units</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vendor.batches.map((b) => (
                          <TableRow key={b.id} className="hover:bg-muted/20 text-xs">
                            <TableCell className="font-mono font-bold">
                              #{b.batchNumber}
                            </TableCell>

                            <TableCell>
                              <div className="space-y-0.5">
                                <span className="font-semibold text-foreground block">
                                  {b.productName}
                                </span>
                                <span className="font-mono text-[11px] text-muted-foreground">
                                  {b.sku}
                                </span>
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="flex items-center gap-1 font-mono text-[11px]">
                                <MapPin className="h-3 w-3 text-amber-500" />
                                <span>{formatRack(b.rack) || 'Unassigned'}</span>
                                {b.box && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 font-mono">
                                    {b.box}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="space-y-0.5">
                                <span className="font-mono text-xs">
                                  {formatDate(new Date(b.expiryDate))}
                                </span>
                                {b.isNearExpiry ? (
                                  <Badge
                                    variant="destructive"
                                    className="gap-1 font-mono text-[9px] bg-amber-500/15 text-amber-600 border-amber-500/30"
                                  >
                                    <AlertTriangle className="h-2.5 w-2.5" />
                                    <span>Return Eligible (&lt;60d)</span>
                                  </Badge>
                                ) : (
                                  <span className="block text-[10px] text-muted-foreground">
                                    Healthy window
                                  </span>
                                )}
                              </div>
                            </TableCell>

                            <TableCell className="text-right font-mono text-muted-foreground">
                              {formatCurrency(b.costPrice)}
                            </TableCell>

                            <TableCell className="text-right font-mono font-semibold text-foreground">
                              {formatCurrency(b.mrp)}
                            </TableCell>

                            <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 pr-4">
                              {b.availableQuantity} units
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
