'use client'

import React, { useEffect, useState } from 'react'
import {
  DollarSign,
  Edit2,
  Mail,
  MapPin,
  Percent,
  Phone,
  Plus,
  Search,
  Stethoscope,
  Trash2,
  UserCheck,
} from 'lucide-react'

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
import { useToast } from '@/lib/hooks/use-toast'
import { formatCurrency } from '@/lib/utils/currency'

interface DoctorItem {
  id: string
  name: string
  regNumber: string | null
  qualification: string | null
  specialization: string | null
  clinicName: string | null
  phone: string | null
  email: string | null
  commissionPercent: number
  isActive: boolean
  notes: string | null
  createdAt: string
  _count?: {
    sales: number
    commissions: number
  }
}

export function DoctorManagementView() {
  const toast = useToast()
  const [doctors, setDoctors] = useState<DoctorItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  // Form states
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [regNumber, setRegNumber] = useState('')
  const [qualification, setQualification] = useState('')
  const [specialization, setSpecialization] = useState('')
  const [clinicName, setClinicName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [commissionPercent, setCommissionPercent] = useState<number>(5)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const loadDoctors = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/doctors?limit=100')
      const json = await res.json()
      if (json.success) {
        setDoctors(json.data)
      }
    } catch {
      toast.error('Failed to load doctors list')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDoctors()
  }, [])

  const resetForm = () => {
    setEditingId(null)
    setName('')
    setRegNumber('')
    setQualification('')
    setSpecialization('')
    setClinicName('')
    setPhone('')
    setEmail('')
    setCommissionPercent(5)
    setNotes('')
  }

  const handleOpenAdd = () => {
    resetForm()
    setModalOpen(true)
  }

  const handleOpenEdit = (doc: DoctorItem) => {
    setEditingId(doc.id)
    setName(doc.name)
    setRegNumber(doc.regNumber || '')
    setQualification(doc.qualification || '')
    setSpecialization(doc.specialization || '')
    setClinicName(doc.clinicName || '')
    setPhone(doc.phone || '')
    setEmail(doc.email || '')
    setCommissionPercent(Number(doc.commissionPercent) || 0)
    setNotes(doc.notes || '')
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Doctor name is required')
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        regNumber: regNumber.trim() || undefined,
        qualification: qualification.trim() || undefined,
        specialization: specialization.trim() || undefined,
        clinicName: clinicName.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        commissionPercent: Number(commissionPercent) || 0,
        notes: notes.trim() || undefined,
      }

      const res = await fetch('/api/doctors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      if (!json.success) {
        toast.error('Failed to save doctor', json.error?.message)
        return
      }

      toast.success(editingId ? 'Doctor updated successfully' : 'Doctor registered successfully')
      setModalOpen(false)
      resetForm()
      await loadDoctors()
    } catch {
      toast.error('Error saving doctor profile')
    } finally {
      setSaving(false)
    }
  }

  const filteredDoctors = doctors.filter((d) => {
    const q = search.toLowerCase()
    return (
      d.name.toLowerCase().includes(q) ||
      d.regNumber?.toLowerCase().includes(q) ||
      d.clinicName?.toLowerCase().includes(q) ||
      d.specialization?.toLowerCase().includes(q) ||
      d.phone?.includes(q)
    )
  })

  const totalReferrals = doctors.reduce((acc, d) => acc + (d._count?.sales || 0), 0)

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Prescribing Doctor Masters</h1>
          <p className="text-muted-foreground text-sm">
            Maintain practitioner registrations, clinic associations, and commission structures
          </p>
        </div>
        <Button onClick={handleOpenAdd} className="gap-2 shadow-sm bg-primary">
          <Plus className="h-4 w-4" /> Register Doctor
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Practitioners</CardTitle>
            <Stethoscope className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{doctors.filter((d) => d.isActive).length}</div>
            <p className="text-xs text-muted-foreground mt-1">Verified prescribers registered</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Prescription Bills Tagged</CardTitle>
            <UserCheck className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReferrals}</div>
            <p className="text-xs text-muted-foreground mt-1">Invoices linked to prescribing doctors</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Commission Structure</CardTitle>
            <Percent className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {doctors.length > 0
                ? (
                    doctors.reduce((sum, d) => sum + Number(d.commissionPercent), 0) /
                    doctors.length
                  ).toFixed(1)
                : 0}
              %
            </div>
            <p className="text-xs text-muted-foreground mt-1">Average referral commission rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Actions Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, reg no, clinic..."
            className="pl-9 h-10"
          />
        </div>
      </div>

      {/* Doctor Cards / Table */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading && (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            Loading doctor master directory...
          </div>
        )}

        {!loading && filteredDoctors.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            No doctors found matching query.
          </div>
        )}

        {!loading &&
          filteredDoctors.map((doc) => (
            <Card
              key={doc.id}
              className="shadow-xs hover:border-primary/50 transition-colors flex flex-col justify-between"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Stethoscope className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-foreground">
                        Dr. {doc.name}
                      </CardTitle>
                      {doc.qualification && (
                        <p className="text-xs text-muted-foreground">{doc.qualification}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-primary/5 text-primary font-bold">
                    {doc.commissionPercent}% Comm.
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {doc.regNumber && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Medical Reg No:</span>
                    <span className="font-mono font-medium text-foreground">{doc.regNumber}</span>
                  </div>
                )}
                {doc.clinicName && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{doc.clinicName}</span>
                  </div>
                )}
                {doc.phone && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span>{doc.phone}</span>
                  </div>
                )}
                {doc.specialization && (
                  <div className="pt-1">
                    <Badge variant="secondary" className="text-[10px]">
                      {doc.specialization}
                    </Badge>
                  </div>
                )}
              </CardContent>
              <div className="border-t p-3 bg-muted/10 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  <strong>{doc._count?.sales ?? 0}</strong> bills linked
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenEdit(doc)}
                  className="h-8 text-xs gap-1.5"
                >
                  <Edit2 className="h-3.5 w-3.5" /> Edit
                </Button>
              </div>
            </Card>
          ))}
      </div>

      {/* Add / Edit Doctor Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Doctor Master' : 'Register New Prescribing Doctor'}</DialogTitle>
              <DialogDescription>
                Configure doctor details, medical registration number, and automatic bill commission rate.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3.5 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="doc-name" className="text-xs">
                    Doctor Name *
                  </Label>
                  <Input
                    id="doc-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rajesh Sharma"
                    className="h-9 text-xs"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="doc-reg" className="text-xs">
                    Medical Reg. Number
                  </Label>
                  <Input
                    id="doc-reg"
                    value={regNumber}
                    onChange={(e) => setRegNumber(e.target.value)}
                    placeholder="e.g. KMC-88231"
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="doc-qual" className="text-xs">
                    Qualification
                  </Label>
                  <Input
                    id="doc-qual"
                    value={qualification}
                    onChange={(e) => setQualification(e.target.value)}
                    placeholder="e.g. MBBS, MD (General Medicine)"
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="doc-spec" className="text-xs">
                    Specialization
                  </Label>
                  <Input
                    id="doc-spec"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    placeholder="e.g. Cardiology, Paediatrics"
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="doc-clinic" className="text-xs">
                    Hospital / Clinic Name
                  </Label>
                  <Input
                    id="doc-clinic"
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                    placeholder="e.g. Care Polyclinic"
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="doc-commission" className="text-xs">
                    Commission Rate (%)
                  </Label>
                  <Input
                    id="doc-commission"
                    type="number"
                    min={0}
                    max={100}
                    step="0.5"
                    value={commissionPercent}
                    onChange={(e) => setCommissionPercent(Number(e.target.value))}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="doc-phone" className="text-xs">
                    Phone / Mobile
                  </Label>
                  <Input
                    id="doc-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="doc-email" className="text-xs">
                    Email Address
                  </Label>
                  <Input
                    id="doc-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="doctor@clinic.com"
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="doc-notes" className="text-xs">
                  Internal Remarks / Notes
                </Label>
                <Input
                  id="doc-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Regular prescriber for paediatric drops"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? 'Saving...' : editingId ? 'Update Doctor' : 'Save Doctor'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
