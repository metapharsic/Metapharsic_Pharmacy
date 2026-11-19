'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Award,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  ExternalLink,
  FileCheck,
  FileText,
  GitCompare,
  Lock,
  Package,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Truck,
  UserCheck,
  Wallet,
} from 'lucide-react'

import { SourcingMatrixModal } from '@/components/suppliers/sourcing-matrix-modal'
import { SupplierRegistrationDialog } from '@/components/suppliers/supplier-registration-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/lib/hooks/use-toast'
import type { SupplierMasterItem } from '@/lib/suppliers/supplier-management-service'
import { formatCurrency } from '@/lib/utils/currency'

type StatusFilter = 'ALL' | 'VERIFIED' | 'PENDING' | 'BLOCKED'

interface SuppliersViewProps {
  initialMasterList?: SupplierMasterItem[]
  initialStats?: {
    totalSuppliers: number
    activeSuppliers: number
    pendingVerification: number
    onHold: number
  }
}

export function SuppliersView({
  initialMasterList = [],
  initialStats = {
    totalSuppliers: 0,
    activeSuppliers: 0,
    pendingVerification: 0,
    onHold: 0,
  },
}: SuppliersViewProps) {
  const toast = useToast()
  const [suppliers, setSuppliers] = useState<SupplierMasterItem[]>(initialMasterList)
  const [stats, setStats] = useState(initialStats)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [typeFilter, setTypeFilter] = useState<string>('ALL')
  const [loading, setLoading] = useState(false)
  const [sourcingModalOpen, setSourcingModalOpen] = useState(false)

  // Fetch / Refresh Supplier Master list
  const loadSuppliers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('view', 'master')
      if (search.trim()) params.set('search', search.trim())
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (typeFilter !== 'ALL') params.set('type', typeFilter)

      const res = await fetch(`/api/suppliers?${params.toString()}`)
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setSuppliers(json.data)
        if (json.stats) {
          setStats(json.stats)
        }
      }
    } catch {
      toast.error('Failed to load supplier master registry')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, typeFilter, toast])

  useEffect(() => {
    const t = setTimeout(() => {
      void loadSuppliers()
    }, 250)
    return () => clearTimeout(t)
  }, [loadSuppliers])

  // Filter local rows
  const filteredSuppliers = suppliers.filter((s) => {
    if (statusFilter === 'VERIFIED' && s.complianceStatus !== 'VERIFIED') return false
    if (statusFilter === 'PENDING' && s.complianceStatus !== 'PENDING') return false
    if (statusFilter === 'BLOCKED' && s.complianceStatus !== 'BLOCKED' && s.status !== 'ON_HOLD')
      return false
    if (typeFilter !== 'ALL' && s.type !== typeFilter) return false
    return true
  })

  return (
    <div className="space-y-5">
      {/* ─── Executive Header & Actions ─── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Supplier Master Management
            </h1>
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-xs">
              Master Procurement Hub
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Vendor authorization, Drug License Form 20B/21B compliance, multi-vendor product mapping, and credit limits.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSourcingModalOpen(true)}
            className="h-8 gap-1.5 text-xs border-primary/40 text-primary hover:bg-primary/10 font-semibold"
          >
            <GitCompare className="h-3.5 w-3.5" />
            Sourcing & Price Comparison
          </Button>

          <SupplierRegistrationDialog onSuccess={() => void loadSuppliers()} />
        </div>
      </div>

      {/* ─── Executive KPI Cards (Section 1) ─── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-3">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium">Total Suppliers</span>
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">
              {stats.totalSuppliers}
            </div>
            <p className="text-[10px] text-muted-foreground">Pharmaceutical partners on file</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-3">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium">Active & Compliant</span>
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-600">
              {stats.activeSuppliers}
            </div>
            <p className="text-[10px] text-muted-foreground">Valid DL 20B/21B • PO Cleared</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-3">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium">Pending Verification</span>
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-amber-600">
              {stats.pendingVerification}
            </div>
            <p className="text-[10px] text-muted-foreground">License documents in review</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-3">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium">On Hold / Blocked</span>
              <ShieldAlert className="h-4 w-4 text-rose-600" />
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-rose-600">
              {stats.onHold}
            </div>
            <p className="text-[10px] text-muted-foreground">Statutory PO lock active</p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Search & Sourcing Filter Bar ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20 p-2.5 rounded-xl border">
        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by supplier, GSTIN, phone, drug licence or product…"
            className="pl-8 h-8 text-xs bg-background"
          />
        </div>

        {/* Status Tabs */}
        <div className="flex items-center gap-1">
          {(
            [
              { id: 'ALL', label: 'All Suppliers' },
              { id: 'VERIFIED', label: 'Verified' },
              { id: 'PENDING', label: 'Pending' },
              { id: 'BLOCKED', label: 'Blocked' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setStatusFilter(t.id)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                statusFilter === t.id
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Type Selector */}
        <div className="w-44">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 text-xs bg-background">
              <SelectValue placeholder="All Supplier Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Supplier Types</SelectItem>
              <SelectItem value="MANUFACTURER">Manufacturer</SelectItem>
              <SelectItem value="DISTRIBUTOR">Distributor</SelectItem>
              <SelectItem value="WHOLESALER">Wholesaler</SelectItem>
              <SelectItem value="STOCKIST">Stockist / C&F</SelectItem>
              <SelectItem value="IMPORTER">Importer</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ─── Supplier Master Registry Table ─── */}
      <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-muted-foreground font-semibold border-b text-[10px] uppercase">
              <tr>
                <th className="py-3 px-3 text-left">Supplier & Master Code</th>
                <th className="py-3 px-2 text-left">Type</th>
                <th className="py-3 px-2 text-left">Compliance & DL #</th>
                <th className="py-3 px-2 text-left">City & Contact</th>
                <th className="py-3 px-2 text-right">Credit Terms</th>
                <th className="py-3 px-2 text-right">Outstanding</th>
                <th className="py-3 px-2 text-center">Reliability</th>
                <th className="py-3 px-2 text-left">Statutory Gate</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y text-[11px]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-1 text-primary" />
                    Querying verified supplier master records…
                  </td>
                </tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground">
                    No supplier records match the selected filter criteria.
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                    {/* Name & Code */}
                    <td className="py-2.5 px-3">
                      <Link
                        href={`/suppliers/${s.id}`}
                        className="font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                      >
                        {s.name}
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[10px] text-primary font-semibold">
                          {s.code}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {s.productsSuppliedCount} products mapped
                        </span>
                      </div>
                    </td>

                    {/* Type */}
                    <td className="py-2.5 px-2">
                      <Badge variant="outline" className="text-[10px] py-0 font-medium">
                        {s.type}
                      </Badge>
                    </td>

                    {/* Compliance & DL */}
                    <td className="py-2.5 px-2">
                      <div className="font-mono text-[10px] text-foreground font-semibold">
                        {s.dlNumber || 'NO DL RECORD'}
                      </div>
                      <span className="text-[10px] text-muted-foreground block">
                        GSTIN: {s.gstin || '—'}
                      </span>
                    </td>

                    {/* Location & Phone */}
                    <td className="py-2.5 px-2">
                      <span className="text-foreground font-medium block">
                        {s.city || 'Mumbai'}, {s.state || 'MH'}
                      </span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Phone className="h-2.5 w-2.5" />
                        {s.phone || '+91 98200 45218'}
                      </span>
                    </td>

                    {/* Credit Terms */}
                    <td className="py-2.5 px-2 text-right">
                      <span className="font-semibold text-foreground block">
                        {s.creditDays}d Net
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Limit: {formatCurrency(s.creditLimit)}
                      </span>
                    </td>

                    {/* Outstanding */}
                    <td className="py-2.5 px-2 text-right font-mono font-bold">
                      <span
                        className={
                          s.outstandingBalance > 0 ? 'text-rose-600' : 'text-emerald-600'
                        }
                      >
                        {formatCurrency(s.outstandingBalance)}
                      </span>
                    </td>

                    {/* Reliability */}
                    <td className="py-2.5 px-2 text-center font-mono font-semibold">
                      <span
                        className={
                          s.deliveryReliability >= 95 ? 'text-emerald-600' : 'text-amber-600'
                        }
                      >
                        {s.deliveryReliability}%
                      </span>
                    </td>

                    {/* Statutory PO Gate */}
                    <td className="py-2.5 px-2">
                      {s.isPoAllowed ? (
                        <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px] py-0">
                          <ShieldCheck className="h-3 w-3 mr-1" />
                          PO Cleared
                        </Badge>
                      ) : (
                        <div className="space-y-0.5">
                          <Badge className="bg-rose-500/15 text-rose-600 border-rose-500/30 text-[10px] py-0">
                            <Lock className="h-3 w-3 mr-1" />
                            PO Blocked
                          </Badge>
                          <span className="text-[9px] text-rose-600 block leading-tight max-w-[130px]">
                            {s.poBlockReason || 'License unverified'}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button asChild size="sm" variant="ghost" className="h-7 text-xs px-2 text-primary font-semibold hover:bg-primary/10">
                          <Link href={`/suppliers/${s.id}`}>
                            7-Tab Profile
                          </Link>
                        </Button>

                        {s.isPoAllowed ? (
                          <Button asChild size="sm" variant="outline" className="h-7 text-[10px] px-2 font-semibold border-primary/30 text-primary">
                            <Link href={`/purchases/new?supplierId=${s.id}`}>
                              + PO
                            </Link>
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" disabled className="h-7 text-[10px] px-2 text-muted-foreground">
                            Locked
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sourcing Recommendation Matrix Modal */}
      <SourcingMatrixModal
        open={sourcingModalOpen}
        onOpenChange={setSourcingModalOpen}
      />
    </div>
  )
}