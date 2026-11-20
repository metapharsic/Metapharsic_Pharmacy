'use client'

// ─────────────────────────────────────────────────────────────
// Component — WhatsAppEodDialog
// Executive End-of-Day (11:30 PM) WhatsApp Digest Dispatch Console
// Allows Admin / Owner to:
//  1. Preview real-time closing digest (revenue, cash count, profit, expiry risk)
//  2. Verify or modify the recipient WhatsApp phone number
//  3. Dispatch via configured API gateway (Meta Cloud, Twilio, UltraMsg)
//  4. Instant One-Click wa.me deep-link to send directly from WhatsApp Web / App
// ─────────────────────────────────────────────────────────────

import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  MessageSquare,
  Phone,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useToast } from '@/lib/hooks/use-toast'
import { formatCurrency } from '@/lib/utils/currency'

interface WhatsAppEodDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultPhone?: string
}

interface DigestPreview {
  branchName: string
  organizationName: string
  reportDate: string
  generatedAt: string
  sales: {
    totalSalesCount: number
    totalRevenue: number
    averageBillValue: number
    paymentBreakdown: {
      cash: number
      upi: number
      card: number
      credit: number
      other: number
    }
  }
  profitability: {
    revenue: number
    cogs: number
    grossProfit: number
    marginPercent: number
    itemsSold: number
  }
  alerts: {
    expiringIn30DaysCount: number
    expiringIn30DaysValue: number
    outOfStockProductsCount: number
  }
  compliance: {
    scheduleHCount: number
    scheduleH1Count: number
    narcoticsXCount: number
    prescriptionsCount: number
    complianceRating: string
  }
  formattedWhatsAppText: string
  waMeLink: string
}

export function WhatsAppEodDialog({
  open,
  onOpenChange,
  defaultPhone = '+919876543210',
}: WhatsAppEodDialogProps) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [digest, setDigest] = useState<DigestPreview | null>(null)
  const [phone, setPhone] = useState(defaultPhone)

  const fetchDigest = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/reports/daily-closing/whatsapp')
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to load closing digest')
      }
      setDigest(json.data)
      if (json.data?.ownerPhone) {
        setPhone(json.data.ownerPhone)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching report'
      toast.error('Digest Load Failed', msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      void fetchDigest()
    }
  }, [open])

  const handleCopyText = () => {
    if (!digest?.formattedWhatsAppText) return
    navigator.clipboard
      .writeText(digest.formattedWhatsAppText)
      .then(() => {
        toast.success('Report Copied', 'WhatsApp report text copied to clipboard.')
      })
      .catch(() => {
        toast.error('Failed to copy text')
      })
  }

  const handleSendApi = async () => {
    if (!phone.trim()) {
      toast.error('Phone Required', 'Please enter a valid WhatsApp phone number.')
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/reports/daily-closing/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to dispatch WhatsApp message')
      }

      toast.success(
        'WhatsApp Dispatched',
        json.message || `EOD Report sent to ${json.data?.sendResult?.toPhone || phone}`
      )
      onOpenChange(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Dispatch failed'
      toast.error('Send Failed', msg)
    } finally {
      setSending(false)
    }
  }

  const handleOpenWhatsAppWeb = () => {
    if (!digest) return
    // Re-generate wa.me link with current phone input if edited
    const cleanDigits = phone.replace(/\D/g, '')
    const targetDigits = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits
    const link = `https://wa.me/${targetDigits}?text=${encodeURIComponent(
      digest.formattedWhatsAppText
    )}`
    window.open(link, '_blank', 'noopener,noreferrer')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border-border/80">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-600/10 via-background to-indigo-600/10 border-b">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <MessageSquare className="h-6 w-6" />
              </span>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                  <span>Executive EOD WhatsApp Report</span>
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 text-[10px] font-semibold">
                    11:30 PM DIGEST
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Automated closing summary with cash reconciliation, gross profit, and regulatory compliance.
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchDigest}
              disabled={loading}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              title="Refresh digest data"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Quick Metrics Header Strip */}
          {digest && (
            <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-border/50 text-xs">
              <div className="p-2 rounded-lg bg-background/90 border text-center shadow-xs">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                  Revenue
                </span>
                <p className="font-bold tabular-nums text-foreground mt-0.5">
                  {formatCurrency(digest.sales.totalRevenue.toString())}
                </p>
                <span className="text-[9px] text-muted-foreground">{digest.sales.totalSalesCount} bills</span>
              </div>
              <div className="p-2 rounded-lg bg-background/90 border text-center shadow-xs">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                  Cash in Drawer
                </span>
                <p className="font-bold tabular-nums text-foreground mt-0.5">
                  {formatCurrency(digest.sales.paymentBreakdown.cash.toString())}
                </p>
                <span className="text-[9px] text-muted-foreground">Verify cash count</span>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-center shadow-xs">
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-bold">
                  Gross Profit
                </span>
                <p className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {formatCurrency(digest.profitability.grossProfit.toString())}
                </p>
                <span className="text-[9px] text-emerald-600 font-semibold">
                  {digest.profitability.marginPercent}% Margin
                </span>
              </div>
              <div className="p-2 rounded-lg bg-background/90 border text-center shadow-xs">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                  Expiry Alerts
                </span>
                <p className="font-bold tabular-nums text-foreground mt-0.5">
                  {digest.alerts.expiringIn30DaysCount} batches
                </p>
                <span className="text-[9px] text-muted-foreground">≤30 days left</span>
              </div>
            </div>
          )}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {loading && !digest ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin text-primary mb-2" />
              <p>Compiling multi-source closing digest...</p>
            </div>
          ) : digest ? (
            <>
              {/* Recipient Phone Configuration */}
              <div className="space-y-1.5 p-3 rounded-xl bg-muted/30 border border-border/60">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Admin WhatsApp Recipient Number</span>
                </label>
                <div className="flex gap-2">
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+919876543210"
                    className="font-mono text-xs h-9 bg-background"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyText}
                    className="h-9 px-3 gap-1 text-xs shrink-0"
                    title="Copy report text"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  International format (+91 for India). Can be permanently configured via <code className="font-mono text-primary">WHATSAPP_OWNER_PHONE</code>.
                </p>
              </div>

              {/* Formatted Message Preview */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Message Preview (Ready for Dispatch)
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {digest.reportDate} · {digest.branchName}
                  </span>
                </div>
                <pre className="p-3.5 rounded-xl bg-slate-950 text-slate-100 font-mono text-[11px] leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto border border-slate-800 shadow-inner">
                  {digest.formattedWhatsAppText}
                </pre>
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <AlertCircle className="h-6 w-6 mx-auto mb-2 text-rose-500" />
              <p>Could not generate closing digest.</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-muted/20 border-t flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenWhatsAppWeb}
              disabled={!digest}
              className="h-9 text-xs gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 font-semibold"
            >
              <ExternalLink className="h-3.5 w-3.5 text-emerald-600" />
              <span>Open in WhatsApp Web</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleSendApi}
              disabled={sending || !digest}
              className="h-9 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {sending ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Dispatching...</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>Send WhatsApp Report</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

