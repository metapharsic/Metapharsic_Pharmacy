'use client'

import React, { useState } from 'react'
import { Printer, FileSpreadsheet, Download, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { downloadPurchaseBillExcel } from '@/lib/reports/invoice-excel-generator'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDateTime } from '@/lib/utils/date'
import { numberToWordsINR } from '@/lib/pdf/invoice-pdf-generator'

export interface PurchaseItemProps {
  id: string
  productId: string
  product: {
    id?: string
    name: string
    sku: string
    hsnCode?: string | null
  }
  batchNumber?: string | null
  expiryDate?: string | Date | null
  orderedQuantity: number
  receivedQuantity: number
  freeQuantity?: number
  unitCost: number | string | { toString(): string }
  mrp?: number | string | { toString(): string }
  taxPercent?: number | string | { toString(): string }
  taxAmount?: number | string | { toString(): string }
  totalAmount: number | string | { toString(): string }
}

export interface PurchasePrintProps {
  id: string
  purchaseNumber: string
  invoiceNumber?: string | null
  invoiceDate?: string | Date | null
  purchaseDate?: string | Date | null
  expectedDate?: string | Date | null
  status: string
  subtotal: number | string | { toString(): string }
  discountAmount?: number | string | { toString(): string }
  taxAmount?: number | string | { toString(): string }
  roundOff?: number | string | { toString(): string }
  totalAmount: number | string | { toString(): string }
  amountPaid?: number | string | { toString(): string }
  balanceDue?: number | string | { toString(): string }
  notes?: string | null
  supplier?: {
    id?: string
    name: string
    gstin?: string | null
    dlNumber?: string | null
    pan?: string | null
    phone?: string | null
    email?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    pincode?: string | null
  } | null
  items: PurchaseItemProps[]
}

function parseNum(val: unknown, fallback = 0): number {
  if (val == null) return fallback
  if (typeof val === 'number') return isNaN(val) ? fallback : val
  if (typeof val === 'object' && val && 'toNumber' in val && typeof (val as { toNumber: () => number }).toNumber === 'function') {
    return (val as { toNumber: () => number }).toNumber()
  }
  const n = parseFloat(String(val))
  return isNaN(n) ? fallback : n
}

export function PurchasePrintAndExcelActions({ purchase }: { purchase: PurchasePrintProps }) {
  const [printOpen, setPrintOpen] = useState(false)

  const handleDownloadExcel = () => {
    downloadPurchaseBillExcel(purchase)
  }

  const handlePrint = () => {
    window.print()
  }

  const subtotal = parseNum(purchase.subtotal)
  const discount = parseNum(purchase.discountAmount)
  const tax = parseNum(purchase.taxAmount)
  const total = parseNum(purchase.totalAmount)
  const paid = parseNum(purchase.amountPaid, 0)
  const due = parseNum(purchase.balanceDue, Math.max(0, total - paid))

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* ─── Excel Export Action ─── */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleDownloadExcel}
        className="gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
        title="Download official purchase bill and HSN tax summary workbook (.xlsx)"
      >
        <FileSpreadsheet className="h-4 w-4" />
        Export Excel (.xlsx)
      </Button>

      {/* ─── Standard Purchase Bill Print Dialog ─── */}
      <Dialog open={printOpen} onOpenChange={setPrintOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs font-semibold">
            <Printer className="h-4 w-4" />
            Print Purchase Bill
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl p-6">
          <DialogHeader className="no-print flex flex-row items-center justify-between border-b pb-3">
            <div>
              <DialogTitle className="text-base font-bold">
                Tax Purchase Invoice - {purchase.invoiceNumber || purchase.purchaseNumber}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Statutory Inward Goods Receipt &amp; Input Tax Credit (ITC) Document
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadExcel}
                className="gap-1.5 h-8 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Download Excel
              </Button>
              <Button
                size="sm"
                onClick={handlePrint}
                className="gap-1.5 h-8 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Printer className="h-3.5 w-3.5" />
                Print Standard Bill
              </Button>
            </div>
          </DialogHeader>

          {/* ───────────────────────────────────────────────────────── */}
          {/* ─── A4 PRINTABLE PURCHASE INVOICE CONTAINER             ── */}
          {/* ───────────────────────────────────────────────────────── */}
          <div
            id="printable-receipt"
            className="printable-document bg-white text-zinc-900 p-6 rounded-lg border border-zinc-200 font-sans text-xs space-y-4 relative"
          >
            {/* Statutory Software Logo Print Watermark */}
            <div className="print-watermark" aria-hidden="true" />
            {/* Header: Buyer & Inward Receipt Title */}
            <div className="flex items-start justify-between border-b-2 border-zinc-800 pb-3">
              <div>
                <h2 className="text-lg font-black tracking-tight text-zinc-900 uppercase">
                  METAPHARSIC LIFESCIENCES &amp; PHARMACARE
                </h2>
                <p className="text-[11px] text-zinc-600">
                  Plot 42, Metro Health City, HITEC City, Hyderabad, TS - 500081
                </p>
                <div className="flex flex-wrap gap-x-4 text-[10px] text-zinc-700 font-medium mt-1">
                  <span><strong>GSTIN:</strong> 36AAAAA0000A1Z5</span>
                  <span><strong>DL No:</strong> 20B/21B-TS/HYD/2026/88912</span>
                  <span><strong>FSSAI:</strong> 13626011000492</span>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-block px-2.5 py-1 text-[11px] font-bold uppercase rounded bg-zinc-100 border border-zinc-300">
                  INWARD PURCHASE TAX INVOICE
                </span>
                <p className="font-mono text-xs font-bold mt-1.5 text-zinc-900">
                  Bill No: {purchase.invoiceNumber || purchase.purchaseNumber}
                </p>
                <p className="text-[11px] text-zinc-600">
                  Date: {purchase.invoiceDate ? formatDateTime(String(purchase.invoiceDate)) : '—'}
                </p>
              </div>
            </div>

            {/* Supplier / Distributor Details Box */}
            <div className="grid grid-cols-2 gap-4 p-3 bg-zinc-50 border border-zinc-200 rounded text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                  Distributor / Vendor Details:
                </span>
                <h4 className="font-bold text-sm text-zinc-900 mt-0.5">
                  {purchase.supplier?.name || 'Wholesale Pharma Distributor'}
                </h4>
                <p className="text-zinc-600 text-[11px]">{purchase.supplier?.address || 'Pharma Wholesale Complex'}</p>
                <div className="text-[10px] space-y-0.5 mt-1 text-zinc-700">
                  {purchase.supplier?.gstin && <div><strong>GSTIN:</strong> {purchase.supplier.gstin}</div>}
                  {purchase.supplier?.dlNumber && <div><strong>DL No:</strong> {purchase.supplier.dlNumber}</div>}
                  {purchase.supplier?.phone && <div><strong>Phone:</strong> {purchase.supplier.phone}</div>}
                </div>
              </div>
              <div className="border-l border-zinc-200 pl-4 space-y-1">
                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                  Purchase Order Audit:
                </span>
                <div className="text-xs"><strong>PO Ref:</strong> {purchase.purchaseNumber}</div>
                <div className="text-xs"><strong>Status:</strong> {purchase.status}</div>
                <div className="text-xs"><strong>Items Count:</strong> {purchase.items.length} Medicines</div>
                {purchase.notes && (
                  <div className="text-[11px] text-zinc-600 italic mt-1">
                    Note: {purchase.notes}
                  </div>
                )}
              </div>
            </div>

            {/* Inward Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="bg-zinc-100 border-y border-zinc-300 font-semibold text-zinc-700">
                    <th className="py-1.5 px-2 text-center w-8">#</th>
                    <th className="py-1.5 px-2 text-left">Medicine Description</th>
                    <th className="py-1.5 px-2 text-left w-24">Batch #</th>
                    <th className="py-1.5 px-2 text-left w-20">Expiry</th>
                    <th className="py-1.5 px-2 text-right w-14">Ordered</th>
                    <th className="py-1.5 px-2 text-right w-14">Received</th>
                    <th className="py-1.5 px-2 text-right w-12">Free</th>
                    <th className="py-1.5 px-2 text-right w-20">PTR (₹)</th>
                    <th className="py-1.5 px-2 text-right w-20">Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {purchase.items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-zinc-50/50">
                      <td className="py-1.5 px-2 text-center font-mono text-zinc-500">{idx + 1}</td>
                      <td className="py-1.5 px-2 font-semibold text-zinc-900">
                        {item.product.name}
                        <span className="block text-[9px] font-mono font-normal text-zinc-500">
                          {item.product.sku}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 font-mono font-bold uppercase text-zinc-800">
                        {item.batchNumber || '—'}
                      </td>
                      <td className="py-1.5 px-2 font-mono text-zinc-600">
                        {item.expiryDate ? String(item.expiryDate).slice(0, 7) : '—'}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono">{item.orderedQuantity}</td>
                      <td className="py-1.5 px-2 text-right font-mono font-bold text-emerald-700">
                        {item.receivedQuantity}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-zinc-500">
                        {item.freeQuantity || 0}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono">
                        ₹{parseNum(item.unitCost).toFixed(2)}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono font-bold text-zinc-900">
                        ₹{parseNum(item.totalAmount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Summary & Total in Words */}
            <div className="border-t-2 border-zinc-800 pt-3 flex items-start justify-between">
              <div className="max-w-md space-y-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  Amount in Indian Rupees:
                </span>
                <p className="font-bold text-xs text-zinc-900 italic">
                  {numberToWordsINR(total)}
                </p>
                <div className="text-[10px] text-zinc-500 mt-2">
                  <p>• Goods verified and provisioned into pharmacy inventory batches.</p>
                  <p>• Eligible for Input Tax Credit (ITC) under Section 16 of CGST Act, 2017.</p>
                </div>
              </div>

              <div className="w-64 space-y-1 text-right text-xs">
                <div className="flex justify-between text-zinc-600">
                  <span>Subtotal:</span>
                  <span className="font-mono">₹{subtotal.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount:</span>
                    <span className="font-mono">-₹{discount.toFixed(2)}</span>
                  </div>
                )}
                {tax > 0 && (
                  <div className="flex justify-between text-zinc-600">
                    <span>GST (Tax):</span>
                    <span className="font-mono">₹{tax.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black border-t border-zinc-400 pt-1 text-zinc-900">
                  <span>Total Amount:</span>
                  <span className="font-mono">₹{total.toFixed(2)}</span>
                </div>
                {paid > 0 && (
                  <div className="flex justify-between text-zinc-600 text-[11px]">
                    <span>Amount Settled:</span>
                    <span className="font-mono">₹{paid.toFixed(2)}</span>
                  </div>
                )}
                {due > 0 && (
                  <div className="flex justify-between text-rose-700 font-bold text-[11px]">
                    <span>Balance Due:</span>
                    <span className="font-mono">₹{due.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Signature Block */}
            <div className="border-t border-zinc-200 pt-6 mt-6 flex justify-between text-center text-[10px] text-zinc-600">
              <div className="w-48 border-t border-dashed border-zinc-400 pt-1">
                Inward Goods Verified By
              </div>
              <div className="w-48 border-t border-dashed border-zinc-400 pt-1">
                Chief Pharmacist / Stock Auditor
              </div>
              <div className="w-48 border-t border-dashed border-zinc-400 pt-1 font-bold text-zinc-900">
                Authorized Signatory
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

