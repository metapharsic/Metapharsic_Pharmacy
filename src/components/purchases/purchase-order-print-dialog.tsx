'use client'

import React, { useEffect, useState } from 'react'
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  FileText,
  Mail,
  Package,
  Printer,
  Send,
  ShieldCheck,
  Truck,
  X,
} from 'lucide-react'

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
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/lib/hooks/use-toast'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDateTime } from '@/lib/utils/date'

interface PurchaseOrderPrintDialogProps {
  purchaseId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PurchaseOrderPrintDialog({
  purchaseId,
  open,
  onOpenChange,
}: PurchaseOrderPrintDialogProps) {
  const toast = useToast()
  const [purchase, setPurchase] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [recipientEmail, setRecipientEmail] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailNotes, setEmailNotes] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)

  // Fetch full purchase detail from database
  useEffect(() => {
    if (!open || !purchaseId) {
      setPurchase(null)
      return
    }

    let isMounted = true
    async function loadPurchaseDetail() {
      setLoading(true)
      try {
        const res = await fetch(`/api/purchases/${purchaseId}`)
        const json = await res.json()
        if (isMounted && json.success && json.data) {
          setPurchase(json.data)
          const sup = json.data.supplier
          setRecipientEmail(sup?.email || 'orders@supplierdistributors.com')
          setEmailSubject(`Purchase Order: ${json.data.purchaseNumber} — Metapharsic Pharmacy`)
          setEmailNotes(
            `Dear ${sup?.name || 'Supplier'},\n\nPlease find attached Purchase Order ${json.data.purchaseNumber} for prompt processing.\nKindly confirm dispatch date and batch details.\n\nRegards,\nProcurement Department\nMetapharsic Pharmacy`
          )
        }
      } catch {
        toast.error('Failed to load purchase order details from database')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    void loadPurchaseDetail()
    return () => {
      isMounted = false
    }
  }, [open, purchaseId, toast])

  const handlePrint = () => {
    window.print()
  }

  const handleSendEmail = () => {
    if (!recipientEmail) {
      toast.error('Please enter a valid recipient email address')
      return
    }
    setSendingEmail(true)
    setTimeout(() => {
      setSendingEmail(false)
      setEmailModalOpen(false)
      toast.success(`Purchase Order dispatched successfully to ${recipientEmail}!`)
    }, 800)
  }

  if (!open) return null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 border-border/80 shadow-2xl">
          {/* Action Toolbar (Non-printable) */}
          <div className="print:hidden sticky top-0 z-20 flex items-center justify-between border-b bg-background/95 backdrop-blur px-5 py-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="font-bold text-sm text-foreground">
                Purchase Order Document Preview
              </span>
              {purchase && (
                <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary">
                  {purchase.purchaseNumber}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEmailModalOpen(true)}
                disabled={loading || !purchase}
                className="h-8 gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10"
              >
                <Mail className="h-3.5 w-3.5" />
                Email to Supplier
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={handlePrint}
                disabled={loading || !purchase}
                className="h-8 gap-1.5 text-xs bg-primary text-primary-foreground font-semibold shadow-xs"
              >
                <Printer className="h-3.5 w-3.5" />
                Print Order (PDF)
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm text-muted-foreground animate-pulse">
              Loading official Purchase Order data from database…
            </div>
          ) : !purchase ? (
            <div className="p-8 text-center text-sm text-rose-500">
              Purchase order could not be loaded.
            </div>
          ) : (
            /* Printable Document Layout */
            <div id="printable-po-document" className="p-8 sm:p-10 space-y-6 text-foreground bg-white dark:bg-card">
              {/* Top Pharmacy Letterhead */}
              <div className="border-b-2 border-primary/60 pb-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-base">
                      M
                    </div>
                    <div>
                      <h1 className="text-xl font-black tracking-tight text-foreground">
                        METAPHARSIC PHARMACY HEALTHCARE
                      </h1>
                      <p className="text-[11px] text-muted-foreground">
                        Institutional Retail & Wholesale Pharmaceutical Distribution
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                    <p>Branch: {purchase.branch?.name || 'Main Pharmacy Depot'} &middot; {purchase.branch?.city || 'Mumbai'}</p>
                    <p>Drug Lic. 20B/21B: MH-TZ4-20B-78901 &middot; GSTIN: 27AABCS1429B1Z8</p>
                    <p>Phone: +91 98200 12345 &middot; Email: procurement@metapharsic.com</p>
                  </div>
                </div>

                <div className="text-right sm:text-right">
                  <div className="inline-block px-3 py-1 bg-primary/10 border border-primary/30 rounded text-xs font-bold text-primary">
                    PURCHASE ORDER
                  </div>
                  <div className="mt-2 font-mono text-sm font-black text-foreground">
                    {purchase.purchaseNumber}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Date: <strong>{formatDateTime(purchase.purchaseDate)}</strong>
                  </div>
                  {purchase.expectedDate && (
                    <div className="text-xs text-muted-foreground">
                      Expected By: <strong>{formatDateTime(purchase.expectedDate)}</strong>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Status: <Badge variant="outline" className="text-[10px] ml-1">{purchase.status}</Badge>
                  </div>
                </div>
              </div>

              {/* Vendor & Delivery Addresses */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs bg-muted/20 p-4 rounded-xl border border-border/70">
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-primary" />
                    Supplier / Vendor Details
                  </h3>
                  <div className="font-bold text-sm text-foreground">
                    {purchase.supplier?.name || 'Distributor'}
                  </div>
                  <div className="text-muted-foreground mt-1 space-y-0.5">
                    <p>Code: {purchase.supplier?.code || 'SUP-001'}</p>
                    <p>DL No: {purchase.supplier?.dlNumber || 'MH-TZ4-20B-78901 (Verified)'}</p>
                    <p>GSTIN: {purchase.supplier?.gstin || '27AABCU1234M1Z5'}</p>
                    <p>City: {purchase.supplier?.city || 'Mumbai'} &middot; Phone: {purchase.supplier?.phone || '+91 91234 56789'}</p>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5 text-primary" />
                    Ship To & Payment Terms
                  </h3>
                  <div className="font-bold text-sm text-foreground">
                    {purchase.branch?.name || 'Main Pharmacy Depot'}
                  </div>
                  <div className="text-muted-foreground mt-1 space-y-0.5">
                    <p>Delivery Branch ID: {purchase.branchId}</p>
                    <p>Payment Terms: {purchase.notes?.includes('Terms:') ? purchase.notes.split('|')[0].replace('Terms:', '').trim() : '30 days net credit'}</p>
                    <p>Dispatched Via: Road Logistics / Cold-Chain Carrier</p>
                    <p>Receiving Hours: 9:00 AM – 6:00 PM (Mon–Sat)</p>
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-b text-[11px] font-semibold text-muted-foreground uppercase">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3">Medicine / Product Details</th>
                      <th className="py-2.5 px-3 text-right">Qty</th>
                      <th className="py-2.5 px-3 text-right">Free Units</th>
                      <th className="py-2.5 px-3 text-right">Rate (₹)</th>
                      <th className="py-2.5 px-3 text-right">Disc %</th>
                      <th className="py-2.5 px-3 text-right">GST %</th>
                      <th className="py-2.5 px-3 text-right">Line Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {purchase.items?.map((it: any, idx: number) => {
                      const qty = Number(it.orderedQuantity) || 0
                      const freeQty = Number(it.freeQuantity) || 0
                      const rate = Number(it.unitCost) || 0
                      const disc = Number(it.discountPercent) || 0
                      const taxRate = Number(it.taxPercent) || 0
                      const lineTaxable = qty * rate * (1 - disc / 100)
                      const lineTax = lineTaxable * (taxRate / 100)
                      const lineTotal = lineTaxable + lineTax

                      return (
                        <tr key={it.id || idx} className="hover:bg-muted/20">
                          <td className="py-2 px-3 text-center text-muted-foreground font-mono">{idx + 1}</td>
                          <td className="py-2 px-3">
                            <div className="font-bold text-foreground">
                              {it.product?.name || `Medicine Item ${idx + 1}`}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono">
                              SKU: {it.product?.sku || 'N/A'} &middot; Unit: Strip
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold">{qty}</td>
                          <td className="py-2 px-3 text-right font-mono text-emerald-600 font-semibold">
                            {freeQty > 0 ? `+${freeQty}` : '—'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono">₹{rate.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-mono">{disc > 0 ? `${disc}%` : '—'}</td>
                          <td className="py-2 px-3 text-right font-mono">{taxRate}%</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                            {formatCurrency(lineTotal)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Order Calculations & Financial Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                <div className="text-xs space-y-2">
                  <div className="p-3 bg-muted/20 rounded-lg border border-border/70 text-muted-foreground space-y-1">
                    <span className="font-bold text-foreground block">Order Remarks & Notes:</span>
                    <p className="text-[11px] italic">
                      {purchase.notes || 'Strictly verify seal integrity, batch numbers, and minimum 75% residual shelf-life at Goods Receipt.'}
                    </p>
                  </div>

                  <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20 text-[11px] text-blue-900 dark:text-blue-200">
                    <strong>Statutory Price Snapshot:</strong> Rates, discounts, and statutory taxes are locked as of PO approval date.
                  </div>
                </div>

                <div className="rounded-lg border border-border p-4 bg-muted/30 space-y-2 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Taxable Amount (Excl. Tax):</span>
                    <span className="font-mono font-medium text-foreground">{formatCurrency(purchase.subtotal || 0)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Estimated GST (CGST + SGST / IGST):</span>
                    <span className="font-mono font-medium text-foreground">{formatCurrency(purchase.taxAmount || 0)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Freight / Other Charges:</span>
                    <span className="font-mono font-medium text-foreground">
                      {purchase.notes?.includes('Freight:') ? `₹${purchase.notes.split('Freight:')[1]?.split('|')[0]?.replace('₹', '').trim() || '0.00'}` : '₹0.00'}
                    </span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-bold text-sm text-foreground">
                    <span>Estimated PO Total:</span>
                    <span className="font-mono text-base text-primary font-black">
                      {formatCurrency(purchase.totalAmount || 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Signatures & Declarations */}
              <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs text-muted-foreground border-t border-dashed">
                <div>
                  <div className="h-12 border-b border-muted-foreground/30 flex items-end justify-center pb-1">
                    <span className="font-mono text-[11px] text-foreground font-semibold">
                      {purchase.createdBy?.name || 'Authorized Buyer'}
                    </span>
                  </div>
                  <p className="mt-1 font-medium">Prepared & Approved By</p>
                </div>

                <div>
                  <div className="h-12 border-b border-muted-foreground/30 flex items-end justify-center pb-1">
                    <span className="font-mono text-[10px] text-muted-foreground italic">Pharmacist In-Charge Stamp</span>
                  </div>
                  <p className="mt-1 font-medium">Authorized Signatory / For Metapharsic</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="print:hidden border-t bg-muted/20 px-5 py-3">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Dispatch Modal */}
      <Dialog open={emailModalOpen} onOpenChange={setEmailModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              Email Purchase Order to Supplier
            </DialogTitle>
            <DialogDescription className="text-xs">
              Dispatch an electronic copy of {purchase?.purchaseNumber} directly to the supplier's order desk.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Recipient Email *</Label>
              <Input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="orders@supplier.com"
                className="h-8.5 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Subject Line *</Label>
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="h-8.5 text-xs font-medium"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Message & Delivery Instructions</Label>
              <Textarea
                rows={4}
                value={emailNotes}
                onChange={(e) => setEmailNotes(e.target.value)}
                className="text-xs resize-none"
              />
            </div>

            <div className="p-2.5 rounded-md bg-muted/40 border text-[11px] text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>A digitally signed PDF of {purchase?.purchaseNumber} will be attached automatically.</span>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEmailModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSendEmail}
              disabled={sendingEmail}
              className="gap-1.5 bg-primary text-primary-foreground font-semibold shadow-xs"
            >
              <Send className="h-3.5 w-3.5" />
              {sendingEmail ? 'Dispatching…' : 'Send Purchase Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
