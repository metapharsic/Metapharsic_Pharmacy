'use client'

import React, { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Plus, Trash2, Wand2 } from 'lucide-react'

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
import type { BillAllocationInput, BillRefType } from '@/lib/vouchers/voucher-validations'

export interface UnpaidInvoice {
  id: string
  invoiceNumber: string
  saleDate: string | Date
  totalAmount: number
  amountPaid: number
  balanceDue: number
  paymentStatus: string
}

interface BillAllocationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerName: string
  outstandingBalance: number
  voucherAmount: number
  unpaidInvoices: UnpaidInvoice[]
  allocations: BillAllocationInput[]
  onSaveAllocations: (allocations: BillAllocationInput[]) => void
}

export function BillAllocationModal({
  open,
  onOpenChange,
  customerName,
  outstandingBalance,
  voucherAmount,
  unpaidInvoices,
  allocations: initialAllocations,
  onSaveAllocations,
}: BillAllocationModalProps) {
  const [rows, setRows] = useState<BillAllocationInput[]>([])

  // Reset or load initial allocations when modal opens
  useEffect(() => {
    if (open) {
      if (initialAllocations && initialAllocations.length > 0) {
        setRows([...initialAllocations])
      } else if (unpaidInvoices.length > 0 && voucherAmount > 0) {
        // Run auto FIFO by default if starting fresh
        handleAutoFifo()
      } else if (voucherAmount > 0) {
        // If no unpaid invoices, allocate as On Account
        setRows([
          {
            refType: 'ON_ACCOUNT',
            refNumber: 'ON-ACCOUNT',
            invoiceId: null,
            allocatedAmount: voucherAmount,
          },
        ])
      } else {
        setRows([])
      }
    }
  }, [open, initialAllocations, unpaidInvoices, voucherAmount])

  // FIFO Auto-allocation algorithm
  const handleAutoFifo = () => {
    if (voucherAmount <= 0) return

    let remaining = voucherAmount
    const newRows: BillAllocationInput[] = []

    // 1. Sort invoices by saleDate ascending (FIFO)
    const sortedInvoices = [...unpaidInvoices].sort(
      (a, b) => new Date(a.saleDate).getTime() - new Date(b.saleDate).getTime()
    )

    for (const inv of sortedInvoices) {
      if (remaining <= 0.001) break

      const due = Number(inv.balanceDue)
      const allocAmount = Math.min(remaining, due)
      const roundedAlloc = Math.round(allocAmount * 100) / 100

      if (roundedAlloc > 0) {
        newRows.push({
          refType: 'AGST_REF',
          invoiceId: inv.id,
          refNumber: inv.invoiceNumber,
          allocatedAmount: roundedAlloc,
        })
        remaining = Math.max(0, Math.round((remaining - roundedAlloc) * 100) / 100)
      }
    }

    // 2. If surplus remains after settling all invoices, allocate remainder as Advance / On Account
    if (remaining > 0.001) {
      newRows.push({
        refType: 'ADVANCE',
        invoiceId: null,
        refNumber: 'ADVANCE',
        allocatedAmount: Math.round(remaining * 100) / 100,
      })
    }

    setRows(newRows)
  }

  const handleAddRow = () => {
    const totalAllocated = rows.reduce((acc, r) => acc + (Number(r.allocatedAmount) || 0), 0)
    const diff = Math.max(0, Math.round((voucherAmount - totalAllocated) * 100) / 100)

    setRows([
      ...rows,
      {
        refType: unpaidInvoices.length > 0 ? 'AGST_REF' : 'ON_ACCOUNT',
        invoiceId: unpaidInvoices[0]?.id || null,
        refNumber: unpaidInvoices[0]?.invoiceNumber || 'ON-ACCOUNT',
        allocatedAmount: diff > 0 ? diff : 0,
      },
    ])
  }

  const handleRemoveRow = (index: number) => {
    setRows(rows.filter((_, i) => i !== index))
  }

  const handleUpdateRow = (index: number, updates: Partial<BillAllocationInput>) => {
    const updated = [...rows]
    const current = { ...updated[index], ...updates }

    // If invoice changed, sync refNumber
    if (updates.invoiceId) {
      const inv = unpaidInvoices.find((i) => i.id === updates.invoiceId)
      if (inv) {
        current.refNumber = inv.invoiceNumber
      }
    }

    updated[index] = current
    setRows(updated)
  }

  // Calculations
  const totalAllocated = rows.reduce((acc, r) => acc + (Number(r.allocatedAmount) || 0), 0)
  const difference = Math.round((voucherAmount - totalAllocated) * 100) / 100
  const isBalanced = Math.abs(difference) < 0.01 && voucherAmount > 0
  const isValid =
    isBalanced &&
    rows.length > 0 &&
    rows.every((r) => {
      if (r.allocatedAmount <= 0) return false
      if (r.refType === 'AGST_REF' && !r.invoiceId) return false
      return true
    })

  const handleApply = () => {
    if (!isValid) return
    onSaveAllocations(rows)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl sm:max-h-[90vh] flex flex-col p-6">
        <DialogHeader className="pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              Bill Allocation (Agst Ref / Bill Settlement)
            </DialogTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAutoFifo}
              className="border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-medium"
            >
              <Wand2 className="mr-1.5 h-3.5 w-3.5" />
              Auto FIFO Allocation
            </Button>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Allocate the receipt of ₹{voucherAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} across outstanding invoices, advance, or on-account.
          </DialogDescription>
        </DialogHeader>

        {/* Customer & Voucher Metrics Card */}
        <div className="grid grid-cols-3 gap-3 p-3 bg-muted/50 rounded-lg border text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Party Name</div>
            <div className="font-semibold truncate">{customerName || 'Selected Party'}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Current Outstanding</div>
            <div className="font-semibold text-rose-600">
              ₹{outstandingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} Dr
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Receipt Voucher Amount</div>
            <div className="font-bold text-emerald-600 text-base">
              ₹{voucherAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Allocations Table */}
        <div className="flex-1 overflow-y-auto border rounded-md mt-3 divide-y">
          <div className="grid grid-cols-12 gap-2 p-2.5 bg-muted font-medium text-xs text-muted-foreground">
            <div className="col-span-3">Type of Ref</div>
            <div className="col-span-5">Name / Bill Reference</div>
            <div className="col-span-3 text-right">Allocated Amount (₹)</div>
            <div className="col-span-1 text-center">Action</div>
          </div>

          {rows.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No bill allocations configured. Click &apos;Auto FIFO Allocation&apos; or &apos;Add Line&apos; below.
            </div>
          ) : (
            rows.map((row, idx) => {
              const selectedInvoice = unpaidInvoices.find((i) => i.id === row.invoiceId)
              const maxDue = selectedInvoice ? Number(selectedInvoice.balanceDue) : undefined

              return (
                <div key={idx} className="grid grid-cols-12 gap-2 p-2.5 items-center text-sm hover:bg-muted/20">
                  {/* Ref Type */}
                  <div className="col-span-3">
                    <Select
                      value={row.refType}
                      onValueChange={(val: BillRefType) => {
                        handleUpdateRow(idx, {
                          refType: val,
                          invoiceId: val === 'AGST_REF' ? unpaidInvoices[0]?.id || null : null,
                          refNumber: val === 'ADVANCE' ? 'ADVANCE' : val === 'ON_ACCOUNT' ? 'ON-ACCOUNT' : row.refNumber,
                        })
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AGST_REF">Agst Ref</SelectItem>
                        <SelectItem value="ADVANCE">Advance</SelectItem>
                        <SelectItem value="ON_ACCOUNT">On Account</SelectItem>
                        <SelectItem value="NEW_REF">New Ref</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Reference Selector / Input */}
                  <div className="col-span-5">
                    {row.refType === 'AGST_REF' ? (
                      unpaidInvoices.length > 0 ? (
                        <div className="space-y-1">
                          <Select
                            value={row.invoiceId || ''}
                            onValueChange={(val) => handleUpdateRow(idx, { invoiceId: val })}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select unpaid invoice" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                              {unpaidInvoices.map((inv) => (
                                <SelectItem key={inv.id} value={inv.id}>
                                  <span className="font-mono font-medium">{inv.invoiceNumber}</span>
                                  {' — '}
                                  <span className="text-muted-foreground text-xs">
                                    {new Date(inv.saleDate).toLocaleDateString()}
                                  </span>
                                  {' (Due: ₹' + inv.balanceDue.toFixed(2) + ')'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {maxDue !== undefined && (
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                              <span>Due: ₹{maxDue.toFixed(2)}</span>
                              {row.allocatedAmount !== maxDue && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateRow(idx, { allocatedAmount: maxDue })}
                                  className="text-primary hover:underline"
                                >
                                  Set full due
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-amber-600 font-medium">
                          No unpaid invoices found for customer
                        </span>
                      )
                    ) : (
                      <Input
                        placeholder="Reference / Note"
                        className="h-9"
                        value={row.refNumber || ''}
                        onChange={(e) => handleUpdateRow(idx, { refNumber: e.target.value })}
                      />
                    )}
                  </div>

                  {/* Allocated Amount */}
                  <div className="col-span-3">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="h-9 text-right font-mono"
                      value={row.allocatedAmount === 0 ? '' : row.allocatedAmount}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0
                        handleUpdateRow(idx, { allocatedAmount: val })
                      }}
                    />
                  </div>

                  {/* Delete Button */}
                  <div className="col-span-1 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      onClick={() => handleRemoveRow(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Add Line Button */}
        <div className="pt-2">
          <Button type="button" variant="outline" size="sm" onClick={handleAddRow}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Line
          </Button>
        </div>

        {/* Balance Status Footer Bar */}
        <div className="mt-4 p-3 bg-muted/60 rounded-lg border flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-xs text-muted-foreground mr-1">Total Allocated:</span>
              <span className="font-mono font-bold">₹{totalAllocated.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground mr-1">Difference:</span>
              <span className={`font-mono font-bold ${difference !== 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                ₹{difference.toFixed(2)}
              </span>
            </div>
          </div>

          <div>
            {isBalanced ? (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/25 border-emerald-500/30 gap-1.5 py-1">
                <CheckCircle2 className="h-4 w-4" />
                Balanced (100% Allocated)
              </Badge>
            ) : difference > 0 ? (
              <Badge variant="outline" className="border-amber-500 text-amber-600 gap-1.5 py-1">
                <AlertCircle className="h-4 w-4" />
                ₹{difference.toFixed(2)} Remaining
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1.5 py-1">
                <AlertCircle className="h-4 w-4" />
                Over-allocated by ₹{Math.abs(difference).toFixed(2)}
              </Badge>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4 gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!isValid}
            onClick={handleApply}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          >
            Apply Allocations
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
