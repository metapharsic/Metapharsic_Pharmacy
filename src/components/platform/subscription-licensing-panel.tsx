'use client'

import React, { useEffect, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BellRing,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  DollarSign,
  KeyRound,
  Mail,
  MessageSquare,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Store,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Progress } from '@/components/ui/progress'
import type { OrganizationSubscriptionInfo } from '@/lib/platform/platform-licensing-service'

export function SubscriptionLicensingPanel() {
  const [subscriptions, setSubscriptions] = useState<OrganizationSubscriptionInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)

  // Payment Renewal Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [selectedOrg, setSelectedOrg] = useState<OrganizationSubscriptionInfo | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('2999')
  const [durationDays, setDurationDays] = useState('30')
  const [paymentRef, setPaymentRef] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('UPI / QR Direct')

  const fetchSubscriptions = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/platform/subscriptions')
      const json = await res.json()
      if (json.success) {
        setSubscriptions(json.subscriptions || [])
      } else {
        toast.error(json.error || 'Failed to fetch subscriptions')
      }
    } catch {
      toast.error('Network error loading subscriptions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSubscriptions()
  }, [])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('License key copied to clipboard!')
  }

  // 1-Click Generate License
  const handleGenerateLicense = async (org: OrganizationSubscriptionInfo) => {
    try {
      setActionInProgress(org.id)
      const res = await fetch('/api/platform/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-license',
          organizationId: org.id,
          durationDays: 30,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message)
        fetchSubscriptions()
      } else {
        toast.error(data.error || 'Failed to generate license')
      }
    } catch {
      toast.error('Error generating license')
    } finally {
      setActionInProgress(null)
    }
  }

  // Send Payment / Expiry Notice
  const handleSendExpiryNotice = async (org: OrganizationSubscriptionInfo) => {
    try {
      setActionInProgress(org.id)
      const res = await fetch('/api/platform/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send-expiry-notice',
          organizationId: org.id,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message)
      } else {
        toast.error(data.error || 'Failed to dispatch notice')
      }
    } catch {
      toast.error('Error dispatching notice')
    } finally {
      setActionInProgress(null)
    }
  }

  // Open Payment Dialog
  const handleOpenPaymentDialog = (org: OrganizationSubscriptionInfo) => {
    setSelectedOrg(org)
    setPaymentRef(`UPI-${Date.now().toString().slice(-6)}`)
    setPaymentAmount('2999')
    setDurationDays('30')
    setPaymentModalOpen(true)
  }

  // Submit Payment & Auto-Renew
  const handleConfirmPayment = async () => {
    if (!selectedOrg) return
    try {
      setActionInProgress(selectedOrg.id)
      const res = await fetch('/api/platform/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'process-payment',
          organizationId: selectedOrg.id,
          amount: Number(paymentAmount),
          durationDays: Number(durationDays),
          paymentReference: paymentRef,
          paymentMethod,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message)
        setPaymentModalOpen(false)
        fetchSubscriptions()
      } else {
        toast.error(data.error || 'Payment recording failed')
      }
    } catch {
      toast.error('Error processing payment')
    } finally {
      setActionInProgress(null)
    }
  }

  const filteredSubscriptions = React.useMemo(() => {
    return subscriptions.filter((s) => {
      const q = searchQuery.toLowerCase().trim()
      return !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || s.licenseKey.toLowerCase().includes(q)
    })
  }, [subscriptions, searchQuery])

  return (
    <div className="space-y-6">
      {/* Top Banner / Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Pharmacy Licenses</span>
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <CardTitle className="text-2xl font-extrabold mt-1 font-mono">
              {subscriptions.filter((s) => s.licenseStatus === 'ACTIVE' || s.licenseStatus === 'TRIAL').length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Current active 30-day operational licenses
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Expiring Soon (&le; 7 Days)</span>
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <CardTitle className="text-2xl font-extrabold mt-1 font-mono text-amber-600 dark:text-amber-400">
              {subscriptions.filter((s) => s.licenseStatus === 'EXPIRING_SOON').length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Upcoming renewals due for automated reminders
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Expired / Payment Due</span>
              <ShieldAlert className="h-4 w-4 text-rose-600" />
            </div>
            <CardTitle className="text-2xl font-extrabold mt-1 font-mono text-rose-600 dark:text-rose-400">
              {subscriptions.filter((s) => s.licenseStatus === 'EXPIRED').length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            30 days passed — payment notices active
          </CardContent>
        </Card>
      </div>

      {/* Main Subscriptions List Card */}
      <Card className="border-border/80 shadow-card">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-teal-600" />
                <span>Chemist Shop 30-Day Subscriptions & Automated License Keys</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Track each pharmacy's 30-day operating term. When 30 days elapse, trigger payment reminders; upon payment, license keys and subscriptions auto-renew instantly.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-52 sm:w-64">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search shop, code, license key..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>

              <Button onClick={fetchSubscriptions} variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-teal-600' : ''}`} />
                <span>Refresh</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 border-b text-muted-foreground font-semibold">
                <tr>
                  <th className="py-2.5 px-3 text-left">Chemist Organization</th>
                  <th className="py-2.5 px-3 text-left">30-Day Subscription Health</th>
                  <th className="py-2.5 px-3 text-left">Active License Key</th>
                  <th className="py-2.5 px-3 text-left">Primary Contact</th>
                  <th className="py-2.5 px-3 text-right">Superadmin Licensing Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredSubscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No pharmacy subscription records found.
                    </td>
                  </tr>
                ) : (
                  filteredSubscriptions.map((org) => {
                    const isBusy = actionInProgress === org.id
                    const progressPercent = Math.min(100, Math.max(0, Math.round((Math.max(0, org.daysRemaining) / 30) * 100)))

                    return (
                      <tr key={org.id} className="hover:bg-muted/30 transition-colors">
                        {/* Organization Info */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <Store className="h-4 w-4 text-teal-600 shrink-0" />
                            <div>
                              <div className="font-semibold text-foreground text-sm">{org.name}</div>
                              <div className="text-[11px] text-muted-foreground">
                                Code: <span className="font-mono font-medium">{org.code}</span> • {org.totalBranches} Branches • {org.totalStaff} Staff
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Subscription Health Progress */}
                        <td className="py-3 px-3 w-64">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              {org.daysRemaining > 7 && (
                                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-bold">
                                  {org.daysRemaining} Days Left
                                </Badge>
                              )}
                              {org.daysRemaining > 0 && org.daysRemaining <= 7 && (
                                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] font-bold">
                                  Expiring: {org.daysRemaining} Days
                                </Badge>
                              )}
                              {org.daysRemaining <= 0 && (
                                <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 text-[10px] font-bold">
                                  EXPIRED ({org.isExpired}d passed)
                                </Badge>
                              )}
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {new Date(org.subscriptionExpiresAt || '').toLocaleDateString('en-IN')}
                              </span>
                            </div>
                            <Progress value={progressPercent} className={`h-1.5 ${org.daysRemaining <= 0 ? 'bg-rose-200 dark:bg-rose-950' : ''}`} />
                          </div>
                        </td>

                        {/* License Key with Copy Button */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-teal-700 dark:text-teal-300 text-[11px] bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                              {org.licenseKey}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(org.licenseKey)}
                              className="text-muted-foreground hover:text-foreground p-1 transition-colors"
                              title="Copy License Key"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            Issued: {new Date(org.licenseIssuedAt || '').toLocaleDateString('en-IN')}
                          </div>
                        </td>

                        {/* Contact */}
                        <td className="py-3 px-3">
                          <div className="font-medium text-foreground">{org.ownerName}</div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            <span>{org.ownerEmail}</span>
                          </div>
                          {org.ownerPhone && (
                            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />
                              <span>{org.ownerPhone}</span>
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {/* Send Expiry Notice */}
                            <Button
                              onClick={() => handleSendExpiryNotice(org)}
                              disabled={isBusy}
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px] gap-1 border-amber-500/40 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                              title="Send Email & WhatsApp Payment Notice"
                            >
                              <BellRing className="h-3 w-3" />
                              <span>Notice</span>
                            </Button>

                            {/* 1-Click Generate License Key */}
                            <Button
                              onClick={() => handleGenerateLicense(org)}
                              disabled={isBusy}
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px] gap-1 border-teal-500/40 text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/40"
                            >
                              <KeyRound className="h-3 w-3" />
                              <span>New Key</span>
                            </Button>

                            {/* Record Payment & Auto-Renew */}
                            <Button
                              onClick={() => handleOpenPaymentDialog(org)}
                              disabled={isBusy}
                              size="sm"
                              className="h-7 text-[11px] gap-1 bg-teal-600 hover:bg-teal-700 text-white font-semibold"
                            >
                              <CreditCard className="h-3 w-3" />
                              <span>Auto-Renew</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* PAYMENT & AUTO-RENEW LICENSE MODAL */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-teal-600" />
              <span>Record Payment & Auto-Renew License</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Confirm payment receipt for <strong className="text-foreground">{selectedOrg?.name}</strong>. The subscription will automatically extend and a new license key will be generated and dispatched.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pay-amount" className="text-xs font-semibold">
                  Amount Received (INR)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">₹</span>
                  <Input
                    id="pay-amount"
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="pl-7 font-mono text-sm"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pay-duration" className="text-xs font-semibold">
                  Extension Duration
                </Label>
                <select
                  id="pay-duration"
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus:ring-1 focus:ring-ring"
                >
                  <option value="30">30 Days (Standard Monthly)</option>
                  <option value="90">90 Days (Quarterly Plan)</option>
                  <option value="180">180 Days (Half-Yearly)</option>
                  <option value="365">365 Days (Annual Enterprise)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pay-ref" className="text-xs font-semibold">
                Payment Reference / Transaction ID
              </Label>
              <Input
                id="pay-ref"
                type="text"
                placeholder="e.g. UPI-984811-0021"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pay-method" className="text-xs font-semibold">
                Payment Instrument
              </Label>
              <Input
                id="pay-method"
                type="text"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="rounded-lg border border-teal-500/30 bg-teal-50/50 p-2.5 text-xs text-teal-800 dark:bg-teal-950/20 dark:text-teal-300">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                <p>
                  Upon confirmation:
                  <br />
                  1. Automatic generation of official license key.
                  <br />
                  2. Immediate dispatch of Email & WhatsApp payment confirmation to {selectedOrg?.ownerEmail || 'pharmacy contact'}.
                  <br />
                  3. In-app receipt notification logged for all shop counters.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setPaymentModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmPayment}
              className="bg-teal-600 hover:bg-teal-700 text-white font-medium"
            >
              Confirm & Auto-Renew License
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
