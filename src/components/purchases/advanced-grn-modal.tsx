'use client'

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Package,
  ShieldAlert,
  Snowflake,
  Thermometer,
  Truck,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/lib/hooks/use-toast'
import { formatCurrency } from '@/lib/utils/currency'

interface PurchaseItemForGrn {
  id: string
  product: { id: string; name: string; sku: string; rack?: string | null; box?: string | null }
  orderedQuantity: number
  receivedQuantity: number
  freeQuantity?: number
  unitCost: number
  mrp?: number
}

interface PurchaseForGrn {
  id: string
  purchaseNumber: string
  branchId: string
  supplier?: { id: string; name: string } | null
  items: PurchaseItemForGrn[]
}

interface AdvancedGrnModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  purchase: PurchaseForGrn | null
  onSuccess?: () => void
}

export function AdvancedGrnModal({
  open,
  onOpenChange,
  purchase,
  onSuccess,
}: AdvancedGrnModalProps) {
  const toast = useToast()

  const [grnNumber, setGrnNumber] = useState('')
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState('')
  const [deliveryNoteDate, setDeliveryNoteDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [coldChainChecked, setColdChainChecked] = useState(false)
  const [receivedTemperature, setReceivedTemperature] = useState('4.0')
  const [temperatureExcursion, setTemperatureExcursion] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Item inspection details
  const [itemDetails, setItemDetails] = useState<
    Record<
      string,
      {
        batchNumber: string
        mfgDate: string
        expiryDate: string
        deliveredQty: number
        acceptedQty: number
        rejectedQty: number
        freeQty: number
        purchasePrice: number
        mrp: number
        rejectionReason: string
        storageRack: string
        storageBox: string
      }
    >
  >({})

  useEffect(() => {
    if (purchase) {
      setGrnNumber(`GRN-${Date.now().toString().slice(-6)}`)
      setDeliveryNoteNumber(`DN-${Date.now().toString().slice(-6)}`)

      const initial: Record<string, any> = {}
      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 2)
      const defaultExpiry = futureDate.toISOString().split('T')[0]

      purchase.items.forEach((item) => {
        const remaining = Math.max(0, item.orderedQuantity - item.receivedQuantity)
        initial[item.id] = {
          batchNumber: `BCH-${Math.floor(100000 + Math.random() * 900000)}`,
          mfgDate: new Date().toISOString().split('T')[0],
          expiryDate: defaultExpiry,
          deliveredQty: remaining,
          acceptedQty: remaining,
          rejectedQty: 0,
          freeQty: 0,
          purchasePrice: Number(item.unitCost) || 0,
          mrp: Number(item.mrp) || Math.round(Number(item.unitCost) * 1.3),
          rejectionReason: '',
          storageRack: item.product.rack || 'R1',
          storageBox: item.product.box || 'B1',
        }
      })
      setItemDetails(initial)
    }
  }, [purchase])

  if (!purchase) return null

  const handleUpdateItem = (itemId: string, field: string, value: any) => {
    setItemDetails((prev) => {
      const current = prev[itemId] || {}
      const updated = { ...current, [field]: value }

      // Auto balance accepted & rejected when delivered changes
      if (field === 'deliveredQty') {
        updated.acceptedQty = Math.max(0, value - (updated.rejectedQty || 0))
      } else if (field === 'rejectedQty') {
        updated.acceptedQty = Math.max(0, (updated.deliveredQty || 0) - value)
      } else if (field === 'acceptedQty') {
        updated.rejectedQty = Math.max(0, (updated.deliveredQty || 0) - value)
      }

      return { ...prev, [itemId]: updated }
    })
  }

  const handleAcceptAll = () => {
    setItemDetails((prev) => {
      const updated = { ...prev }
      purchase.items.forEach((item) => {
        const remaining = Math.max(0, item.orderedQuantity - item.receivedQuantity)
        updated[item.id] = {
          ...(updated[item.id] || {}),
          deliveredQty: remaining,
          acceptedQty: remaining,
          rejectedQty: 0,
        }
      })
      return updated
    })
    toast.success('Accepted all remaining ordered units')
  }

  const handleAutofillBatchCodes = () => {
    const year = new Date().getFullYear().toString().slice(-2)
    const futureDate = new Date()
    futureDate.setFullYear(futureDate.getFullYear() + 2)
    const defaultExpiry = futureDate.toISOString().split('T')[0]

    setItemDetails((prev) => {
      const updated = { ...prev }
      purchase.items.forEach((item) => {
        const randomNum = Math.floor(100000 + Math.random() * 900000)
        updated[item.id] = {
          ...(updated[item.id] || {}),
          batchNumber: `BCH-${year}-${randomNum}`,
          expiryDate: defaultExpiry,
        }
      })
      return updated
    })
    toast.success('Batch numbers and 2-year expiry dates populated')
  }

  const handleProcessGrn = async () => {
    if (!grnNumber.trim()) {
      toast.error('GRN number is required')
      return
    }

    setSubmitting(true)
    try {
      const itemsPayload = purchase.items.map((item) => {
        const det = itemDetails[item.id]
        return {
          purchaseItemId: item.id,
          batchNumber: det.batchNumber.trim().toUpperCase(),
          manufacturingDate: det.mfgDate ? new Date(det.mfgDate).toISOString() : undefined,
          expiryDate: new Date(det.expiryDate).toISOString(),
          deliveredQuantity: det.deliveredQty,
          acceptedQuantity: det.acceptedQty,
          rejectedQuantity: det.rejectedQty,
          freeQuantity: det.freeQty,
          purchasePrice: det.purchasePrice,
          mrp: det.mrp,
          qualityCheckPassed: det.rejectedQty === 0,
          rejectionReason: det.rejectedQty > 0 ? det.rejectionReason : undefined,
          storageRack: det.storageRack,
          storageBox: det.storageBox,
        }
      })

      const res = await fetch(`/api/purchases/${purchase.id}/advanced-grn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: purchase.branchId || 'main-branch',
          grnNumber: grnNumber.trim(),
          deliveryNoteNumber: deliveryNoteNumber.trim() || undefined,
          deliveryNoteDate: new Date(deliveryNoteDate).toISOString(),
          coldChainChecked,
          receivedTemperature: coldChainChecked ? parseFloat(receivedTemperature) : undefined,
          temperatureExcursion,
          items: itemsPayload,
        }),
      })

      const json = await res.json()
      if (json.success) {
        toast.success(
          `Goods Receipt ${json.data.grnNumber} posted! Accepted: ${json.data.totalAccepted} units added to live stock. Quarantined: ${json.data.totalRejected} units.`
        )
        onOpenChange(false)
        onSuccess?.()
      } else {
        toast.error(json.error?.message || 'Goods receipt failed')
      }
    } catch {
      toast.error('Goods receipt failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Truck className="h-5 w-5 text-emerald-600" />
                Advanced Goods Receipt Note (GRN) & Physical Inspection
              </DialogTitle>
              <DialogDescription>
                Records physical dock arrival against PO {purchase.purchaseNumber}. Distinguishes accepted usable inventory from rejected/quarantine stock with cold-chain verification.
              </DialogDescription>
            </div>
            <div className="font-mono text-xs text-muted-foreground pr-6">
              Supplier: <span className="font-semibold text-foreground">{purchase.supplier?.name}</span>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 text-xs">
          {/* GRN & Delivery Note Header */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 rounded-lg border border-border/60 bg-muted/20 p-3">
            <div className="space-y-1">
              <Label className="text-xs">GRN Number *</Label>
              <Input
                value={grnNumber}
                onChange={(e) => setGrnNumber(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Delivery Note / Challan #</Label>
              <Input
                value={deliveryNoteNumber}
                onChange={(e) => setDeliveryNoteNumber(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Delivery Date</Label>
              <Input
                type="date"
                value={deliveryNoteDate}
                onChange={(e) => setDeliveryNoteDate(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1 flex flex-col justify-end">
              <label className="flex items-center gap-2 font-medium cursor-pointer py-2">
                <input
                  type="checkbox"
                  checked={coldChainChecked}
                  onChange={(e) => setColdChainChecked(e.target.checked)}
                  className="rounded border-border"
                />
                <Snowflake className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                <span>Cold-Chain Product</span>
              </label>
            </div>
          </div>

          {/* Cold-Chain Temperature Logger */}
          {coldChainChecked && (
            <div className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Thermometer className="h-5 w-5 text-cyan-600" />
                <div>
                  <div className="font-semibold text-cyan-950 dark:text-cyan-200">
                    Cold-Chain Dock Temperature Log
                  </div>
                  <div className="text-[11px] text-cyan-800 dark:text-cyan-300">
                    Standard vaccine / biologics range: 2.0°C to 8.0°C. Excursions automatically trigger quarantine.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs">Dock Temp (°C):</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={receivedTemperature}
                    onChange={(e) => {
                      const temp = parseFloat(e.target.value)
                      setReceivedTemperature(e.target.value)
                      if (!isNaN(temp) && (temp < 2 || temp > 8)) {
                        setTemperatureExcursion(true)
                      } else {
                        setTemperatureExcursion(false)
                      }
                    }}
                    className="w-20 h-8 font-mono text-xs"
                  />
                </div>
                <label className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={temperatureExcursion}
                    onChange={(e) => setTemperatureExcursion(e.target.checked)}
                    className="rounded border-border"
                  />
                  <span>Flag Excursion & Quarantine</span>
                </label>
              </div>
            </div>
          )}

          {/* Dock Inspection Quick Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
              <Package className="h-4 w-4 text-primary" />
              Receipt Verification & QC Quarantine Segregation
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 gap-1"
                onClick={handleAcceptAll}
              >
                <CheckCircle2 className="h-3 w-3" />
                Accept All Delivered Qty
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={handleAutofillBatchCodes}
              >
                <Package className="h-3 w-3" />
                Autofill Batch Codes & Expiry
              </Button>
            </div>
          </div>

          {/* Line Items Receiving & Inspection Table */}
          <div className="rounded-lg border border-border/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 text-xs">
                  <TableHead>Medicine</TableHead>
                  <TableHead>Batch # & Expiry</TableHead>
                  <TableHead className="text-right">Ordered / Bal</TableHead>
                  <TableHead className="text-right font-bold">Delivered</TableHead>
                  <TableHead className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                    Accepted (Usable)
                  </TableHead>
                  <TableHead className="text-right font-bold text-rose-600 dark:text-rose-400">
                    Rejected (Quarantine)
                  </TableHead>
                  <TableHead className="text-right">Free Scheme</TableHead>
                  <TableHead>Storage Rack & Box</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchase.items.map((item) => {
                  const det = itemDetails[item.id] || {
                    batchNumber: '',
                    mfgDate: '',
                    expiryDate: '',
                    deliveredQty: 0,
                    acceptedQty: 0,
                    rejectedQty: 0,
                    freeQty: 0,
                    storageRack: 'R1',
                    storageBox: 'B1',
                  }
                  const remaining = Math.max(0, item.orderedQuantity - item.receivedQuantity)

                  return (
                    <TableRow key={item.id} className="text-xs">
                      <TableCell className="max-w-[160px]">
                        <div className="font-semibold text-foreground truncate">{item.product.name}</div>
                        <div className="text-[10px] text-muted-foreground">{item.product.sku}</div>
                      </TableCell>
                      <TableCell className="space-y-1">
                        <Input
                          value={det.batchNumber}
                          onChange={(e) => handleUpdateItem(item.id, 'batchNumber', e.target.value)}
                          placeholder="Batch Number"
                          className="h-6 w-28 font-mono text-[11px] font-bold uppercase"
                        />
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">Exp:</span>
                          <Input
                            type="date"
                            value={det.expiryDate}
                            onChange={(e) => handleUpdateItem(item.id, 'expiryDate', e.target.value)}
                            className="h-6 w-28 text-[10px]"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div>{item.orderedQuantity} ordered</div>
                        <div className="text-[10px] text-muted-foreground">
                          {remaining} outstanding
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0"
                          value={det.deliveredQty}
                          onChange={(e) =>
                            handleUpdateItem(item.id, 'deliveredQty', parseInt(e.target.value, 10) || 0)
                          }
                          className="h-7 w-16 text-right font-bold text-xs"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0"
                          value={det.acceptedQty}
                          onChange={(e) =>
                            handleUpdateItem(item.id, 'acceptedQty', parseInt(e.target.value, 10) || 0)
                          }
                          className="h-7 w-16 text-right font-bold text-xs border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        />
                      </TableCell>
                      <TableCell className="text-right space-y-1">
                        <Input
                          type="number"
                          min="0"
                          value={det.rejectedQty}
                          onChange={(e) =>
                            handleUpdateItem(item.id, 'rejectedQty', parseInt(e.target.value, 10) || 0)
                          }
                          className={`h-7 w-16 text-right font-bold text-xs ${
                            det.rejectedQty > 0
                              ? 'border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                              : ''
                          }`}
                        />
                        {det.rejectedQty > 0 && (
                          <Input
                            value={det.rejectionReason}
                            onChange={(e) =>
                              handleUpdateItem(item.id, 'rejectionReason', e.target.value)
                            }
                            placeholder="Rejection reason…"
                            className="h-6 w-28 text-[10px]"
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0"
                          value={det.freeQty}
                          onChange={(e) =>
                            handleUpdateItem(item.id, 'freeQty', parseInt(e.target.value, 10) || 0)
                          }
                          className="h-7 w-16 text-right text-xs"
                        />
                      </TableCell>
                      <TableCell className="space-y-1">
                        <div className="flex items-center gap-1">
                          <Input
                            value={det.storageRack}
                            onChange={(e) => handleUpdateItem(item.id, 'storageRack', e.target.value)}
                            placeholder="Rack"
                            className="h-6 w-14 font-mono text-[10px] uppercase"
                          />
                          <Input
                            value={det.storageBox}
                            onChange={(e) => handleUpdateItem(item.id, 'storageBox', e.target.value)}
                            placeholder="Box"
                            className="h-6 w-14 font-mono text-[10px]"
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleProcessGrn()}
            disabled={submitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
          >
            <Package className="h-4 w-4" />
            {submitting ? 'Inspecting & Receiving…' : 'Confirm Receipt & Add to Stock'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
