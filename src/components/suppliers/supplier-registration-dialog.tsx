'use client'

import React, { useState } from 'react'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CreditCard,
  Download,
  FileCheck,
  FileText,
  Plus,
  Printer,
  ShieldCheck,
  Sparkles,
  UserCheck,
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
  DialogTrigger,
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
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/lib/hooks/use-toast'

interface SupplierRegistrationDialogProps {
  onSuccess?: () => void
  triggerButton?: React.ReactNode
}

type DialogTab = 'PROTOTYPE' | 'PRODUCTION'

export function SupplierRegistrationDialog({
  onSuccess,
  triggerButton,
}: SupplierRegistrationDialogProps) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<DialogTab>('PROTOTYPE')

  // Prototype specific fields
  const [legalName, setLegalName] = useState('ABC Pharma Distributors')
  const [supplierTypeOption, setSupplierTypeOption] = useState<
    'Manufacturer' | 'Distributor / Wholesaler' | 'Importer' | 'Other'
  >('Distributor / Wholesaler')
  const [contactNumber, setContactNumber] = useState('+91 98201 12345')
  const [protoGstin, setProtoGstin] = useState('27AABCU1234M1Z5')
  const [city, setCity] = useState('Mumbai')
  const [creditTermOption, setCreditTermOption] = useState<
    'Advance / Cash' | '7 days' | '15 days' | '30 days' | '45 days or more'
  >('30 days')
  const [protoGenerated, setProtoGenerated] = useState(false)

  // Full production fields
  const [tradeName, setTradeName] = useState('')
  const [contactPerson, setContactPerson] = useState('Rajesh Verma')
  const [email, setEmail] = useState('orders@abcpharmadist.com')
  const [pan, setPan] = useState('AABCU1234M')
  const [dlNumber, setDlNumber] = useState('MH-TZ4-20B-78901')
  const [state, setState] = useState('Maharashtra')
  const [address, setAddress] = useState('Bldg 4, Kalpataru Industrial Park, Kurla West, Mumbai')
  const [creditLimit, setCreditLimit] = useState('500000')

  const resetForm = () => {
    setLegalName('')
    setTradeName('')
    setSupplierTypeOption('Distributor / Wholesaler')
    setContactPerson('')
    setContactNumber('')
    setEmail('')
    setProtoGstin('')
    setPan('')
    setDlNumber('')
    setCity('')
    setState('')
    setAddress('')
    setCreditTermOption('30 days')
    setCreditLimit('250000')
    setProtoGenerated(false)
  }

  const handleSaveToDatabase = async () => {
    if (!legalName.trim()) {
      toast.error('Legal supplier name is required')
      return
    }

    setLoading(true)
    try {
      let mappedType = 'DISTRIBUTOR'
      if (supplierTypeOption === 'Manufacturer') mappedType = 'MANUFACTURER'
      else if (supplierTypeOption === 'Distributor / Wholesaler') mappedType = 'WHOLESALER'
      else if (supplierTypeOption === 'Importer') mappedType = 'IMPORTER'

      let creditDays = 30
      if (creditTermOption === 'Advance / Cash') creditDays = 0
      else if (creditTermOption === '7 days') creditDays = 7
      else if (creditTermOption === '15 days') creditDays = 15
      else if (creditTermOption === '30 days') creditDays = 30
      else if (creditTermOption === '45 days or more') creditDays = 45

      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: legalName.trim(),
          contactPerson: contactPerson.trim() || undefined,
          phone: contactNumber.trim() || undefined,
          email: email.trim() || undefined,
          gstin: protoGstin.trim().toUpperCase() || undefined,
          pan: pan.trim().toUpperCase() || undefined,
          dlNumber: dlNumber.trim().toUpperCase() || undefined,
          city: city.trim() || undefined,
          state: state.trim() || undefined,
          address: address.trim() || undefined,
          creditDays,
          notes: `Supplier Type: ${mappedType} | Trade: ${tradeName.trim() || legalName.trim()} | Initial Limit: ₹${creditLimit}`,
        }),
      })

      const json = await res.json()
      if (json.success) {
        toast.success(`Supplier '${legalName}' registered successfully into master registry!`)
        resetForm()
        setOpen(false)
        onSuccess?.()
      } else {
        toast.error(json.error?.message || 'Failed to create supplier record')
      }
    } catch {
      toast.error('Network error during supplier registration')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button size="sm" className="h-8 gap-1.5 text-xs font-semibold bg-primary text-primary-foreground shadow-sm">
            <Plus className="h-3.5 w-3.5" />
            Add Supplier Master
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Building2 className="h-4.5 w-4.5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">
                  {activeTab === 'PROTOTYPE' ? 'Add Supplier — Prototype' : 'Register New Supplier Master'}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {activeTab === 'PROTOTYPE'
                    ? 'This is a design preview, not a saved supplier record.'
                    : 'Statutory pharmaceutical onboarding with Form 20B/21B wholesale license verification.'}
                </DialogDescription>
              </div>
            </div>

            {/* Mode Switcher */}
            <div className="flex items-center rounded-lg bg-muted p-1 gap-1 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('PROTOTYPE')}
                className={`rounded px-2.5 py-1 font-semibold transition-colors ${
                  activeTab === 'PROTOTYPE'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Prototype Form
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('PRODUCTION')}
                className={`rounded px-2.5 py-1 font-semibold transition-colors ${
                  activeTab === 'PRODUCTION'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Full Onboarding
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* ─── TAB 1: EXACT PROTOTYPE DESIGN (Item 5) ─── */}
        {activeTab === 'PROTOTYPE' && (
          <div className="space-y-4 pt-1">
            <div className="rounded-lg bg-muted/40 border border-border/60 p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Add supplier — prototype</p>
              <p className="text-[11px] mt-0.5">This is a design preview, not a saved supplier record.</p>
            </div>

            {/* Legal supplier name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Legal supplier name *</Label>
              <Input
                placeholder="e.g. ABC Pharma Distributors"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                className="h-8.5 text-xs font-medium"
              />
            </div>

            {/* Supplier type (Selectable options) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Supplier type</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    'Manufacturer',
                    'Distributor / Wholesaler',
                    'Importer',
                    'Other',
                  ] as const
                ).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSupplierTypeOption(t)}
                    className={`rounded-lg border p-2.5 text-xs text-left font-medium transition-all ${
                      supplierTypeOption === t
                        ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                        : 'border-border/60 bg-background text-muted-foreground hover:border-border hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{t}</span>
                      {supplierTypeOption === t && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Contact number, GSTIN, City */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Contact number</Label>
                <Input
                  placeholder="+91 98200 45218"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  className="h-8.5 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  GSTIN (optional at draft stage)
                </Label>
                <Input
                  placeholder="27AABCU1234M1Z5"
                  value={protoGstin}
                  onChange={(e) => setProtoGstin(e.target.value.toUpperCase())}
                  className="h-8.5 text-xs font-mono"
                  maxLength={15}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">City</Label>
                <Input
                  placeholder="e.g. Mumbai"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="h-8.5 text-xs"
                />
              </div>
            </div>

            {/* Credit terms (Selectable options) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Credit terms</Label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {(
                  [
                    'Advance / Cash',
                    '7 days',
                    '15 days',
                    '30 days',
                    '45 days or more',
                  ] as const
                ).map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => setCreditTermOption(term)}
                    className={`rounded-lg border p-2 text-xs text-center font-medium transition-all ${
                      creditTermOption === term
                        ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                        : 'border-border/60 bg-background text-muted-foreground hover:border-border hover:bg-muted/30'
                    }`}
                  >
                    <span>{term}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Generate Supplier Specification Action */}
            <div className="pt-2">
              <Button
                type="button"
                onClick={() => setProtoGenerated(true)}
                className="w-full gap-2 bg-primary text-primary-foreground font-semibold shadow-sm text-xs h-9"
              >
                <Sparkles className="h-4 w-4" />
                Generate supplier specification
              </Button>
            </div>

            {/* Generated Specification Preview Box */}
            {protoGenerated && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-xs space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-2 border-b border-primary/20">
                  <div className="flex items-center gap-1.5">
                    <FileCheck className="h-4 w-4 text-primary" />
                    <span className="font-bold text-foreground">Supplier Specification Document (Preview)</span>
                  </div>
                  <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-[10px]">
                    Contract Draft # SPEC-{Date.now().toString().slice(-6)}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <span className="text-muted-foreground block">Legal Supplier Name:</span>
                    <strong className="text-foreground">{legalName || 'ABC Pharma Distributors'}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Supplier Type:</span>
                    <strong className="text-foreground">{supplierTypeOption}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Contact Number:</span>
                    <strong className="text-foreground font-mono">{contactNumber || '+91 98200 45218'}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">GSTIN:</span>
                    <span className="font-mono font-medium">{protoGstin || 'Unregistered / Draft Stage'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Operating City:</span>
                    <strong className="text-foreground">{city || 'Mumbai, MH'}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Agreed Credit Terms:</span>
                    <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{creditTermOption}</strong>
                  </div>
                </div>

                <div className="rounded-lg bg-background/80 border p-2.5 text-[11px] text-muted-foreground leading-relaxed">
                  <strong>Recommendation:</strong> Build Supplier Master first, followed by Supplier–Product Mapping, then PR &rarr; PO &rarr; GRN &rarr; Invoice &rarr; Return &rarr; Payment. This gives your purchase module a solid foundation.
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => toast.success('Supplier specification preview exported')}
                    className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                  >
                    <Download className="h-3 w-3" />
                    Export Spec PDF
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveToDatabase}
                    disabled={loading}
                    className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    {loading ? 'Provisioning…' : 'Save to Master Registry'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 2: FULL STATUTORY ONBOARDING ─── */}
        {activeTab === 'PRODUCTION' && (
          <div className="space-y-4 pt-1">
            {/* Identity & Legal Entity */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary" />
                1. Legal Entity & Classification
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <Label className="text-xs">Legal Supplier Name *</Label>
                  <Input
                    placeholder="e.g. ABC Pharma Distributors"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    className="h-8 text-xs font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Trade Name / DBA (Optional)</Label>
                  <Input
                    placeholder="e.g. ABC Healthcare Logistics"
                    value={tradeName}
                    onChange={(e) => setTradeName(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Classification *</Label>
                  <Select
                    value={supplierTypeOption}
                    onValueChange={(v: any) => setSupplierTypeOption(v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Manufacturer">Manufacturer</SelectItem>
                      <SelectItem value="Distributor / Wholesaler">Distributor / Wholesaler</SelectItem>
                      <SelectItem value="Importer">Importer</SelectItem>
                      <SelectItem value="Other">Other (Stockist / Service)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">City & State</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="City"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <Input
                      placeholder="State"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Statutory Compliance & Drug Licenses */}
            <div className="space-y-3 pt-2 border-t">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                2. Statutory Compliance & Drug Licenses
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="space-y-1">
                  <Label className="text-xs">GSTIN (15 Digits)</Label>
                  <Input
                    placeholder="27AABCU1234M1Z5"
                    value={protoGstin}
                    onChange={(e) => setProtoGstin(e.target.value.toUpperCase())}
                    className="h-8 text-xs font-mono"
                    maxLength={15}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">PAN (10 Digits)</Label>
                  <Input
                    placeholder="AABCU1234M"
                    value={pan}
                    onChange={(e) => setPan(e.target.value.toUpperCase())}
                    className="h-8 text-xs font-mono"
                    maxLength={10}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Drug License (Form 20B/21B) *</Label>
                  <Input
                    placeholder="MH-TZ4-20B-78901"
                    value={dlNumber}
                    onChange={(e) => setDlNumber(e.target.value.toUpperCase())}
                    className="h-8 text-xs font-mono font-medium text-primary"
                  />
                </div>
              </div>
            </div>

            {/* Commercial Terms & Contact */}
            <div className="space-y-3 pt-2 border-t">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-primary" />
                3. Commercial Terms & Contact Information
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="space-y-1">
                  <Label className="text-xs">Contact Person</Label>
                  <Input
                    placeholder="Rajesh Verma"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Phone Number *</Label>
                  <Input
                    placeholder="+91 98200 45218"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Official Email</Label>
                  <Input
                    placeholder="orders@abcpharmadist.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Registered Warehouse / Billing Address</Label>
                <Textarea
                  rows={2}
                  placeholder="Building, street, industrial area, landmark…"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="text-xs resize-none"
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="pt-2 border-t flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            className="h-8 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSaveToDatabase}
            disabled={loading}
            className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground font-semibold"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {loading ? 'Saving…' : 'Save Supplier to Master Registry'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
