'use client'

// ─────────────────────────────────────────────────────────────
// Component — CustomerFormDialog
// Modal dialog wrapping CustomerForm for create and edit modes.
// ─────────────────────────────────────────────────────────────
import { zodResolver } from '@hookform/resolvers/zod'
import {
  AlertCircle,
  Building2,
  CreditCard,
  FileText,
  Loader2,
  MapPin,
  Percent,
  Plus,
  Save,
  User,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { ROUTES } from '@/lib/constants/routes'
import { useToast } from '@/lib/hooks/use-toast'
import { createCustomerSchema } from '@/lib/validations/customer'

type CustomerFormValues = z.infer<typeof createCustomerSchema>

export interface CustomerFormDefaults {
  id?: string
  name?: string
  phone?: string | null
  email?: string | null
  gstin?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  creditLimit?: number
  creditDays?: number
  discountTier?: string | null
  patientDiscountPercent?: number
  notes?: string | null
  isActive?: boolean
}

interface CustomerFormDialogProps {
  mode: 'create' | 'edit'
  defaultValues?: CustomerFormDefaults
  trigger?: React.ReactNode
  onSuccess?: () => void
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
        {title}
      </span>
      <Separator className="flex-1" />
    </div>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="flex items-center gap-1 text-xs text-destructive mt-1">
      <AlertCircle className="h-3 w-3 flex-shrink-0" />
      {message}
    </p>
  )
}

function CustomerFormInner({
  mode,
  defaultValues,
  onSuccess,
  onClose,
}: {
  mode: 'create' | 'edit'
  defaultValues?: CustomerFormDefaults
  onSuccess?: () => void
  onClose?: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
    reset,
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      phone: defaultValues?.phone ?? '',
      email: defaultValues?.email ?? '',
      gstin: defaultValues?.gstin ?? '',
      address: defaultValues?.address ?? '',
      city: defaultValues?.city ?? '',
      state: defaultValues?.state ?? '',
      pincode: defaultValues?.pincode ?? '',
      creditLimit: defaultValues?.creditLimit ?? 0,
      creditDays: defaultValues?.creditDays ?? 0,
      discountTier: defaultValues?.discountTier ?? 'REGULAR',
      patientDiscountPercent: defaultValues?.patientDiscountPercent ?? 0,
      notes: defaultValues?.notes ?? '',
      isActive: defaultValues?.isActive ?? true,
    },
  })

  const discountTier = watch('discountTier')

  const onSubmit = async (data: CustomerFormValues) => {
    setIsSubmitting(true)
    try {
      const url =
        mode === 'edit' && defaultValues?.id
          ? `/api/customers/${defaultValues.id}`
          : '/api/customers'
      const method = mode === 'edit' ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const json = (await res.json()) as {
        success: boolean
        data?: { id: string; name: string }
        error?: { message: string }
      }

      if (!res.ok || !json.success) {
        toast.error(
          mode === 'create' ? 'Failed to create customer' : 'Failed to update customer',
          json.error?.message
        )
        return
      }

      toast.success(
        mode === 'create'
          ? `Customer "${json.data?.name}" registered`
          : `Customer "${json.data?.name}" updated`
      )

      reset()
      if (onClose) {
        onClose()
      } else {
        router.push(ROUTES.CUSTOMERS)
      }
      if (onSuccess) {
        onSuccess()
      } else {
        router.refresh()
      }
    } catch {
      toast.error('Unexpected error. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {/* ── Basic Info ────────────────────────────── */}
      <SectionHeader icon={User} title="Patient & Customer Details" />

      <div className="space-y-1.5">
        <Label htmlFor="cust-name">
          Customer / Patient Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="cust-name"
          placeholder="e.g. Ramesh Kumar"
          {...register('name')}
          aria-invalid={!!errors.name}
        />
        <FieldError message={errors.name?.message} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="cust-phone">Phone Number</Label>
          <Input id="cust-phone" type="tel" placeholder="+91 98765 43210" {...register('phone')} />
          <FieldError message={errors.phone?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cust-email">Email Address</Label>
          <Input id="cust-email" type="email" placeholder="patient@example.com" {...register('email')} />
          <FieldError message={errors.email?.message} />
        </div>
      </div>

      {/* ── Clinical & Pricing Tiers ────────────────── */}
      <SectionHeader icon={Percent} title="Category & Patient Discount" />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="cust-tier">Patient Category / Tier</Label>
          <Select
            value={discountTier}
            onValueChange={(val) => {
              setValue('discountTier', val, { shouldDirty: true })
              if (val === 'SENIOR_CITIZEN' && watch('patientDiscountPercent') === 0) {
                setValue('patientDiscountPercent', 10, { shouldDirty: true })
              } else if (val === 'CHRONIC_PATIENT' && watch('patientDiscountPercent') === 0) {
                setValue('patientDiscountPercent', 5, { shouldDirty: true })
              }
            }}
          >
            <SelectTrigger id="cust-tier">
              <SelectValue placeholder="Select Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="REGULAR">Regular Patient</SelectItem>
              <SelectItem value="CHRONIC_PATIENT">Chronic Care (Diabetes/BP)</SelectItem>
              <SelectItem value="SENIOR_CITIZEN">Senior Citizen (60+)</SelectItem>
              <SelectItem value="WHOLESALE">Wholesale / Institutional</SelectItem>
              <SelectItem value="STAFF">Hospital / Clinic Staff</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cust-discount">Special Discount %</Label>
          <Input
            id="cust-discount"
            type="number"
            min={0}
            max={100}
            step={0.5}
            placeholder="0"
            {...register('patientDiscountPercent', { valueAsNumber: true })}
          />
          <FieldError message={errors.patientDiscountPercent?.message} />
        </div>
      </div>

      {/* ── Credit Terms ──────────────────────────── */}
      <SectionHeader icon={CreditCard} title="Credit & Ledger Facility" />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="cust-credit-limit">Credit Limit (₹)</Label>
          <Input
            id="cust-credit-limit"
            type="number"
            min={0}
            placeholder="0"
            {...register('creditLimit', { valueAsNumber: true })}
          />
          <FieldError message={errors.creditLimit?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cust-credit-days">Credit Days Allowed</Label>
          <Input
            id="cust-credit-days"
            type="number"
            min={0}
            max={365}
            placeholder="0"
            {...register('creditDays', { valueAsNumber: true })}
          />
          <FieldError message={errors.creditDays?.message} />
        </div>
      </div>

      {/* ── Address & Statutory ────────────────────── */}
      <SectionHeader icon={MapPin} title="Address & GSTIN" />

      <div className="space-y-1.5">
        <Label htmlFor="cust-address">Street Address</Label>
        <Textarea id="cust-address" placeholder="Flat / Building / Area" rows={2} {...register('address')} />
        <FieldError message={errors.address?.message} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="cust-city">City</Label>
          <Input id="cust-city" placeholder="Bangalore" {...register('city')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cust-state">State</Label>
          <Input id="cust-state" placeholder="Karnataka" {...register('state')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cust-pincode">Pincode</Label>
          <Input id="cust-pincode" placeholder="560001" maxLength={10} {...register('pincode')} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cust-gstin">GSTIN (Optional for B2B Customers)</Label>
        <Input
          id="cust-gstin"
          placeholder="29AAAAA0000A1Z5"
          maxLength={15}
          className="uppercase max-w-xs"
          {...register('gstin')}
        />
        <FieldError message={errors.gstin?.message} />
      </div>

      {/* ── Internal Notes ─────────────────────────── */}
      <SectionHeader icon={FileText} title="Clinical & Account Notes" />

      <div className="space-y-1.5">
        <Textarea
          id="cust-notes"
          placeholder="Known drug allergies, special medical history, or payment terms..."
          rows={2}
          {...register('notes')}
        />
      </div>

      {/* ── Footer actions ────────────────────────── */}
      <div className="flex items-center gap-3 pt-3 border-t">
        <Button type="submit" disabled={isSubmitting || (mode === 'edit' && !isDirty)}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {mode === 'create' ? 'Creating…' : 'Saving…'}
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {mode === 'create' ? 'Register Customer' : 'Save Changes'}
            </>
          )}
        </Button>
        <Button
          variant="outline"
          type="button"
          onClick={onClose ?? (() => router.push(ROUTES.CUSTOMERS))}
        >
          Cancel
        </Button>
        {mode === 'edit' && !isDirty && (
          <span className="text-xs text-muted-foreground ml-auto">No changes</span>
        )}
      </div>
    </form>
  )
}

export function CustomerFormDialog({
  mode,
  defaultValues,
  trigger,
  onSuccess,
}: CustomerFormDialogProps) {
  const [open, setOpen] = useState(false)

  const defaultTrigger =
    mode === 'create' ? (
      <Button id="btn-new-customer">
        <Plus className="mr-2 h-4 w-4" />
        New Customer
      </Button>
    ) : (
      <Button variant="ghost" size="sm" id={`btn-edit-customer-${defaultValues?.id ?? 'unknown'}`}>
        Edit
      </Button>
    )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>

      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        aria-describedby="customer-dialog-desc"
      >
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Register New Customer / Patient' : `Edit — ${defaultValues?.name ?? 'Customer'}`}
          </DialogTitle>
          <DialogDescription id="customer-dialog-desc">
            {mode === 'create'
              ? 'Add patient record with contact, clinical category, and credit terms.'
              : 'Update patient profile details. Only changed fields will be updated.'}
          </DialogDescription>
        </DialogHeader>

        <CustomerFormInner
          mode={mode}
          defaultValues={defaultValues}
          onSuccess={onSuccess}
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
