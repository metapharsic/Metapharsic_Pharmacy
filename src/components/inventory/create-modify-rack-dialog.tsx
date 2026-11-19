'use client'

import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  FolderOpen,
  LayoutGrid,
  Lock,
  Plus,
  Snowflake,
  Trash2,
  Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/lib/hooks/use-toast'

export type LocationTypeEnum =
  | 'GENERAL'
  | 'REFRIGERATED'
  | 'NARCOTICS_VAULT'
  | 'FAST_MOVING'
  | 'BULK_STORE'

interface CreateModifyRackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'modify'
  initialRackName?: string
  initialShelfName?: string
  initialType?: LocationTypeEnum
  branchId?: string
  onSaved: () => void
}

export function CreateModifyRackDialog({
  open,
  onOpenChange,
  mode,
  initialRackName = '',
  initialShelfName = 'Shelf 1',
  initialType = 'GENERAL',
  branchId,
  onSaved,
}: CreateModifyRackDialogProps) {
  const toast = useToast()
  const [rackName, setRackName] = useState('')
  const [newRackName, setNewRackName] = useState('')
  const [shelfName, setShelfName] = useState('Shelf 1')
  const [boxName, setBoxName] = useState('Box 01')
  const [storageType, setStorageType] = useState<LocationTypeEnum>('GENERAL')
  const [capacity, setCapacity] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (open) {
      setConfirmDelete(false)
      if (mode === 'modify') {
        setRackName(initialRackName)
        setNewRackName(initialRackName)
        setStorageType(initialType || 'GENERAL')
        setDescription('')
      } else {
        setRackName('')
        setNewRackName('')
        setShelfName(initialShelfName || 'Shelf 1')
        setBoxName('Box 01')
        setStorageType('GENERAL')
        setCapacity('')
        setDescription('')
      }
    }
  }, [open, mode, initialRackName, initialShelfName, initialType])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      if (mode === 'create') {
        if (!rackName.trim()) {
          toast.error('Rack name is required (e.g. RACK-A or FRIDGE-01)')
          setSaving(false)
          return
        }

        const res = await fetch('/api/inventory/racks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rack: rackName.trim().toUpperCase(),
            shelf: shelfName.trim() || 'Shelf 1',
            box: boxName.trim() || 'Box 01',
            type: storageType,
            capacity: capacity ? Number(capacity) : null,
            description: description.trim() || null,
            branchId: branchId && branchId !== 'all' ? branchId : undefined,
          }),
        })

        const json = await res.json()
        if (json.success) {
          toast.success(json.message || `Rack ${rackName.toUpperCase()} created successfully!`)
          onSaved()
          onOpenChange(false)
        } else {
          toast.error(json.error?.message || 'Failed to create rack')
        }
      } else {
        // Modify / Rename
        if (!newRackName.trim()) {
          toast.error('New Rack name cannot be empty')
          setSaving(false)
          return
        }

        const res = await fetch('/api/inventory/racks', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oldRackName: initialRackName,
            newRackName: newRackName.trim().toUpperCase(),
            type: storageType,
            description: description.trim() || null,
            branchId: branchId && branchId !== 'all' ? branchId : undefined,
          }),
        })

        const json = await res.json()
        if (json.success) {
          toast.success(json.message || `Rack updated to ${newRackName.toUpperCase()}!`)
          onSaved()
          onOpenChange(false)
        } else {
          toast.error(json.error?.message || 'Failed to modify rack')
        }
      }
    } catch {
      toast.error('Network error processing rack request')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/inventory/racks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rackName: initialRackName,
          branchId: branchId && branchId !== 'all' ? branchId : undefined,
        }),
      })

      const json = await res.json()
      if (json.success) {
        toast.success(json.message || `Rack ${initialRackName} removed.`)
        onSaved()
        onOpenChange(false)
      } else {
        toast.error(json.error?.message || 'Failed to delete rack')
      }
    } catch {
      toast.error('Network error deleting rack')
    } finally {
      setSaving(false)
      setConfirmDelete(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="space-y-1">
            <DialogTitle className="flex items-center gap-2 text-base">
              <LayoutGrid className="h-4 w-4 text-primary" />
              <span>
                {mode === 'create' ? 'Provision New Storage Rack' : `Modify / Rename Rack (${initialRackName})`}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {mode === 'create'
                ? 'Configure a physical storage rack with shelves and bins provisioned in the database.'
                : 'Rename this rack or adjust its storage classification. Updating the rack name cascades automatically to all medicines stored inside it.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-4 text-xs">
            {mode === 'create' ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="rack-name" className="text-xs font-semibold">
                    Rack Identifier / Code <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="rack-name"
                    value={rackName}
                    onChange={(e) => setRackName(e.target.value)}
                    placeholder="e.g. RACK-E, FRIDGE-INSULIN, NARCO-VAULT"
                    className="font-mono uppercase text-xs"
                    autoFocus
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Physical rack label printed on the shelf unit.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="shelf-tier" className="text-xs font-semibold">
                      Initial Shelf Tier
                    </Label>
                    <Input
                      id="shelf-tier"
                      value={shelfName}
                      onChange={(e) => setShelfName(e.target.value)}
                      placeholder="e.g. Shelf 1, Top Shelf"
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="box-name" className="text-xs font-semibold">
                      Initial Box / Bin
                    </Label>
                    <Input
                      id="box-name"
                      value={boxName}
                      onChange={(e) => setBoxName(e.target.value)}
                      placeholder="e.g. Box 01, Bin-A"
                      className="text-xs"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="rename-rack" className="text-xs font-semibold">
                    New Rack Identifier / Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="rename-rack"
                    value={newRackName}
                    onChange={(e) => setNewRackName(e.target.value)}
                    placeholder="e.g. RACK-A1 or FRIDGE-01"
                    className="font-mono uppercase text-xs"
                    autoFocus
                    required
                  />
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground flex items-center gap-1 mb-0.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      Transactional Cascade Enabled
                    </span>
                    Renaming will atomically update all products and batch locations currently in{' '}
                    <strong className="text-foreground">{initialRackName}</strong>.
                  </div>
                </div>
              </>
            )}

            {/* Storage Type Classification */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Storage Type Classification</Label>
              <Select
                value={storageType}
                onValueChange={(val) => setStorageType(val as LocationTypeEnum)}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select classification" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GENERAL">
                    <div className="flex items-center gap-2">
                      <Boxes className="h-3.5 w-3.5 text-blue-500" />
                      <span>General Storage (Room Temp 15°C - 25°C)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="REFRIGERATED">
                    <div className="flex items-center gap-2">
                      <Snowflake className="h-3.5 w-3.5 text-cyan-500" />
                      <span>Cold Chain Refrigerator (2°C - 8°C)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="NARCOTICS_VAULT">
                    <div className="flex items-center gap-2">
                      <Lock className="h-3.5 w-3.5 text-rose-500" />
                      <span>Narcotics Vault (Schedule H1 / X Locked)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="FAST_MOVING">
                    <div className="flex items-center gap-2">
                      <Zap className="h-3.5 w-3.5 text-amber-500" />
                      <span>Fast Moving / Front Counter Dispense</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="BULK_STORE">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-3.5 w-3.5 text-purple-500" />
                      <span>Bulk Store / Warehouse Carton Bin</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {mode === 'create' && (
              <div className="space-y-1.5">
                <Label htmlFor="capacity" className="text-xs font-semibold">
                  Capacity (Optional)
                </Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  placeholder="e.g. 50 boxes or 500 units"
                  className="text-xs"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="rack-desc" className="text-xs font-semibold">
                Notes / Location Description (Optional)
              </Label>
              <Input
                id="rack-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Aisle 2 left side, next to syrups"
                className="text-xs"
              />
            </div>

            {/* In Modify Mode: Delete Rack Option */}
            {mode === 'modify' && (
              <div className="pt-2 border-t border-border/50">
                {!confirmDelete ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDelete(true)}
                    className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive h-7 px-2"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    <span>Delete this Rack...</span>
                  </Button>
                ) : (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 space-y-2">
                    <div className="flex items-center gap-1.5 text-destructive font-semibold text-[11px]">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>Confirm Deletion of {initialRackName}?</span>
                    </div>
                    <p className="text-[10px] text-destructive/80">
                      Products in this rack will have their location unassigned.
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={saving}
                        onClick={() => void handleDelete()}
                        className="h-6 text-[10px] px-2"
                      >
                        Yes, Delete Rack
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmDelete(false)}
                        className="h-6 text-[10px] px-2"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between gap-2 border-t pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving} className="text-xs gap-1">
              {mode === 'create' ? (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  <span>{saving ? 'Creating…' : 'Create Rack'}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{saving ? 'Saving…' : 'Update Rack'}</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
