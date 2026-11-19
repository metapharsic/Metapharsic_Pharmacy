'use client'

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  IndianRupee,
  MessageSquare,
  Phone,
  RefreshCw,
  Send,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useToast } from '@/lib/hooks/use-toast'
import type { DailyClosingDigestData } from '@/lib/reports/daily-closing-digest-service'

interface DigestApiResponse {
  success: boolean
  data?: DailyClosingDigestData
  canDispatch?: boolean
  error?: string
}

export function OwnerWhatsAppDigestCard() {
  const [digest, setDigest] = useState<DailyClosingDigestData | null>(null)
  const [canDispatch, setCanDispatch] = useState(true)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const toast = useToast()

  const fetchDigest = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/reports/daily-closing/whatsapp')
      if (res.status === 401 || res.status === 403) {
        setDigest(null)
        return
      }
      const json = (await res.json()) as DigestApiResponse
      if (json.success && json.data) {
        setDigest(json.data)
        if (typeof json.canDispatch === 'boolean') {
          setCanDispatch(json.canDispatch)
        }
        if (json.data.ownerPhone) {
          setPhone((prev) => prev || json.data!.ownerPhone!)
        }
      } else {
        toast.error(json.error || 'Failed to load daily closing digest')
      }
    } catch {
      toast.error('Error connecting to closing digest service')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void fetchDigest()
  }, [fetchDigest])

  const handleSendNow = async () => {
    const targetPhone = phone.trim() || digest?.ownerPhone || '+919876543210'
    setSending(true)
    try {
      const res = await fetch('/api/reports/daily-closing/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: targetPhone }),
      })
      const json = (await res.json()) as DigestApiResponse
      if (json.success) {
        toast.success(`11:30 PM Report dispatched to ${targetPhone}`)
      } else {
        toast.error(json.error || 'Failed to dispatch WhatsApp message')
      }
    } catch {
      toast.error('Error dispatching WhatsApp message')
    } finally {
      setSending(false)
    }
  }

  const handleCopyText = () => {
    if (!digest) return
    void navigator.clipboard.writeText(digest.formattedWhatsAppText)
    setCopied(true)
    toast.success('WhatsApp digest copied to clipboard!')
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <>
      <Card className="border-teal-500/40 bg-gradient-to-br from-teal-950/20 via-background to-emerald-950/10 shadow-sm">
        <CardHeader className="p-4 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                  Owner&apos;s 11:30 PM Daily Closing Digest
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 bg-emerald-500/10 text-[11px] font-medium text-emerald-600"
                  >
                    <Clock className="mr-1 inline h-3 w-3" />
                    Auto-sends at 23:30 IST
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Automated executive intelligence for the medical shop owner — cash reconciliation,
                  gross margins, near-expiry risk, and FDA audit readiness.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => void fetchDigest()}
                disabled={loading}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 border-emerald-500/30 text-xs text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                onClick={() => setPreviewOpen(true)}
                disabled={!digest}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Preview WhatsApp Bubble
              </Button>
              {digest?.waMeLink && (
                <Button
                  size="sm"
                  className="h-8 gap-1.5 bg-emerald-600 text-xs font-medium text-white hover:bg-emerald-700"
                  asChild
                >
                  <a href={digest.waMeLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open in WhatsApp
                  </a>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 pt-1">
          {digest ? (
            <div className="space-y-4">
              {/* Quick Metrics Bar for Owner */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                <div className="space-y-1 rounded-lg border bg-card/60 p-2.5">
                  <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                    <IndianRupee className="h-3 w-3 text-teal-600" />
                    Total Sales
                  </span>
                  <div className="text-sm font-bold text-foreground">
                    ₹
                    {digest.sales.totalRevenue.toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {digest.sales.totalSalesCount} bills · avg ₹{digest.sales.averageBillValue}
                  </div>
                </div>

                <div className="space-y-1 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
                  <span className="flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                    💵 Cash in Drawer
                  </span>
                  <div className="text-sm font-bold text-amber-700 dark:text-amber-300">
                    ₹
                    {digest.sales.paymentBreakdown.cash.toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                  <div className="text-[10px] text-amber-600/80">⚠️ Verify drawer count</div>
                </div>

                <div className="space-y-1 rounded-lg border bg-card/60 p-2.5">
                  <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                    📲 UPI / Digital
                  </span>
                  <div className="text-sm font-bold text-foreground">
                    ₹
                    {digest.sales.paymentBreakdown.upi.toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Cards: ₹{digest.sales.paymentBreakdown.card.toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="space-y-1 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                  <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    <TrendingUp className="h-3 w-3" />
                    Gross Profit
                  </span>
                  <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                    ₹
                    {digest.profitability.grossProfit.toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                  <div className="text-[10px] font-medium text-emerald-600/80">
                    {digest.profitability.marginPercent}% gross margin
                  </div>
                </div>

                <div className="space-y-1 rounded-lg border border-rose-500/20 bg-rose-500/5 p-2.5">
                  <span className="flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                    <AlertTriangle className="h-3 w-3" />
                    Expiring &lt;30d
                  </span>
                  <div className="text-sm font-bold text-rose-700 dark:text-rose-300">
                    {digest.alerts.expiringIn30DaysCount} batch(es)
                  </div>
                  <div className="text-[10px] text-rose-600/80">
                    {digest.alerts.expiringIn30DaysCount > 0
                      ? `₹${digest.alerts.expiringIn30DaysValue} at risk`
                      : 'No immediate risk'}
                  </div>
                </div>

                <div className="space-y-1 rounded-lg border bg-card/60 p-2.5">
                  <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                    <ShieldCheck className="h-3 w-3 text-teal-600" />
                    FDA Schedule H
                  </span>
                  <div className="text-sm font-bold text-foreground">
                    {digest.compliance.scheduleHCount + digest.compliance.scheduleH1Count} units
                  </div>
                  <div className="text-[10px] font-medium text-teal-600 dark:text-teal-400">
                    {digest.compliance.prescriptionsCount} Rx verified
                  </div>
                </div>
              </div>

              {/* Dispatch Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-2">
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Owner Mobile:</span>
                  <Input
                    className="h-8 w-44 font-mono text-xs"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={digest?.ownerPhone || '+919876543210'}
                    disabled={!canDispatch}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => void handleSendNow()}
                    disabled={sending || !canDispatch}
                    title={!canDispatch ? 'Requires reports dispatch permissions' : undefined}
                  >
                    <Send className="h-3.5 w-3.5 text-teal-600" />
                    {sending ? 'Sending...' : 'Test Send to Mobile'}
                  </Button>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>
                    Scheduled nightly daemon: <strong>23:30:00 IST</strong>
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
              {loading
                ? 'Aggregating daily financial and operational metrics...'
                : 'No digest data available.'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* WhatsApp Message Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="border-b bg-emerald-900/10 p-4 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <DialogTitle className="text-sm font-bold">
                    WhatsApp Closing Digest Preview
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Simulated view of message delivered to owner at 11:30 PM
                  </DialogDescription>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-xs"
                  onClick={handleCopyText}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? 'Copied' : 'Copy Text'}
                </Button>
                {digest?.waMeLink && (
                  <Button
                    size="sm"
                    className="h-7 gap-1 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                    asChild
                  >
                    <a href={digest.waMeLink} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3" />
                      Open
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto bg-muted/40 p-4 font-mono text-xs">
            <div className="mx-auto max-w-md space-y-3 whitespace-pre-wrap rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-4 leading-relaxed text-foreground shadow-sm dark:bg-emerald-950/30">
              {digest?.formattedWhatsAppText}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
