'use client'

/**
 * Admin Edit Inventory Dialog
 * Restricted strictly to Admin users (enforced server-side + client-side badge).
 * Renders a full inventory item edit form with live Multi-Thread Status Strip showing
 * the 5 worker threads: RBAC Authority, Stock Integrity, Inventory Mutator, Rack Sync, Audit Ledger.
 */

import {
  CheckCircle2,
  Cpu,
  Edit,
  Lock,
  Loader2,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from 'lucide-react'
import React, { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/lib/hooks/use-toast'
import type { InventoryRow } from './inventory-table'

// ─── Thread Info Types ────────────────────────────────────────

interface ThreadInfo {
  threadId: string
  name: string
  pid: number
  status: 'COMPLETED' | 'RUNNING' | 'FAILED'
  executionDurationMs: number
  memoryUsageMb: number
}

const THREAD_DISPLAY_NAMES: Record<string, { label: string; color: string }> = {
  THREAD_ADMIN_RBAC_AUTHORITY:         { label: 'RBAC Authority',        color: 'text-violet-600'  },
  THREAD_STOCK_AND_CAS_INTEGRITY:      { label: 'Stock & CAS Integrity', color: 'text-blue-600'    },
  THREAD_TRANSACTIONAL_INVENTORY_MUTATOR: { label: 'Inventory Mutator', color: 'text-emerald-600' },
  THREAD_RACK_AND_STORAGE_SYNC:        { label: 'Rack Storage Sync',     color: 'text-amber-600'   },
  THREAD_AUDIT_LEDGER_AND_VALUATION:   { label: 'Audit Ledger',          color: 'text-rose-600'    },
}

// ─── Thread Status Strip ──────────────────────────────────────

function ThreadStatusStrip({ threads }: { threads: ThreadInfo[] | null }) {
  if (!threads || threads.length === 0) return null

  return (
    <div className="rounded-md border border-border/60 bg-muted/30 p-2 space-y-1.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          Multi-Thread Execution Status
        </span>
      </div>
      {threads.map((t) => {
        const display = THREAD_DISPLAY_NAMES[t.threadId] ?? { label: t.name, color: 'text-foreground' }
        const isOk = t.status === 'COMPLETED'
        const isFail = t.status === 'FAILED'
        return (
          <div
            key={t.threadId}
            className="flex items-center gap-2 rounded px-2 py-1 bg-background border border-border/40"
          >
            {isFail ? (
              <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
            ) : isOk ? (
              <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${display.color}`} />
            ) : (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
            )}
            <span className={`flex-1 text-[11px] font-medium ${display.color} truncate`}>
              {display.label}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono shrink-0">
              {t.executionDurationMs}ms
            </span>
            <Badge
              variant={isOk ? 'success' : isFail ? 'destructive' : 'default'}
              className="text-[10px] h-4 px-1.5"
            >
              {t.status}
            </Badge>
            <span className="text-[10px] text-muted-foreground font-mono shrink-0">
              {t.memoryUsageMb.toFixed(1)} MB
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Dialog ─────────────────────────────────────────────

export interface AdminEditInventoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  row: InventoryRow | null
  isAdmin: boolean
  onSaved?: () => void
}

interface EditFormState {
  name: string
  packSize: string
  tabsPerStrip: string
  mrp: string
  ptr: string
  costPrice: string
  availableQuantity: string
  minStockLevel: string
  reorderLevel: string
  rackId: string
  notes: string
}

export function AdminEditInventoryDialog({
  open,
  onOpenChange,
  row,
  isAdmin,
  onSaved,
}: AdminEditInventoryDialogProps) {
  const toast = useToast()
  const [form, setForm] = useState<EditFormState>({
    name: '',
    packSize: '',
    tabsPerStrip: '10',
    mrp: '',
    ptr: '',
    costPrice: '',
    availableQuantity: '',
    minStockLevel: '',
    reorderLevel: '',
    rackId: '',
    notes: '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [threads, setThreads] = useState<ThreadInfo[] | null>(null)
  const [merkleRoot, setMerkleRoot] = useState<string | null>(null)

  // Seed form when row changes
  useEffect(() => {
    if (row) {
      setForm({
        name: row.product.name || '',
        packSize: (row.product as { packSize?: string }).packSize || '',
        tabsPerStrip: String((row.product as { tabsPerStrip?: number }).tabsPerStrip || 10),
        mrp: String((row.product as { mrp?: number }).mrp || ''),
        ptr: String((row.product as { ptr?: number }).ptr || ''),
        costPrice: String((row.product as { costPrice?: number }).costPrice || ''),
        availableQuantity: String(row.availableQuantity || 0),
        minStockLevel: String(row.product.reorderLevel || 10),
        reorderLevel: String(row.product.reorderLevel || 10),
        rackId: (row.product as { rackId?: string }).rackId || '',
        notes: '',
      })
      setThreads(null)
      setMerkleRoot(null)
    }
  }, [row])

  const handleChange = (field: keyof EditFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!row || !isAdmin) return

    setIsSaving(true)
    setThreads(null)

    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim() || undefined,
        packSize: form.packSize.trim() || undefined,
        tabsPerStrip: form.tabsPerStrip ? parseInt(form.tabsPerStrip, 10) : undefined,
        mrp: form.mrp ? parseFloat(form.mrp) : undefined,
        ptr: form.ptr ? parseFloat(form.ptr) : undefined,
        costPrice: form.costPrice ? parseFloat(form.costPrice) : undefined,
        availableQuantity: form.availableQuantity !== '' ? parseInt(form.availableQuantity, 10) : undefined,
        minStockLevel: form.minStockLevel ? parseInt(form.minStockLevel, 10) : undefined,
        reorderLevel: form.reorderLevel ? parseInt(form.reorderLevel, 10) : undefined,
        rackId: form.rackId.trim() || null,
        notes: form.notes.trim() || undefined,
        isActive: true,
      }

      const res = await fetch(`/api/inventory/${row.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = (await res.json()) as {
        success?: boolean
        threads?: ThreadInfo[]
        merkleRoot?: string
        error?: { message?: string }
      }

      if (!res.ok || !data.success) {
        const msg = data.error?.message || 'Failed to update inventory item'
        throw new Error(msg)
      }

      setThreads(data.threads ?? null)
      setMerkleRoot(data.merkleRoot ?? null)
      toast.success(`${form.name || row.product.name} updated successfully`)
      onSaved?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toast.error(msg)
      if (msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('403')) {
        toast.error('Only Admin users can modify inventory items')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    if (!isSaving) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Edit className="h-4 w-4 text-primary" />
            Edit Inventory Item
            {isAdmin ? (
              <Badge variant="success" className="text-[10px] h-5 px-1.5">
                Admin
              </Badge>
            ) : (
              <Badge variant="destructive" className="text-[10px] h-5 px-1.5 flex items-center gap-1">
                <Lock className="h-2.5 w-2.5" />
                Admin Only
              </Badge>
            )}
          </DialogTitle>
          {row && (
            <p className="text-xs text-muted-foreground mt-0.5">
              ID: <span className="font-mono">{row.id}</span> &nbsp;·&nbsp; Product:{' '}
              <span className="font-mono">{row.productId}</span>
            </p>
          )}
        </DialogHeader>

        {!isAdmin && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3">
            <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">
              Modifying item inventory is strictly restricted to Admin users. You do not have the required role.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {/* Row 1: Name + Pack Size */}
          <div className="col-span-2 space-y-1">
            <Label htmlFor="inv-edit-name" className="text-xs">Medicine Name</Label>
            <Input
              id="inv-edit-name"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              disabled={!isAdmin || isSaving}
              placeholder="e.g., Paracetamol 500mg"
              className="text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="inv-edit-packSize" className="text-xs">Pack Size</Label>
            <Input
              id="inv-edit-packSize"
              value={form.packSize}
              onChange={(e) => handleChange('packSize', e.target.value)}
              disabled={!isAdmin || isSaving}
              placeholder="e.g., 10 Tablets"
              className="text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="inv-edit-tabs" className="text-xs">Tabs per Strip</Label>
            <Input
              id="inv-edit-tabs"
              type="number"
              min={1}
              value={form.tabsPerStrip}
              onChange={(e) => handleChange('tabsPerStrip', e.target.value)}
              disabled={!isAdmin || isSaving}
              className="text-sm"
            />
          </div>

          {/* Row 3: MRP / PTR / Cost */}
          <div className="space-y-1">
            <Label htmlFor="inv-edit-mrp" className="text-xs">MRP / Strip Price (₹)</Label>
            <Input
              id="inv-edit-mrp"
              type="number"
              min={0}
              step={0.01}
              value={form.mrp}
              onChange={(e) => handleChange('mrp', e.target.value)}
              disabled={!isAdmin || isSaving}
              className="text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="inv-edit-ptr" className="text-xs">PTR / Wholesale Price (₹)</Label>
            <Input
              id="inv-edit-ptr"
              type="number"
              min={0}
              step={0.01}
              value={form.ptr}
              onChange={(e) => handleChange('ptr', e.target.value)}
              disabled={!isAdmin || isSaving}
              className="text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="inv-edit-costPrice" className="text-xs">Cost Price (₹)</Label>
            <Input
              id="inv-edit-costPrice"
              type="number"
              min={0}
              step={0.01}
              value={form.costPrice}
              onChange={(e) => handleChange('costPrice', e.target.value)}
              disabled={!isAdmin || isSaving}
              className="text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="inv-edit-qty" className="text-xs">Available Stock (units)</Label>
            <Input
              id="inv-edit-qty"
              type="number"
              min={0}
              value={form.availableQuantity}
              onChange={(e) => handleChange('availableQuantity', e.target.value)}
              disabled={!isAdmin || isSaving}
              className="text-sm"
            />
          </div>

          {/* Min / Reorder */}
          <div className="space-y-1">
            <Label htmlFor="inv-edit-min" className="text-xs">Min Stock Level</Label>
            <Input
              id="inv-edit-min"
              type="number"
              min={0}
              value={form.minStockLevel}
              onChange={(e) => handleChange('minStockLevel', e.target.value)}
              disabled={!isAdmin || isSaving}
              className="text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="inv-edit-reorder" className="text-xs">Reorder Level</Label>
            <Input
              id="inv-edit-reorder"
              type="number"
              min={0}
              value={form.reorderLevel}
              onChange={(e) => handleChange('reorderLevel', e.target.value)}
              disabled={!isAdmin || isSaving}
              className="text-sm"
            />
          </div>

          {/* Rack */}
          <div className="col-span-2 space-y-1">
            <Label htmlFor="inv-edit-rack" className="text-xs">
              Rack ID{' '}
              <span className="text-muted-foreground font-normal">(optional — leave blank for chemist assignment)</span>
            </Label>
            <Input
              id="inv-edit-rack"
              value={form.rackId}
              onChange={(e) => handleChange('rackId', e.target.value)}
              disabled={!isAdmin || isSaving}
              placeholder="e.g., RACK-A3"
              className="text-sm"
            />
          </div>

          {/* Notes */}
          <div className="col-span-2 space-y-1">
            <Label htmlFor="inv-edit-notes" className="text-xs">Change Notes</Label>
            <Input
              id="inv-edit-notes"
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              disabled={!isAdmin || isSaving}
              placeholder="Reason for modification..."
              className="text-sm"
            />
          </div>
        </div>

        {/* Thread Status Strip (shown after save) */}
        <ThreadStatusStrip threads={threads} />

        {merkleRoot && (
          <p className="text-[10px] font-mono text-muted-foreground break-all">
            Integrity Hash: {merkleRoot}
          </p>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isAdmin || isSaving}
            className="gap-1.5"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving via {5} Threads…
              </>
            ) : threads ? (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                Save Again
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

