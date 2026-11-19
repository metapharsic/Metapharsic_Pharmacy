'use client'

import { useState, useEffect } from 'react'
import {
  Tag,
  Search,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Package,
  Percent,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/lib/hooks/use-toast'

interface HsnItem {
  id: string
  code: string
  description: string
  gstRate: number
  cgstRate: number
  sgstRate: number
  igstRate: number
  cessRate: number
  isActive: boolean
  _count?: { products: number }
}

export function HsnCodesTable() {
  const [items, setItems] = useState<HsnItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [search, setSearch] = useState<string>('')
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false)
  const [editingItem, setEditingItem] = useState<HsnItem | null>(null)
  const [saving, setSaving] = useState<boolean>(false)

  // Form states
  const [code, setCode] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [gstRate, setGstRate] = useState<string>('12')
  const [cessRate, setCessRate] = useState<string>('0')
  const [isActive, setIsActive] = useState<boolean>(true)

  const toast = useToast()

  const fetchHsnCodes = async () => {
    try {
      setLoading(true)
      const queryParams = new URLSearchParams()
      if (search.trim()) queryParams.set('search', search.trim())

      const res = await fetch(`/api/hsn-codes?${queryParams.toString()}`)
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setItems(json.data)
      } else {
        toast.error('Failed to load HSN codes')
      }
    } catch {
      toast.error('Network error loading HSN codes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchHsnCodes()
    }, 250)
    return () => clearTimeout(timer)
  }, [search])

  const handleOpenCreate = () => {
    setEditingItem(null)
    setCode('')
    setDescription('')
    setGstRate('12')
    setCessRate('0')
    setIsActive(true)
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (item: HsnItem) => {
    setEditingItem(item)
    setCode(item.code)
    setDescription(item.description)
    setGstRate(String(item.gstRate))
    setCessRate(String(item.cessRate))
    setIsActive(item.isActive)
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      if (editingItem) {
        // Update
        const res = await fetch(`/api/hsn-codes/${editingItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description,
            gstRate: parseFloat(gstRate),
            cessRate: parseFloat(cessRate) || 0,
            isActive,
          }),
        })
        const json = await res.json()
        if (json.success) {
          toast.success(`HSN code ${editingItem.code} updated`)
          setIsDialogOpen(false)
          fetchHsnCodes()
        } else {
          toast.error(json.error?.message || 'Failed to update HSN code')
        }
      } else {
        // Create
        const res = await fetch('/api/hsn-codes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: code.trim(),
            description: description.trim(),
            gstRate: parseFloat(gstRate),
            cessRate: parseFloat(cessRate) || 0,
          }),
        })
        const json = await res.json()
        if (json.success) {
          toast.success(`HSN code ${code} created successfully`)
          setIsDialogOpen(false)
          fetchHsnCodes()
        } else {
          toast.error(json.error?.message || 'Failed to create HSN code')
        }
      }
    } catch {
      toast.error('Network error saving HSN code')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (item: HsnItem) => {
    if (!confirm(`Are you sure you want to delete or deactivate HSN code ${item.code}?`)) return

    try {
      const res = await fetch(`/api/hsn-codes/${item.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        toast.success(json.message || 'HSN code removed')
        fetchHsnCodes()
      } else {
        toast.error(json.error?.message || 'Failed to delete HSN code')
      }
    } catch {
      toast.error('Network error deleting HSN code')
    }
  }

  return (
    <div className="space-y-4">
      {/* Header card with action buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by HSN code or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchHsnCodes}
            disabled={loading}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button type="button" size="sm" onClick={handleOpenCreate} className="gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" />
            Add HSN Code
          </Button>
        </div>
      </div>

      {/* Main Table Card */}
      <Card className="border-border/80 shadow-sm overflow-hidden">
        <CardHeader className="py-3 px-4 bg-muted/20 border-b border-border/60">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              Statutory GST Tariff &amp; HSN Classification
            </CardTitle>
            <span className="text-xs text-muted-foreground font-mono">
              {items.length} HSN Codes Configured
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40 text-muted-foreground font-medium">
                  <th className="py-2.5 px-4 font-semibold">HSN / SAC</th>
                  <th className="py-2.5 px-4 font-semibold">Description</th>
                  <th className="py-2.5 px-4 font-semibold text-center">GST Rate</th>
                  <th className="py-2.5 px-4 font-semibold text-center">Tax Split (CGST + SGST)</th>
                  <th className="py-2.5 px-4 font-semibold text-center">Active Products</th>
                  <th className="py-2.5 px-4 font-semibold text-center">Status</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {items.length > 0 ? (
                  items.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-foreground">
                        {item.code}
                      </td>
                      <td className="py-3 px-4 max-w-sm text-foreground">
                        <div className="truncate font-medium">{item.description}</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          variant="secondary"
                          className="font-mono text-xs px-2 py-0.5 bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30"
                        >
                          {item.gstRate}%
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-[11px] text-muted-foreground">
                        {item.cgstRate}% + {item.sgstRate}%
                        {item.cessRate > 0 && ` (+${item.cessRate}% Cess)`}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="outline" className="gap-1 font-mono text-[11px]">
                          <Package className="h-3 w-3 text-muted-foreground" />
                          {item._count?.products ?? 0}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {item.isActive ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 text-[10px] py-0">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/30 gap-1 text-[10px] py-0">
                            <XCircle className="h-2.5 w-2.5" />
                            Inactive
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => handleOpenEdit(item)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                            onClick={() => handleDelete(item)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      {loading ? 'Loading HSN codes from database...' : 'No HSN codes found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <Tag className="h-4 w-4 text-primary" />
                {editingItem ? `Edit HSN Code ${editingItem.code}` : 'Add Statutory HSN Code'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Configure GST tax rates and description according to Indian pharmaceutical tariff classifications.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3">
              <div className="space-y-1.5">
                <Label htmlFor="hsnCode" className="text-xs font-semibold">
                  HSN / SAC Code (e.g. 3004, 3002)
                </Label>
                <Input
                  id="hsnCode"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. 3004"
                  disabled={!!editingItem}
                  required
                  className="font-mono text-xs uppercase"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="hsnDesc" className="text-xs font-semibold">
                  Tariff Description
                </Label>
                <Input
                  id="hsnDesc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Medicaments for therapeutic or prophylactic uses"
                  required
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="gstRate" className="text-xs font-semibold">
                    GST Rate % (e.g. 0, 5, 12, 18)
                  </Label>
                  <Input
                    id="gstRate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={gstRate}
                    onChange={(e) => setGstRate(e.target.value)}
                    required
                    className="font-mono text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Auto-splits into CGST {(parseFloat(gstRate) || 0) / 2}% + SGST {(parseFloat(gstRate) || 0) / 2}%
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cessRate" className="text-xs font-semibold">
                    Cess Rate % (if applicable)
                  </Label>
                  <Input
                    id="cessRate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={cessRate}
                    onChange={(e) => setCessRate(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              {editingItem && (
                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="hsnActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="hsnActive" className="text-xs font-normal cursor-pointer">
                    Active for new products and billing calculations
                  </Label>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDialogOpen(false)}
                disabled={saving}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving} className="text-xs gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {saving ? 'Saving...' : editingItem ? 'Save Changes' : 'Create HSN Code'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
