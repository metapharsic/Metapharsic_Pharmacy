'use client'

import { format } from 'date-fns'
import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  MessageSquare,
  Phone,
  Send,
} from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'

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
import { useToast } from '@/lib/hooks/use-toast'
import { generateWaMeLink } from '@/lib/whatsapp/whatsapp-service'

export interface WhatsAppInvoiceItem {
  productName?: string
  name?: string
  quantity?: number
  unitPrice?: number | string
  totalAmount?: number | string
  product?: { name?: string }
}

export interface WhatsAppInvoiceData {
  id?: string
  invoiceNumber?: string | null
  saleDate?: string | number | Date | null
  createdAt?: string | number | Date | null
  customerName?: string | null
  customerPhone?: string | null
  patientPhone?: string | null
  customer?: { name?: string | null; phone?: string | null } | null
  totalAmount?: number | string | null
  status?: string | null
  paymentMethod?: string | null
  paymentStatus?: string | null
  payments?: { method?: string; amount?: number }[] | null
  items?: WhatsAppInvoiceItem[] | null
}

export interface WhatsAppInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sale: WhatsAppInvoiceData | null | undefined
  pharmacyName?: string
}

/**
 * Format cleanly structured WhatsApp Markdown invoice text
 */
export function formatWhatsAppInvoiceText(
  sale: WhatsAppInvoiceData | null | undefined,
  origin?: string,
  pharmacyName?: string
): string {
  if (!sale) return ''
  const invoiceNumber = sale.invoiceNumber || 'INV-DRAFT'
  const saleDate = sale.saleDate || sale.createdAt || new Date()
  const dateObj = new Date(saleDate)
  const dateStr = format(dateObj, 'dd MMM yyyy')
  const customerName = sale.customer?.name || sale.customerName || 'Walk-in Patient'

  // Format line items & calculate estimated days supply for refill advice
  const items = Array.isArray(sale.items) ? sale.items : []
  let itemsSummary = ''
  let maxDaysSupply = 15

  if (items.length === 0) {
    itemsSummary = '• Pharmaceuticals & Healthcare Supplies'
  } else {
    const maxItems = 5
    const displayedItems = items.slice(0, maxItems).map((it) => {
      const name = it.productName || it.product?.name || it.name || 'Medicine'
      const qty = it.quantity || 1
      if (qty >= 10 && qty <= 90) {
        maxDaysSupply = Math.max(maxDaysSupply, qty)
      }
      const amt = Number(it.totalAmount ?? Number(it.unitPrice || 0) * qty)
      return `• ${name} (x${qty}) - ₹${amt.toFixed(2)}`
    })
    if (items.length > maxItems) {
      displayedItems.push(`_...and ${items.length - maxItems} more item(s)_`)
    }
    itemsSummary = displayedItems.join('\n')
  }

  const refillDate = new Date(dateObj.getTime() + maxDaysSupply * 24 * 60 * 60 * 1000)
  const refillDateStr = format(refillDate, 'dd MMM yyyy')

  const totalAmount = Number(sale.totalAmount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  let paymentMethod = sale.paymentMethod || sale.paymentStatus || 'CASH'
  if (sale.payments && sale.payments.length > 0) {
    paymentMethod = sale.payments.map((p) => p.method || 'CASH').join(', ')
  }

  const baseUrl =
    origin ||
    (typeof window !== 'undefined' ? window.location.origin : '') ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:5888'
  const pdfLink = `${baseUrl}/api/sales/${sale.id || sale.invoiceNumber || 'draft'}/pdf`

  const cancelledTag = sale.status === 'CANCELLED' ? ' [CANCELLED]' : ''
  const storeHeader = (pharmacyName || 'Sovereign Dispensary').toUpperCase()

  return `🏥 *${storeHeader}*
🧾 *TAX INVOICE: ${invoiceNumber}*${cancelledTag}
📅 Date: ${dateStr}
👤 Patient: ${customerName}
━━━━━━━━━━━━━━━━━━━━
${itemsSummary}
━━━━━━━━━━━━━━━━━━━━
💰 *Net Payable: ₹${totalAmount}*
💳 Payment: ${paymentMethod}

⚡ *AUTOMATED MEDICINE REFILL SCHEDULE:*
• Next Refill Due: *${refillDateStr}* (in ~${maxDaysSupply} days)
• Status: Stock reserved for priority counter pickup or home delivery.

📄 *Download Official Tax Invoice PDF:*
${pdfLink}
━━━━━━━━━━━━━━━━━━━━
Thank you for choosing ${storeHeader}! Wishing you a speedy recovery!`
}

export function WhatsAppInvoiceDialog({
  open,
  onOpenChange,
  sale,
  pharmacyName,
}: WhatsAppInvoiceDialogProps) {
  const [phone, setPhone] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [copied, setCopied] = useState(false)
  const toast = useToast()

  // Pre-fill phone number from customer record
  useEffect(() => {
    if (open && sale) {
      const initialPhone =
        sale.customer?.phone ||
        sale.customerPhone ||
        sale.patientPhone ||
        ''
      setPhone(String(initialPhone || ''))
    }
  }, [open, sale])

  const messageText = useMemo(() => {
    return formatWhatsAppInvoiceText(sale, undefined, pharmacyName)
  }, [sale, pharmacyName])

  const waMeLink = useMemo(() => {
    if (!phone.trim()) return ''
    try {
      return generateWaMeLink(phone.trim(), messageText)
    } catch {
      return ''
    }
  }, [phone, messageText])

  const handleCopy = () => {
    if (!messageText) return
    void navigator.clipboard.writeText(messageText)
    setCopied(true)
    toast.success('Invoice text copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleOpenWhatsApp = () => {
    if (!phone.trim()) {
      toast.error('Please enter a recipient phone number')
      return
    }
    if (waMeLink) {
      window.open(waMeLink, '_blank', 'noopener,noreferrer')
    }
  }

  const handleSendViaApi = async () => {
    if (!phone.trim()) {
      toast.error('Please enter a recipient phone number')
      return
    }

    try {
      setIsSending(true)
      const res = await fetch('/api/reports/daily-closing/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          message: messageText,
        }),
      })

      const data = (await res.json()) as { success?: boolean; message?: string; error?: string }
      if (res.ok && data.success) {
        toast.success('WhatsApp Invoice Dispatched', data.message || `Sent to ${phone}`)
        onOpenChange(false)
      } else {
        toast.error('Dispatch failed', data.error || 'Could not send WhatsApp message')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to dispatch via API'
      toast.error('Network Error', msg)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-600 dark:text-emerald-400">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  Share Tax Invoice on WhatsApp
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Send formatted bill summary &amp; official PDF download link to patient
                </DialogDescription>
              </div>
            </div>
            <Badge
              variant="outline"
              className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs"
            >
              Invoice {sale?.invoiceNumber || ''}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Recipient Phone Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-emerald-600" />
              Recipient WhatsApp Mobile:
            </label>
            <div className="flex gap-2">
              <Input
                type="tel"
                placeholder="e.g. 9876543210 or +919876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-9 text-xs font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="h-9 gap-1 text-xs whitespace-nowrap"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Indian 10-digit numbers auto-format to E.164 (+91).
            </p>
          </div>

          {/* Formatted Message Bubble Preview */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              WhatsApp Message Preview:
            </label>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/5 dark:bg-emerald-950/20 p-3.5 font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap max-h-60 overflow-y-auto">
              {messageText}
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto text-xs"
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleSendViaApi}
              disabled={isSending || !phone.trim()}
              className="gap-1.5 text-xs flex-1 sm:flex-initial"
              title="Send silently via configured Meta / Twilio gateway"
            >
              {isSending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5 text-teal-600" />
              )}
              Send via API
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleOpenWhatsApp}
              disabled={!phone.trim()}
              className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex-1 sm:flex-initial"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              1-Click WhatsApp
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
