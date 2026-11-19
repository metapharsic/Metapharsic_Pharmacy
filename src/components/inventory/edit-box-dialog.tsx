'use client'

import { formatRack, formatShelf } from '@/lib/utils/rack'

import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Trash2,
} from 'lucide-react'
import { useEffect, useState } from 'react'

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
import { useToast } from '@/lib/hooks/use-toast'

interface EditBoxDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  location: {
    rack: string
    shelf: string
    box: string
  } | null
  branchId?: string
  onSaved: () => void
}

export function EditBoxDialog({
  open,
  onOpenChange,
  location,
  branchId,
  onSaved,
}: EditBoxDialogProps) {
  const toast = useToast()
  const [newBoxName, setNewBoxName] = useState('')
  const [capacity, setCapacity] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (location && open) {
      setNewBoxName(location.box)
      setCapacity('')
      setDescription('')
      setConfirmDelete(false)
    }
  }, [location, open])

  if (!location) return null

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBoxName.trim()) {
      toast.error('Box name cannot be empty')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/inventory/boxes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rack: location.rack,
          shelf: location.shelf,
          oldBoxName: location.box,
          newBoxName: newBoxName.trim(),
          capacity: capacity ? Number(capacity) : null,
          description: description.trim() || null,
          branchId: branchId && branchId !== 'all' ? branchId : undefined,
        }),
      })

      const json = await res.json()
      if (json.success) {
        toast.success(json.message || `Box renamed to "${newBoxName}"!`)
        onSaved()
        onOpenChange(false)
      } else {
        toast.error(json.error?.message || 'Failed to update box')
      }
    } catch {
      toast.error('Network error updating box')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/inventory/boxes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rack: location.rack,
          shelf: location.shelf,
          boxName: location.box,
          branchId: branchId && branchId !== 'all' ? branchId : undefined,
        }),
      })

      const json = await res.json()
      if (json.success) {
        toast.success(json.message || `Box "${location.box}" removed.`)
        onSaved()
        onOpenChange(false)
      } else {
        toast.error(json.error?.message || 'Failed to delete box')
      }
    } catch {
      toast.error('Network error deleting box')
    } finally {
      setSaving(false)
      setConfirmDelete(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleUpdate}>
          <DialogHeader className="space-y-1">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Boxes className="h-4 w-4 text-primary" />
              <span>Edit / Rename Box ({location.box})</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Physical Location:{' '}
              <strong className="text-foreground font-mono">
                {formatRack(location.rack)} &gt; {formatShelf(location.shelf)}
              </strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-4 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="box-new-name" className="text-xs font-semibold">
                Box / Bin Identifier <span className="text-destructive">*</span>
              </Label>
              <Input
                id="box-new-name"
                value={newBoxName}
                onChange={(e) => setNewBoxName(e.target.value)}
                placeholder="e.g. Box 01, Bin-Cold-A, Drawer 2"
                className="text-xs"
                autoFocus
                required
              />
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground flex items-center gap-1 mb-0.5">
                  <CheckCircle2 className="h-3 w-3 text-primary" />
                  Auto-Cascade Enabled
                </span>
                Renaming will atomically update the location on all medicines in this box.
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="box-capacity" className="text-xs font-semibold">
                Max Capacity (Units / Packs) (Optional)
              </Label>
              <Input
                id="box-capacity"
                type="number"
                min="1"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="e.g. 50 units"
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="box-notes" className="text-xs font-semibold">
                Box Notes / Labeling (Optional)
              </Label>
              <Input
                id="box-notes"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Antibiotic strips, pediatric syrups"
                className="text-xs"
              />
            </div>

            {/* Delete Box Section */}
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
                  <span>Delete this Box...</span>
                </Button>
              ) : (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 space-y-2">
                  <div className="flex items-center gap-1.5 text-destructive font-semibold text-[11px]">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>Confirm Deletion of {location.box}?</span>
                  </div>
                  <p className="text-[10px] text-destructive/80">
                    All medicines inside this box will have their box unassigned.
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
                      Yes, Delete Box
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
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{saving ? 'Updating…' : 'Update Box'}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
