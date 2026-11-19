'use client'

import React, { useEffect, useRef, useState } from 'react'
import {
  Clock,
  History,
  Phone,
  Plus,
  Search,
  Tag,
  User,
  UserCheck,
  UserPlus,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/lib/hooks/use-toast'

export interface CustomerProfileData {
  id: string
  name: string
  phone: string | null
  email?: string | null
  address?: string | null
  discountTier?: string | null
  patientDiscountPercent?: number
  outstandingBalance: number
  recentPurchases?: Array<{
    id: string
    invoiceNumber: string
    date: string | Date
    totalAmount: number
    doctorName?: string | null
    items: Array<{ name: string; quantity: number; rate: number }>
  }>
}

interface CustomerProfilingBarProps {
  selectedCustomer: CustomerProfileData | null
  onSelectCustomer: (customer: CustomerProfileData | null) => void
  onApplyPatientDiscount?: (discountPercent: number) => void
}

export function CustomerProfilingBar({
  selectedCustomer,
  onSelectCustomer,
  onApplyPatientDiscount,
}: CustomerProfilingBarProps) {
  const toast = useToast()
  const [phoneQuery, setPhoneQuery] = useState('')
  const [debouncedPhone, setDebouncedPhone] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  // Quick add form states
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newTier, setNewTier] = useState('REGULAR')
  const [newDiscountPercent, setNewDiscountPercent] = useState(0)
  const [savingNewCustomer, setSavingNewCustomer] = useState(false)

  const phoneInputRef = useRef<HTMLInputElement>(null)

  // Alt + N shortcut to focus phone search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        onSelectCustomer(null)
        setPhoneQuery('')
        phoneInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onSelectCustomer])

  // Debounce phone query
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedPhone(phoneQuery.trim())
    }, 400)
    return () => clearTimeout(t)
  }, [phoneQuery])

  // Lookup customer when phone reaches 5+ characters
  useEffect(() => {
    if (debouncedPhone.length < 5) return

    setIsSearching(true)
    fetch(`/api/customers/lookup?phone=${encodeURIComponent(debouncedPhone)}`, {
      cache: 'no-store',
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          onSelectCustomer(json.data)
          if (json.data.patientDiscountPercent && onApplyPatientDiscount) {
            onApplyPatientDiscount(json.data.patientDiscountPercent)
            toast.success(
              `Patient Profile Loaded: ${json.data.name}`,
              `Applied ${json.data.patientDiscountPercent}% ${json.data.discountTier || 'Patient'} Discount`
            )
          }
        }
      })
      .catch(() => {})
      .finally(() => setIsSearching(false))
  }, [debouncedPhone])

  const handleClear = () => {
    onSelectCustomer(null)
    setPhoneQuery('')
    if (onApplyPatientDiscount) onApplyPatientDiscount(0)
    phoneInputRef.current?.focus()
  }

  const handleQuickAddSubmit = async () => {
    if (!newName.trim() || !newPhone.trim()) {
      toast.error('Patient name and phone number are required')
      return
    }

    setSavingNewCustomer(true)
    try {
      const res = await fetch('/api/customers/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          phone: newPhone.trim(),
          discountTier: newTier,
          patientDiscountPercent: newDiscountPercent,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to create patient profile')
      }

      onSelectCustomer(json.data)
      if (json.data.patientDiscountPercent && onApplyPatientDiscount) {
        onApplyPatientDiscount(json.data.patientDiscountPercent)
      }
      toast.success(`Patient profile created for ${json.data.name}`)
      setQuickAddOpen(false)
      setNewName('')
      setNewPhone('')
    } catch (err: any) {
      toast.error(err.message || 'Error creating profile')
    } finally {
      setSavingNewCustomer(false)
    }
  }

  return (
    <div className="bg-card border rounded-xl p-3 shadow-sm">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        {/* Mobile Input / Selected Customer Pill */}
        <div className="flex items-center gap-2 flex-1 w-full">
          {!selectedCustomer ? (
            <div className="relative flex-1">
              <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                ref={phoneInputRef}
                type="tel"
                placeholder="Enter Patient Mobile Number (Alt + N to start)..."
                value={phoneQuery}
                onChange={(e) => setPhoneQuery(e.target.value)}
                className="pl-9 h-9 text-xs font-mono font-medium"
              />
              {phoneQuery && (
                <button
                  type="button"
                  onClick={() => setPhoneQuery('')}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 p-1.5 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs w-full justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-emerald-600" />
                <span className="font-bold text-emerald-950 dark:text-emerald-200">
                  {selectedCustomer.name}
                </span>
                {selectedCustomer.phone && (
                  <span className="font-mono text-muted-foreground">({selectedCustomer.phone})</span>
                )}
                {selectedCustomer.discountTier && selectedCustomer.discountTier !== 'REGULAR' && (
                  <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-400 text-[10px] py-0">
                    <Tag className="h-2.5 w-2.5 mr-1" />
                    {selectedCustomer.discountTier} ({selectedCustomer.patientDiscountPercent || 0}%)
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-3">
                {selectedCustomer.outstandingBalance > 0 && (
                  <span className="text-rose-600 font-bold font-mono">
                    Balance: ₹{selectedCustomer.outstandingBalance.toFixed(2)} Dr
                  </span>
                )}

                {/* Past Purchases History Button */}
                {selectedCustomer.recentPurchases && selectedCustomer.recentPurchases.length > 0 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                        <History className="h-3.5 w-3.5 text-primary" />
                        Past Visits ({selectedCustomer.recentPurchases.length})
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-3 text-xs" align="end">
                      <div className="font-semibold pb-2 border-b flex items-center justify-between">
                        <span>Past Billing History</span>
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="divide-y max-h-56 overflow-y-auto mt-2 space-y-2">
                        {selectedCustomer.recentPurchases.map((sale) => (
                          <div key={sale.id} className="pt-2 text-[11px]">
                            <div className="flex justify-between font-mono font-medium">
                              <span>{sale.invoiceNumber}</span>
                              <span>₹{sale.totalAmount.toFixed(2)}</span>
                            </div>
                            <div className="text-muted-foreground">
                              {new Date(sale.date).toLocaleDateString()}
                              {sale.doctorName && ` • Dr. ${sale.doctorName}`}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                              {sale.items.map((i) => `${i.name} (x${i.quantity})`).join(', ')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={handleClear}
                  title="Remove patient / Change"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Quick Add Patient Button */}
        {!selectedCustomer && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setNewPhone(phoneQuery)
              setQuickAddOpen(true)
            }}
            className="h-9 text-xs gap-1.5 shrink-0"
          >
            <UserPlus className="h-3.5 w-3.5 text-primary" />
            Quick Add Patient
          </Button>
        )}
      </div>

      {/* Quick Add Patient Dialog */}
      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              Quick Register Patient
            </DialogTitle>
            <DialogDescription className="text-xs">
              Instantly create a patient profile with custom discount tier.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Patient Full Name *</Label>
              <Input
                placeholder="e.g. Ramesh Kumar"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Mobile Number *</Label>
              <Input
                placeholder="10-digit mobile number"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="h-9 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Patient Pricing Tier</Label>
                <Select
                  value={newTier}
                  onValueChange={(val) => {
                    setNewTier(val)
                    if (val === 'CHRONIC_PATIENT') setNewDiscountPercent(10)
                    else if (val === 'SENIOR_CITIZEN') setNewDiscountPercent(5)
                    else if (val === 'WHOLESALE') setNewDiscountPercent(15)
                    else setNewDiscountPercent(0)
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="REGULAR">Regular (0%)</SelectItem>
                    <SelectItem value="CHRONIC_PATIENT">Chronic Patient (10%)</SelectItem>
                    <SelectItem value="SENIOR_CITIZEN">Senior Citizen (5%)</SelectItem>
                    <SelectItem value="WHOLESALE">Wholesale (15%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Discount %</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={newDiscountPercent}
                  onChange={(e) => setNewDiscountPercent(parseFloat(e.target.value) || 0)}
                  className="h-9 font-mono text-right"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setQuickAddOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleQuickAddSubmit}
              disabled={savingNewCustomer || !newName.trim() || !newPhone.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Save & Attach
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
