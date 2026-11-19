'use client'

import {
  AlertTriangle,
  Building,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  FileText,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react'
import React, { useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  SearchableSelect,
  type SearchableSelectOption,
} from '@/components/ui/searchable-select'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils/cn'

import type { MasterBranch, MasterSupplier, ReviewBillData } from './types'

export interface BillMetadataFormProps {
  billData: ReviewBillData
  onChange: (updated: Partial<ReviewBillData>) => void
  suppliers: MasterSupplier[]
  branches: MasterBranch[]
  disabled?: boolean
  className?: string
}

export function BillMetadataForm({
  billData,
  onChange,
  suppliers,
  branches,
  disabled = false,
  className,
}: BillMetadataFormProps) {
  const [showVendorDetails, setShowVendorDetails] = useState<boolean>(
    Boolean(billData.supplierPan || billData.supplierPhone || billData.supplierEmail || billData.supplierAddress)
  )

  // Map master suppliers to SearchableSelect options
  const supplierOptions = useMemo<SearchableSelectOption[]>(() => {
    return suppliers.map((s) => ({
      value: s.id,
      label: s.name,
      sublabel: [s.gstin ? `GST: ${s.gstin}` : null, s.dlNumber ? `DL: ${s.dlNumber}` : null]
        .filter(Boolean)
        .join(' • '),
      badge: s.gstin ? 'Verified' : undefined,
      badgeVariant: 'secondary',
      keywords: [s.gstin || '', s.dlNumber || '', s.address || ''],
    }))
  }, [suppliers])

  // Current selected supplier entity
  const currentSupplier = useMemo(() => {
    return suppliers.find((s) => s.id === billData.supplierId)
  }, [suppliers, billData.supplierId])

  const handleSupplierChange = (supplierId: string) => {
    const selected = suppliers.find((s) => s.id === supplierId)
    if (selected) {
      onChange({
        supplierId: selected.id,
        supplierName: selected.name,
        supplierGstin: selected.gstin || billData.supplierGstin,
        supplierDlNumber: selected.dlNumber || billData.supplierDlNumber,
        supplierPhone: selected.phone || billData.supplierPhone,
        supplierEmail: selected.email || billData.supplierEmail,
        supplierAddress: selected.address || billData.supplierAddress,
        isNewSupplier: false,
        supplierConfidence: 1.0,
      })
    } else {
      // Custom supplier name entry
      onChange({
        supplierId: undefined,
        supplierName: supplierId,
        isNewSupplier: true,
      })
    }
  }

  const paymentMethod = billData.paymentMethod || 'CREDIT'

  return (
    <Card className={cn('border border-border/80 shadow-sm bg-card', className)}>
      <CardContent className="p-4 space-y-4">
        {/* Section Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Distributor &amp; Invoice Metadata</h3>
          </div>

          <div className="flex items-center gap-2">
            {/* Supplier Match Status Badge */}
            {billData.supplierId ? (
              <Badge
                variant="outline"
                className="gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs"
              >
                <CheckCircle2 className="h-3 w-3" />
                <span>Matched: {currentSupplier?.name || billData.supplierName}</span>
                {billData.supplierConfidence ? (
                  <span className="font-mono text-[10px]">
                    ({Math.round(billData.supplierConfidence * 100)}%)
                  </span>
                ) : null}
              </Badge>
            ) : billData.isNewSupplier ? (
              <Badge
                variant="outline"
                className="gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs"
              >
                <Sparkles className="h-3 w-3" />
                <span>New Distributor Detected</span>
              </Badge>
            ) : null}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowVendorDetails((prev) => !prev)}
              className="h-7 text-xs px-2 gap-1 text-muted-foreground hover:text-foreground"
            >
              <span>Vendor Credentials</span>
              {showVendorDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </div>
        </div>

        {/* Primary Form Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Supplier Selection */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="supplier-select" className="text-xs font-medium flex items-center justify-between">
              <span>Distributor / Agency Name <span className="text-destructive">*</span></span>
              {billData.supplierGstin && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  GST: {billData.supplierGstin}
                </span>
              )}
            </Label>
            <SearchableSelect
              value={billData.supplierId || billData.supplierName || ''}
              onChange={handleSupplierChange}
              options={supplierOptions}
              placeholder="Select or search distributor..."
              searchPlaceholder="Search by name, GSTIN, or DL #..."
              emptyMessage="No matching distributor found. Type name to create."
              allowCustom={true}
              customLabelPrefix="Add as new supplier:"
              disabled={disabled}
              className="w-full"
            />
            {billData.isNewSupplier && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1">
                <AlertTriangle className="h-3 w-3" />
                This distributor is not in your master records. Full credentials will be registered on commit.
              </p>
            )}
          </div>

          {/* Invoice Number */}
          <div className="space-y-1.5">
            <Label htmlFor="invoice-number" className="text-xs font-medium flex items-center gap-1">
              <FileText className="h-3 w-3 text-muted-foreground" />
              <span>Invoice # <span className="text-destructive">*</span></span>
            </Label>
            <Input
              id="invoice-number"
              type="text"
              placeholder="e.g. INV-2026-089"
              value={billData.invoiceNumber}
              onChange={(e) => onChange({ invoiceNumber: e.target.value })}
              disabled={disabled}
              className={cn(
                'h-9 font-mono uppercase text-xs',
                !billData.invoiceNumber.trim() && 'border-destructive focus-visible:ring-destructive'
              )}
            />
          </div>

          {/* Invoice Date */}
          <div className="space-y-1.5">
            <Label htmlFor="invoice-date" className="text-xs font-medium flex items-center gap-1">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span>Invoice Date <span className="text-destructive">*</span></span>
            </Label>
            <Input
              id="invoice-date"
              type="date"
              value={billData.invoiceDate}
              onChange={(e) => onChange({ invoiceDate: e.target.value })}
              disabled={disabled}
              className="h-9 text-xs font-mono"
            />
          </div>

          {/* Receiving Branch */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="branch-select" className="text-xs font-medium flex items-center gap-1">
              <Building className="h-3 w-3 text-muted-foreground" />
              <span>Receiving Pharmacy Branch <span className="text-destructive">*</span></span>
            </Label>
            <Select
              value={billData.branchId}
              onValueChange={(val) => onChange({ branchId: val })}
              disabled={disabled}
            >
              <SelectTrigger id="branch-select" className="h-9 text-xs">
                <SelectValue placeholder="Select receiving branch..." />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id} className="text-xs">
                    {b.name} {b.isHeadOffice ? '(Main/HQ)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Statutory DL */}
          <div className="space-y-1.5">
            <Label htmlFor="supplier-dl" className="text-xs font-medium flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-muted-foreground" />
              <span>Drug License (20B/21B)</span>
            </Label>
            <Input
              id="supplier-dl"
              type="text"
              placeholder="e.g. 20B/KA-B21/48911"
              value={billData.supplierDlNumber || ''}
              onChange={(e) => onChange({ supplierDlNumber: e.target.value })}
              disabled={disabled}
              className="h-9 font-mono text-xs uppercase"
            />
          </div>

          {/* Optional Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="bill-notes" className="text-xs font-medium">
              Internal PO / Delivery Notes
            </Label>
            <Input
              id="bill-notes"
              type="text"
              placeholder="e.g. Scanned via automated ingestion"
              value={billData.notes || ''}
              onChange={(e) => onChange({ notes: e.target.value })}
              disabled={disabled}
              className="h-9 text-xs"
            />
          </div>
        </div>

        {/* Payment Terms & Settlement Row */}
        <div className="rounded-lg border border-border/70 bg-muted/20 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-semibold text-foreground">
              Payment Terms &amp; Settlement Architecture
            </span>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] uppercase font-mono px-1.5 py-0',
                paymentMethod === 'CREDIT'
                  ? 'border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10'
                  : 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10'
              )}
            >
              {paymentMethod === 'CREDIT' ? 'AP Balance Due' : 'Paid & Settled'}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Payment Method */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">
                Payment Mode
              </Label>
              <Select
                value={paymentMethod}
                onValueChange={(val: 'CASH' | 'CARD' | 'UPI' | 'NETBANKING' | 'CHEQUE' | 'CREDIT') =>
                  onChange({ paymentMethod: val })
                }
                disabled={disabled}
              >
                <SelectTrigger className="h-8 text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UPI" className="text-xs font-medium">
                    ⚡ UPI (Instant Settlement)
                  </SelectItem>
                  <SelectItem value="CASH" className="text-xs font-medium">
                    💵 Cash (Counter Outflow)
                  </SelectItem>
                  <SelectItem value="CREDIT" className="text-xs font-medium">
                    📜 Credit / AP (Pay Later)
                  </SelectItem>
                  <SelectItem value="CARD" className="text-xs font-medium">
                    💳 Card / POS Terminal
                  </SelectItem>
                  <SelectItem value="NETBANKING" className="text-xs font-medium">
                    🏦 NetBanking / NEFT / RTGS
                  </SelectItem>
                  <SelectItem value="CHEQUE" className="text-xs font-medium">
                    📑 Cheque / Demand Draft
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Payment Reference (UPI ID, UTR, Cheque #) */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <CreditCard className="h-3 w-3" />
                <span>Reference / UTR / Cheque #</span>
              </Label>
              <Input
                type="text"
                placeholder={
                  paymentMethod === 'UPI'
                    ? 'e.g. UPI-UTR-402918491'
                    : paymentMethod === 'CHEQUE'
                    ? 'e.g. CHQ-928174'
                    : 'Reference number'
                }
                value={billData.paymentReference || ''}
                onChange={(e) => onChange({ paymentReference: e.target.value })}
                disabled={disabled}
                className="h-8 text-xs font-mono"
              />
            </div>

            {/* Credit Days */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">
                Credit Days
              </Label>
              <Input
                type="number"
                min="0"
                max="365"
                placeholder="e.g. 21"
                value={billData.creditDays ?? 21}
                onChange={(e) => onChange({ creditDays: Number(e.target.value) || 0 })}
                disabled={disabled}
                className="h-8 text-xs font-mono"
              />
            </div>

            {/* Due Date */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">
                Payment Due Date
              </Label>
              <Input
                type="date"
                value={billData.dueDate || ''}
                onChange={(e) => onChange({ dueDate: e.target.value })}
                disabled={disabled}
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>
        </div>

        {/* Collapsible Vendor Full Credentials Section */}
        {showVendorDetails && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3 animate-in fade-in-50 duration-200">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <div className="flex items-center gap-2">
                <Building className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-foreground">
                  Vendor Complete Credentials &amp; Statutory Profiles
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">
                Updates Supplier Master Record
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* GSTIN */}
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">GSTIN</Label>
                <Input
                  type="text"
                  placeholder="e.g. 29AABCU9603R1ZM"
                  value={billData.supplierGstin || ''}
                  onChange={(e) => onChange({ supplierGstin: e.target.value.toUpperCase() })}
                  disabled={disabled}
                  className="h-8 text-xs font-mono uppercase"
                />
              </div>

              {/* PAN */}
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">Income Tax PAN</Label>
                <Input
                  type="text"
                  placeholder="e.g. AABCU9603R"
                  value={billData.supplierPan || ''}
                  onChange={(e) => onChange({ supplierPan: e.target.value.toUpperCase() })}
                  disabled={disabled}
                  className="h-8 text-xs font-mono uppercase"
                />
              </div>

              {/* Phone */}
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  <span>Phone Number</span>
                </Label>
                <Input
                  type="tel"
                  placeholder="e.g. +91 98450 12345"
                  value={billData.supplierPhone || ''}
                  onChange={(e) => onChange({ supplierPhone: e.target.value })}
                  disabled={disabled}
                  className="h-8 text-xs font-mono"
                />
              </div>

              {/* Email */}
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  <span>Email Address</span>
                </Label>
                <Input
                  type="email"
                  placeholder="e.g. billing@distributor.com"
                  value={billData.supplierEmail || ''}
                  onChange={(e) => onChange({ supplierEmail: e.target.value })}
                  disabled={disabled}
                  className="h-8 text-xs"
                />
              </div>

              {/* Address */}
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span>Physical Warehouse / Office Address</span>
                </Label>
                <Input
                  type="text"
                  placeholder="e.g. Plot 42, Peenya Industrial Area Phase 2"
                  value={billData.supplierAddress || ''}
                  onChange={(e) => onChange({ supplierAddress: e.target.value })}
                  disabled={disabled}
                  className="h-8 text-xs"
                />
              </div>

              {/* City & State */}
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">City &amp; State</Label>
                <div className="grid grid-cols-2 gap-1">
                  <Input
                    type="text"
                    placeholder="City"
                    value={billData.supplierCity || ''}
                    onChange={(e) => onChange({ supplierCity: e.target.value })}
                    disabled={disabled}
                    className="h-8 text-xs"
                  />
                  <Input
                    type="text"
                    placeholder="State"
                    value={billData.supplierState || ''}
                    onChange={(e) => onChange({ supplierState: e.target.value })}
                    disabled={disabled}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Pincode */}
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">Postal Pincode</Label>
                <Input
                  type="text"
                  placeholder="e.g. 560058"
                  value={billData.supplierPincode || ''}
                  onChange={(e) => onChange({ supplierPincode: e.target.value })}
                  disabled={disabled}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
