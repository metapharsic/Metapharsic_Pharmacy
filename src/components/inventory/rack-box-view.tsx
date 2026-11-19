'use client'

import {
  AlertCircle,
  Boxes,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  LayoutGrid,
  MapPin,
  MinusCircle,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { AssignMedicineDialog } from '@/components/inventory/assign-medicine-dialog'
import { CreateModifyRackDialog } from '@/components/inventory/create-modify-rack-dialog'
import { EditBoxDialog } from '@/components/inventory/edit-box-dialog'
import { EditLocationDialog } from '@/components/inventory/edit-location-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/lib/hooks/use-toast'
import type {
  BoxItem,
  BoxProductItem,
  RackBoxMatrixResult,
  RackItem,
} from '@/lib/inventory/inventory-analytics-service'
import { formatCurrency } from '@/lib/utils/currency'

interface RackBoxViewProps {
  branchId: string
  onSelectProduct?: (productId: string) => void
}

export function RackBoxView({ branchId, onSelectProduct }: RackBoxViewProps) {
  const toast = useToast()
  const [data, setData] = useState<RackBoxMatrixResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedRacks, setExpandedRacks] = useState<Record<string, boolean>>({})
  const [selectedBox, setSelectedBox] = useState<{
    rackName: string
    shelfName: string
    box: BoxItem
  } | null>(null)

  // Product relocation dialog state
  const [editProduct, setEditProduct] = useState<{
    id: string
    name: string
    sku: string
    rack?: string | null
    shelf?: string | null
    box?: string | null
  } | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  // Rack Provision & Modify Dialog state
  const [rackDialogOpen, setRackDialogOpen] = useState(false)
  const [rackDialogMode, setRackDialogMode] = useState<'create' | 'modify'>('create')
  const [activeRackName, setActiveRackName] = useState('')
  const [activeShelfName, setActiveShelfName] = useState('Shelf 1')

  // Box Edit Dialog state
  const [editBoxOpen, setEditBoxOpen] = useState(false)
  const [editBoxLocation, setEditBoxLocation] = useState<{
    rack: string
    shelf: string
    box: string
  } | null>(null)

  // Assign Medicine Dialog state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [assignTarget, setAssignTarget] = useState<{
    rack: string
    shelf: string
    box: string
  } | null>(null)

  // Unassign loading state
  const [unassigningId, setUnassigningId] = useState<string | null>(null)

  const loadMatrix = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (branchId && branchId !== 'all') params.set('branchId', branchId)

      const res = await fetch(`/api/inventory/locations?${params.toString()}`)
      const json = await res.json()
      if (json.success && json.data) {
        setData(json.data as RackBoxMatrixResult)
        // Expand first two racks by default
        const initExpanded: Record<string, boolean> = {}
        const racks = (json.data as RackBoxMatrixResult).racks
        if (racks.length > 0) initExpanded[racks[0].rackName] = true
        if (racks.length > 1) initExpanded[racks[1].rackName] = true
        setExpandedRacks((prev) => (Object.keys(prev).length === 0 ? initExpanded : prev))

        // If a box is currently selected, refresh its reference
        if (selectedBox) {
          const matchingRack = (json.data as RackBoxMatrixResult).racks.find(
            (r) => r.rackName === selectedBox.rackName
          )
          const matchingShelf = matchingRack?.shelves.find(
            (s) => s.shelfName === selectedBox.shelfName
          )
          const matchingBox = matchingShelf?.boxes.find(
            (b) => b.boxName === selectedBox.box.boxName
          )
          if (matchingBox && matchingRack && matchingShelf) {
            setSelectedBox({
              rackName: matchingRack.rackName,
              shelfName: matchingShelf.shelfName,
              box: matchingBox,
            })
          }
        }
      } else {
        toast.error('Failed to load storage rack locations')
      }
    } catch {
      toast.error('Network error loading locations')
    } finally {
      setLoading(false)
    }
  }, [branchId, toast, selectedBox])

  useEffect(() => {
    void loadMatrix()
  }, [branchId])

  const toggleRack = (rackName: string) => {
    setExpandedRacks((prev) => ({ ...prev, [rackName]: !prev[rackName] }))
  }

  // Remove/Unassign a medicine from a box
  const handleUnassignMedicine = async (productId: string, productName: string) => {
    setUnassigningId(productId)
    try {
      const res = await fetch('/api/inventory/locations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          rack: null,
          shelf: null,
          box: null,
        }),
      })

      const json = await res.json()
      if (json.success) {
        toast.success(`Removed "${productName}" from box location`)
        await loadMatrix()
      } else {
        toast.error(json.error?.message || 'Failed to unassign medicine')
      }
    } catch {
      toast.error('Network error unassigning medicine')
    } finally {
      setUnassigningId(null)
    }
  }

  // Filter matrix by search text
  const filteredRacks = (data?.racks || [])
    .map((rack) => {
      if (!search.trim()) return rack

      const q = search.toLowerCase()
      const matchingShelves = rack.shelves
        .map((shelf) => {
          const matchingBoxes = shelf.boxes.filter((box) => {
            if (box.boxName.toLowerCase().includes(q)) return true
            return box.products.some(
              (p) =>
                p.name.toLowerCase().includes(q) ||
                p.sku.toLowerCase().includes(q) ||
                (p.barcode && p.barcode.toLowerCase().includes(q))
            )
          })
          return { ...shelf, boxes: matchingBoxes }
        })
        .filter((shelf) => shelf.boxes.length > 0)

      return {
        ...rack,
        shelves: matchingShelves,
      }
    })
    .filter(
      (rack) => rack.shelves.length > 0 || rack.rackName.toLowerCase().includes(search.toLowerCase())
    )

  return (
    <div className="space-y-4">
      {/* Rack & Box Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-gradient-to-r from-card to-background p-4 shadow-xs">
        <div className="space-y-1">
          <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-primary" />
            <span>Rack &amp; Box Physical Location Map</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Simplify pharmacy shelf management — provision physical Racks, Shelves, and Boxes with instant inventory valuations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Rack, Shelf, Box, medicine…"
              className="pl-8 h-8 text-xs"
            />
          </div>

          <Button
            size="sm"
            onClick={() => {
              setRackDialogMode('create')
              setActiveRackName('')
              setActiveShelfName('Shelf 1')
              setRackDialogOpen(true)
            }}
            className="h-8 gap-1.5 text-xs bg-primary text-primary-foreground font-semibold shadow-xs hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create New Rack</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadMatrix()}
            disabled={loading}
            className="h-8 gap-1 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Unassigned Medicines Banner if any exist */}
      {data && data.unassignedCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <span className="font-semibold text-xs">
                {data.unassignedCount} medicines have no storage location assigned
              </span>
              <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                Assign them to a Rack and Box to ensure faster dispensing and accurate shelf valuation.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (data.unassignedProducts.length > 0) {
                const first = data.unassignedProducts[0]
                setEditProduct({ id: first.id, name: first.name, sku: first.sku })
                setEditOpen(true)
              }
            }}
            className="h-7 text-xs bg-background/80 border-amber-500/40 text-amber-900 dark:text-amber-100 font-medium"
          >
            <Plus className="h-3 w-3 mr-1" />
            <span>Assign Next Item</span>
          </Button>
        </div>
      )}

      {/* Racks & Boxes Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
              <Skeleton className="h-5 w-36" />
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-20 w-full rounded-lg" />
                <Skeleton className="h-20 w-full rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredRacks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-8 text-center space-y-3">
          <Boxes className="h-8 w-8 text-muted-foreground/60 mx-auto" />
          <p className="text-sm font-semibold text-foreground">No rack locations found</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            You can create dedicated racks (like RACK-A, COLD-STORAGE, NARCOTICS-SAFE) to organize your pharmacy stock into shelf tiers and bins with live valuations.
          </p>
          <Button
            size="sm"
            onClick={() => {
              setRackDialogMode('create')
              setActiveRackName('')
              setActiveShelfName('Shelf 1')
              setRackDialogOpen(true)
            }}
            className="text-xs gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create Your First Storage Rack</span>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredRacks.map((rack) => {
            const isExpanded = expandedRacks[rack.rackName] ?? false
            return (
              <div
                key={rack.rackName}
                className="rounded-xl border border-border/70 bg-card shadow-xs overflow-hidden transition-all hover:border-primary/40"
              >
                {/* Rack Header with Total Rack Valuation */}
                <div
                  onClick={() => toggleRack(rack.rackName)}
                  className="flex items-center justify-between p-3.5 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border/50"
                >
                  <div className="flex items-center gap-2">
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
                        <span className="font-mono text-xs font-bold text-foreground">
                          {rack.rackName}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5 px-1.5 py-0 h-4"
                        >
                          MRP {formatCurrency(rack.totalValuationAtMrp)}
                        </Badge>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {rack.totalProducts} medicines · {rack.totalUnits} units · Cost:{' '}
                        {formatCurrency(rack.totalValuationAtCost)}
                      </span>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {rack.shelves.length} {rack.shelves.length === 1 ? 'shelf' : 'shelves'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setRackDialogMode('modify')
                        setActiveRackName(rack.rackName)
                        setRackDialogOpen(true)
                      }}
                      title="Modify / Rename Rack"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-background/80"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Shelves & Boxes Inside Rack */}
                {isExpanded && (
                  <div className="p-3.5 space-y-4">
                    {rack.shelves.map((shelf) => (
                      <div key={shelf.shelfName} className="space-y-2.5">
                        {/* Shelf Header with Total Shelf Valuation */}
                        <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground border-b border-border/40 pb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1.5 font-semibold text-foreground">
                              <FolderOpen className="h-3.5 w-3.5 text-amber-500" />
                              {shelf.shelfName}
                            </span>
                            <span className="text-[10px] font-mono">
                              ({shelf.boxes.length} {shelf.boxes.length === 1 ? 'box' : 'boxes'} · {shelf.totalUnits} units)
                            </span>
                            <span className="text-[10px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(shelf.totalValuationAtMrp)}
                            </span>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setRackDialogMode('create')
                              setActiveRackName(rack.rackName)
                              setActiveShelfName(shelf.shelfName)
                              setRackDialogOpen(true)
                            }}
                            className="h-5 px-1.5 text-[10px] text-primary hover:text-primary gap-1 font-medium"
                            title="Add Box into this Shelf Tier"
                          >
                            <Plus className="h-2.5 w-2.5" />
                            <span>Add Box</span>
                          </Button>
                        </div>

                        {/* Boxes Grid with Box Stock Valuation */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                          {shelf.boxes.map((box) => (
                            <div
                              key={box.boxName}
                              onClick={() =>
                                setSelectedBox({
                                  rackName: rack.rackName,
                                  shelfName: shelf.shelfName,
                                  box,
                                })
                              }
                              className="cursor-pointer group relative rounded-xl border border-border/70 bg-gradient-to-br from-background to-muted/20 p-2.5 hover:border-primary hover:bg-primary/5 transition-all shadow-2xs"
                            >
                              <div className="flex items-start justify-between gap-1 mb-1">
                                <span className="font-mono text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                                  {box.boxName}
                                </span>
                                <div
                                  className="flex items-center gap-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Badge
                                    variant="secondary"
                                    className="text-[9px] px-1 py-0 h-4 font-mono leading-none"
                                  >
                                    {box.productCount} skus
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditBoxLocation({
                                        rack: rack.rackName,
                                        shelf: shelf.shelfName,
                                        box: box.boxName,
                                      })
                                      setEditBoxOpen(true)
                                    }}
                                    className="h-4 w-4 p-0 text-muted-foreground hover:text-foreground opacity-60 group-hover:opacity-100"
                                    title="Edit / Rename Box"
                                  >
                                    <Pencil className="h-2.5 w-2.5" />
                                  </Button>
                                </div>
                              </div>

                              <div className="space-y-0.5 pt-1 border-t border-border/30">
                                <div className="flex items-center justify-between text-[11px] font-mono">
                                  <span className="text-muted-foreground">{box.totalUnits} units</span>
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                    {formatCurrency(box.totalValuationAtMrp)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-muted-foreground/70 font-mono">
                                  <span>Cost Val:</span>
                                  <span>{formatCurrency(box.totalValuationAtCost)}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Selected Box Drawer / Product List Modal with Financial Summary and CRUD */}
      {selectedBox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-xl border border-border/80 bg-card p-5 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            {/* Box Header with Breadcrumb and Actions */}
            <div className="flex items-start justify-between border-b pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-primary">
                    {selectedBox.rackName} &gt; {selectedBox.shelfName} &gt; {selectedBox.box.boxName}
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {selectedBox.box.productCount} medicines · {selectedBox.box.totalUnits} units
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Physical medicines and financial inventory stored inside this box
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAssignTarget({
                      rack: selectedBox.rackName,
                      shelf: selectedBox.shelfName,
                      box: selectedBox.box.boxName,
                    })
                    setAssignDialogOpen(true)
                  }}
                  className="h-7 text-xs gap-1 font-semibold text-primary border-primary/30 hover:bg-primary/10"
                >
                  <Plus className="h-3 w-3" />
                  <span>Assign Medicine</span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditBoxLocation({
                      rack: selectedBox.rackName,
                      shelf: selectedBox.shelfName,
                      box: selectedBox.box.boxName,
                    })
                    setEditBoxOpen(true)
                  }}
                  className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  title="Rename or Edit Box Details"
                >
                  <Pencil className="h-3 w-3" />
                  <span>Edit Box</span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedBox(null)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground ml-1"
                >
                  &times;
                </Button>
              </div>
            </div>

            {/* Financial Valuation Summary Bar for this Box */}
            <div className="grid grid-cols-4 gap-2.5 rounded-lg border border-border/60 bg-muted/20 p-2.5 text-center text-xs">
              <div>
                <span className="text-[10px] uppercase text-muted-foreground font-semibold block">
                  Total MRP Value
                </span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  {formatCurrency(selectedBox.box.totalValuationAtMrp)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-muted-foreground font-semibold block">
                  Total Cost Value
                </span>
                <span className="font-mono font-bold text-foreground text-sm">
                  {formatCurrency(selectedBox.box.totalValuationAtCost)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-muted-foreground font-semibold block">
                  Total Stock Units
                </span>
                <span className="font-mono font-bold text-foreground text-sm">
                  {selectedBox.box.totalUnits}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-muted-foreground font-semibold block">
                  Product SKUs
                </span>
                <span className="font-mono font-bold text-foreground text-sm">
                  {selectedBox.box.productCount}
                </span>
              </div>
            </div>

            {/* Medicines List in this Box */}
            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {selectedBox.box.products.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/70 p-6 text-center text-muted-foreground space-y-2">
                  <Boxes className="h-6 w-6 mx-auto opacity-50" />
                  <p className="text-xs font-semibold">This box is currently empty</p>
                  <p className="text-[11px]">
                    Click &ldquo;Assign Medicine&rdquo; above to place medicines directly into this box.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAssignTarget({
                        rack: selectedBox.rackName,
                        shelf: selectedBox.shelfName,
                        box: selectedBox.box.boxName,
                      })
                      setAssignDialogOpen(true)
                    }}
                    className="h-7 text-xs gap-1 font-semibold text-primary"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Assign First Medicine</span>
                  </Button>
                </div>
              ) : (
                selectedBox.box.products.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 p-2.5 text-xs hover:bg-muted/40 transition-colors"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{p.name}</span>
                        {p.availableStock <= p.reorderLevel && (
                          <Badge
                            variant="destructive"
                            className="text-[9px] px-1 py-0 h-4 font-mono"
                          >
                            Low Stock
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                        <span>SKU: {p.sku}</span>
                        {p.barcode && <span>· Barcode: {p.barcode}</span>}
                        <span>· MRP: {formatCurrency(p.mrp)}</span>
                        <span>· Cost: {formatCurrency(p.costPrice)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right font-mono">
                        <span className="font-bold text-foreground block">
                          {p.availableStock} units
                        </span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                          Val: {formatCurrency(p.totalMrpValue)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditProduct({
                              id: p.id,
                              name: p.name,
                              sku: p.sku,
                              rack: p.rack,
                              shelf: p.shelf,
                              box: p.box,
                            })
                            setEditOpen(true)
                          }}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          title="Relocate medicine to another rack/box"
                        >
                          <SlidersHorizontal className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={unassigningId === p.id}
                          onClick={() => void handleUnassignMedicine(p.id, p.name)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          title="Remove from this Box (Unassign location)"
                        >
                          <MinusCircle className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-[11px] text-muted-foreground font-mono">
                Box Inventory Valuation Rollup
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedBox(null)}
                className="text-xs"
              >
                Close Box View
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Product Relocation Dialog */}
      <EditLocationDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        product={editProduct}
        onSaved={() => {
          void loadMatrix()
        }}
      />

      {/* Rack Create / Modify Dialog */}
      <CreateModifyRackDialog
        open={rackDialogOpen}
        onOpenChange={setRackDialogOpen}
        mode={rackDialogMode}
        initialRackName={activeRackName}
        initialShelfName={activeShelfName}
        branchId={branchId}
        onSaved={() => {
          void loadMatrix()
        }}
      />

      {/* Box Edit Dialog */}
      <EditBoxDialog
        open={editBoxOpen}
        onOpenChange={setEditBoxOpen}
        location={editBoxLocation}
        branchId={branchId}
        onSaved={() => {
          void loadMatrix()
        }}
      />

      {/* Assign Medicine Dialog */}
      <AssignMedicineDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        targetLocation={assignTarget}
        onAssigned={() => {
          void loadMatrix()
        }}
      />
    </div>
  )
}
