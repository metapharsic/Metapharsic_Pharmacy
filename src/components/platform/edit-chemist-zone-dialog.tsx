'use client'

import React, { useState, useEffect } from 'react'
import {
  Building2,
  Check,
  Copy,
  Globe,
  KeyRound,
  Lock,
  MapPin,
  RefreshCw,
  Shield,
  ShieldAlert,
  Sparkles,
  Store,
  User,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { TerritoryCode } from '@/lib/territory/territory-config'
import { GeoZoneName } from '@/lib/platform/geo-zones'

export interface ChemistEditData {
  organizationId: string
  organizationCode?: string | null
  shopName: string
  legalName?: string | null
  zone: string
  countryCode: string
  city?: string | null
  state?: string | null
  address?: string | null
  pincode?: string | null
  phone?: string | null
  email?: string | null
  dlNumber?: string | null
  gstin?: string | null
  status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED'
  subscriptionPlan?: 'TRIAL' | 'STARTER' | 'GROWTH' | 'ENTERPRISE'
  adminUser?: {
    id: string
    name: string
    email: string
    phone?: string | null
  } | null
  allUsers?: {
    id: string
    name: string
    email: string
    phone?: string | null
    isActive: boolean
    role?: string
  }[]
}

const AVAILABLE_ZONES: { name: GeoZoneName; flag: string; countryCode: TerritoryCode; label: string }[] = [
  { name: 'KSA - Central Region (Riyadh)', flag: '🇸🇦', countryCode: 'SA', label: 'KSA — Central Region (Riyadh)' },
  { name: 'KSA - Western Region (Makkah/Jeddah)', flag: '🇸🇦', countryCode: 'SA', label: 'KSA — Western Region (Makkah/Jeddah)' },
  { name: 'KSA - Eastern Province (Dammam)', flag: '🇸🇦', countryCode: 'SA', label: 'KSA — Eastern Province (Dammam)' },
  { name: 'Oman - Muscat Capital Region', flag: '🇴🇲', countryCode: 'OM', label: 'Oman — Muscat Capital Region' },
  { name: 'Oman - Dhofar & Regional', flag: '🇴🇲', countryCode: 'OM', label: 'Oman — Dhofar & Regional (Salalah, Sohar)' },
  { name: 'Qatar - Doha & Al Rayyan', flag: '🇶🇦', countryCode: 'QA', label: 'Qatar — Doha & Al Rayyan' },
  { name: 'Bahrain - Manama & Muharraq', flag: '🇧🇭', countryCode: 'BH', label: 'Bahrain — Manama & Muharraq' },
  { name: 'Maldives - Greater Malé', flag: '🇲🇻', countryCode: 'MV', label: 'Maldives — Greater Malé' },
  { name: 'India - South Zone', flag: '🇮🇳', countryCode: 'IN', label: 'India — South Zone (Hyderabad, Bengaluru, Chennai)' },
  { name: 'India - West Zone', flag: '🇮🇳', countryCode: 'IN', label: 'India — West Zone (Mumbai, Pune, Ahmedabad)' },
  { name: 'India - North Zone', flag: '🇮🇳', countryCode: 'IN', label: 'India — North Zone (Delhi, Chandigarh, Jaipur)' },
  { name: 'India - East & Central', flag: '🇮🇳', countryCode: 'IN', label: 'India — East & Central (Kolkata, Patna, Bhopal)' },
  { name: 'On-Premises / LAN', flag: '🏢', countryCode: 'SA', label: 'On-Premises / Local LAN Dedicated' },
]

const SOVEREIGN_COUNTRIES: { code: TerritoryCode; name: string; flag: string; currency: string }[] = [
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦', currency: 'SAR' },
  { code: 'OM', name: 'Sultanate of Oman', flag: '🇴🇲', currency: 'OMR' },
  { code: 'BH', name: 'Kingdom of Bahrain', flag: '🇧🇭', currency: 'BHD' },
  { code: 'QA', name: 'State of Qatar', flag: '🇶🇦', currency: 'QAR' },
  { code: 'MV', name: 'Republic of Maldives', flag: '🇲🇻', currency: 'MVR' },
  { code: 'IN', name: 'Republic of India', flag: '🇮🇳', currency: 'INR' },
]

function generateSecurePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let randomStr = ''
  for (let i = 0; i < 6; i++) {
    randomStr += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `Pharmacy@${randomStr}#2026`
}

interface EditChemistZoneDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: ChemistEditData | null
  onSuccess?: () => void
}

export function EditChemistZoneDialog({
  open,
  onOpenChange,
  data,
  onSuccess,
}: EditChemistZoneDialogProps) {
  const [shopName, setShopName] = useState('')
  const [legalName, setLegalName] = useState('')
  const [zone, setZone] = useState<string>('KSA - Central Region (Riyadh)')
  const [countryCode, setCountryCode] = useState<string>('SA')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [address, setAddress] = useState('')
  const [pincode, setPincode] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [dlNumber, setDlNumber] = useState('')
  const [gstin, setGstin] = useState('')
  const [status, setStatus] = useState<'ACTIVE' | 'SUSPENDED' | 'EXPIRED'>('ACTIVE')
  const [subscriptionPlan, setSubscriptionPlan] = useState<'TRIAL' | 'STARTER' | 'GROWTH' | 'ENTERPRISE'>('GROWTH')

  // Password reset section
  const [includePasswordReset, setIncludePasswordReset] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [newPassword, setNewPassword] = useState('')
  const [copiedPassword, setCopiedPassword] = useState(false)

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (data && open) {
      setShopName(data.shopName || '')
      setLegalName(data.legalName || '')
      setZone(data.zone || 'KSA - Central Region (Riyadh)')
      setCountryCode(data.countryCode || 'SA')
      setCity(data.city || '')
      setState(data.state || '')
      setAddress(data.address || '')
      setPincode(data.pincode || '')
      setPhone(data.phone || '')
      setEmail(data.email || '')
      setDlNumber(data.dlNumber || '')
      setGstin(data.gstin || '')
      setStatus(data.status || 'ACTIVE')
      setSubscriptionPlan(data.subscriptionPlan || 'GROWTH')

      setIncludePasswordReset(false)
      const primaryAdmin = data.adminUser?.id || (data.allUsers && data.allUsers[0]?.id) || ''
      setSelectedUserId(primaryAdmin)
      setNewPassword(generateSecurePassword())
      setCopiedPassword(false)
    }
  }, [data, open])

  // When Zone changes, auto-align country if matching
  const handleZoneChange = (newZone: string) => {
    setZone(newZone)
    const matched = AVAILABLE_ZONES.find((z) => z.name === newZone)
    if (matched) {
      setCountryCode(matched.countryCode)
    }
  }

  // When Country changes, pick first matching zone
  const handleCountryChange = (newCountry: string) => {
    setCountryCode(newCountry)
    const matchingZone = AVAILABLE_ZONES.find((z) => z.countryCode === newCountry)
    if (matchingZone) {
      setZone(matchingZone.name)
    }
  }

  const handleCopyPassword = () => {
    if (navigator.clipboard && newPassword) {
      navigator.clipboard.writeText(newPassword)
      setCopiedPassword(true)
      toast.success('Password copied to clipboard!')
      setTimeout(() => setCopiedPassword(false), 2000)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!data?.organizationId) return

    if (!shopName.trim()) {
      toast.error('Chemist shop name is required')
      return
    }

    if (includePasswordReset && (!newPassword || newPassword.length < 6)) {
      toast.error('Password must be at least 6 characters')
      return
    }

    try {
      setSaving(true)
      const payload: Record<string, any> = {
        name: shopName.trim(),
        legalName: legalName.trim() || null,
        zone: zone.trim(),
        country: countryCode.trim(),
        city: city.trim() || null,
        state: state.trim() || null,
        address: address.trim() || null,
        pincode: pincode.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        dlNumber: dlNumber.trim() || null,
        gstin: gstin.trim() || null,
        status,
        subscriptionPlan,
      }

      if (includePasswordReset) {
        payload.adminUserId = selectedUserId || undefined
        payload.resetPassword = newPassword.trim()
      }

      const res = await fetch(`/api/platform/organizations/${data.organizationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      if (res.ok && json.success) {
        if (includePasswordReset) {
          if (navigator.clipboard) {
            navigator.clipboard.writeText(newPassword.trim()).catch(() => null)
          }
          toast.success('🛡️ Chemist & Password Updated Successfully', {
            description: `New password "${newPassword.trim()}" copied to clipboard.`,
            duration: 8000,
          })
        } else {
          toast.success('🛡️ Chemist Organization Updated', {
            description: json.message || 'Details saved successfully.',
          })
        }
        onOpenChange(false)
        if (onSuccess) onSuccess()
      } else {
        toast.error('Update Failed', {
          description: json.error?.message || json.error || 'Server rejected changes',
        })
      }
    } catch (err: any) {
      toast.error('Network Error', { description: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-teal-500/15 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
              <Store className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <span>Modify Onboarded Chemist Shop &amp; Zone</span>
                {data?.organizationCode && (
                  <Badge variant="outline" className="font-mono text-[10px] uppercase">
                    {data.organizationCode}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Re-assign geopolitical sovereign zones, update licensing details, or synchronize credentials for this dispensary node.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Sovereign Zone & Territory Alignment */}
          <div className="p-3 rounded-lg border border-teal-500/30 bg-teal-500/5 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-teal-600" />
                <span>Geopolitical Zone &amp; Sovereign Authority</span>
              </Label>
              <Badge variant="outline" className="text-[10px] font-mono text-teal-700 border-teal-500/40">
                Sovereign Cloud
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  Assigned Geopolitical Zone:
                </Label>
                <Select value={zone} onValueChange={handleZoneChange}>
                  <SelectTrigger className="h-8 text-xs font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_ZONES.map((z) => (
                      <SelectItem key={z.name} value={z.name} className="text-xs">
                        {z.flag} {z.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  Sovereign Nation / Jurisdiction:
                </Label>
                <Select value={countryCode} onValueChange={handleCountryChange}>
                  <SelectTrigger className="h-8 text-xs font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOVEREIGN_COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code} className="text-xs">
                        {c.flag} {c.name} ({c.currency})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Chemist Shop Identity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs font-semibold">Chemist Shop Display Name *</Label>
              <Input
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="e.g. Belqees Pharmacy Muscat, Apollo Pharmacy"
                className="h-8 text-xs font-medium"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Legal Entity Name</Label>
              <Input
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="Registered LLC or Trade Name"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Operational Status</Label>
              <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active (Online &amp; Dispensing)</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended (Blocked Access)</SelectItem>
                  <SelectItem value="EXPIRED">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Location & Tax IDs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">City</Label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Muscat, Riyadh, Mumbai"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">State / Governorate</Label>
              <Input
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g. Muscat, Central, Maharashtra"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Postal / PIN Code</Label>
              <Input
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="e.g. 111, 12211, 500001"
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="space-y-1 sm:col-span-3">
              <Label className="text-xs font-semibold">Dispensary Street Address</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Building, street, counter number..."
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Drug License (DL #)</Label>
              <Input
                value={dlNumber}
                onChange={(e) => setDlNumber(e.target.value)}
                placeholder="MoH/SFDA/CDSCO License"
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Tax / VAT / GSTIN ID</Label>
              <Input
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                placeholder="VAT or GST Identification"
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Contact Phone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+968 ... or +966 ..."
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          {/* Integrated SuperAdmin Password Reset Section */}
          <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-amber-600" />
                <div>
                  <div className="text-xs font-bold text-foreground">
                    Reset Chemist Staff / Admin Password
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Directly reset credentials with instant BCrypt synchronization and account unlock.
                  </div>
                </div>
              </div>
              <Switch
                checked={includePasswordReset}
                onCheckedChange={setIncludePasswordReset}
              />
            </div>

            {includePasswordReset && (
              <div className="space-y-3 pt-2 border-t border-amber-500/20">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">
                      Target Personnel to Reset:
                    </Label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select staff member" />
                      </SelectTrigger>
                      <SelectContent>
                        {data?.adminUser && (
                          <SelectItem value={data.adminUser.id} className="text-xs">
                            ⭐ Shop Admin: {data.adminUser.name} ({data.adminUser.email})
                          </SelectItem>
                        )}
                        {data?.allUsers
                          ?.filter((u) => u.id !== data.adminUser?.id)
                          .map((u) => (
                            <SelectItem key={u.id} value={u.id} className="text-xs">
                              {u.role || 'Staff'}: {u.name} ({u.email})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] font-semibold text-muted-foreground">
                        New Password:
                      </Label>
                      <button
                        type="button"
                        onClick={() => setNewPassword(generateSecurePassword())}
                        className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                      >
                        <Sparkles className="h-3 w-3" />
                        Generate Strong
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Input
                        type="text"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        className="h-8 text-xs font-mono"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCopyPassword}
                        className="h-8 px-2 shrink-0"
                        title="Copy password"
                      >
                        {copiedPassword ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 p-2 rounded">
                  ⚠️ This action will immediately update the database password hash, clear any failed login lockouts, and store the credential in the SuperAdmin Vault.
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving}
              className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${saving ? 'animate-spin' : ''}`} />
              <span>{saving ? 'Synchronizing...' : 'Save & Synchronize Chemist'}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface ResetChemistPasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  userName: string
  userEmail: string
  organizationId?: string
  shopName?: string
  onSuccess?: () => void
}

export function ResetChemistPasswordDialog({
  open,
  onOpenChange,
  userId,
  userName,
  userEmail,
  organizationId,
  shopName,
  onSuccess,
}: ResetChemistPasswordDialogProps) {
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (open) {
      setPassword(generateSecurePassword())
      setCopied(false)
    }
  }, [open])

  const handleCopy = () => {
    if (navigator.clipboard && password) {
      navigator.clipboard.writeText(password)
      setCopied(true)
      toast.success('Password copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || !password) return
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    try {
      setSaving(true)
      const res = await fetch('/api/platform/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset-password',
          userId,
          newPassword: password.trim(),
        }),
      })

      const json = await res.json()
      if (res.ok && json.success) {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(password.trim()).catch(() => null)
        }
        toast.success(`🔑 Password Reset Successful for ${userName || userEmail}`, {
          description: `New password "${password.trim()}" copied to clipboard.`,
          duration: 8000,
        })
        onOpenChange(false)
        if (onSuccess) onSuccess()
      } else {
        toast.error('Reset Failed', {
          description: json.error || 'Server rejected password reset',
        })
      }
    } catch (err: any) {
      toast.error('Network Error', { description: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Reset Chemist Password
              </DialogTitle>
              <DialogDescription className="text-xs">
                {shopName ? `${shopName} • ` : ''}
                {userName} ({userEmail})
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleReset} className="space-y-4 pt-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">New Assigned Password *</Label>
              <button
                type="button"
                onClick={() => setPassword(generateSecurePassword())}
                className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
              >
                <Sparkles className="h-3 w-3" />
                Generate New
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
                className="h-9 text-xs font-mono"
                required
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="h-9 px-3 shrink-0"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-muted text-[11px] text-muted-foreground space-y-1">
            <div className="font-semibold text-foreground">Immediate Effect:</div>
            <div>• Hashes password with BCrypt (12 rounds).</div>
            <div>• Clears failed login counter and unlocks user.</div>
            <div>• Stores in SuperAdmin Vault for recovery.</div>
          </div>

          <DialogFooter className="pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
            >
              <KeyRound className={`h-3.5 w-3.5 ${saving ? 'animate-spin' : ''}`} />
              <span>{saving ? 'Resetting...' : 'Confirm Reset Password'}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
