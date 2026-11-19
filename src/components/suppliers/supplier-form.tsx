'use client'

// ─────────────────────────────────────────────────────────────
// Component — SupplierFormDialog
// Modal dialog wrapping SupplierForm for create and edit modes.
// Triggered from the suppliers list; no page navigation needed.
// ─────────────────────────────────────────────────────────────
import { zodResolver } from '@hookform/resolvers/zod'
import {
  AlertCircle,
  Building2,
  CreditCard,
  FileText,
  Loader2,
  MapPin,
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
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { ROUTES } from '@/lib/constants/routes'
import { useToast } from '@/lib/hooks/use-toast'
import { createSupplierSchema } from '@/lib/validations/purchase'

// ─── Types ───────────────────────────────────────────────────

type SupplierFormValues = z.infer<typeof createSupplierSchema>

export interface SupplierFormDefaults {
  id?: string
  name?: string
  contactPerson?: string | null
  phone?: string | null
  email?: string | null
  gstin?: string | null
  pan?: string | null
  dlNumber?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  bankName?: string | null
  bankAccount?: string | null
  bankIfsc?: string | null
  creditDays?: number
  notes?: string | null
}

interface SupplierFormDialogProps {
  mode: 'create' | 'edit'
  defaultValues?: SupplierFormDefaults
  /** For edit mode — pass a custom trigger button */
  trigger?: React.ReactNode
  /** Called after a successful save so the parent can refresh its list */
  onSuccess?: () => void
}

// ─── Helper: Section Header ───────────────────────────────────

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

// ─── Helper: Field error ──────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="flex items-center gap-1 text-xs text-destructive mt-1">
      <AlertCircle className="h-3 w-3 flex-shrink-0" />
      {message}
    </p>
  )
}

// ─── Inner Form (rendered inside dialog) ─────────────────────

function SupplierFormInner({
  mode,
  defaultValues,
  onSuccess,
  onClose,
}: {
  mode: 'create' | 'edit'
  defaultValues?: SupplierFormDefaults
  onSuccess?: () => void
  onClose?: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(createSupplierSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      contactPerson: defaultValues?.contactPerson ?? '',
      phone: defaultValues?.phone ?? '',
      email: defaultValues?.email ?? '',
      gstin: defaultValues?.gstin ?? '',
      pan: defaultValues?.pan ?? '',
      dlNumber: defaultValues?.dlNumber ?? '',
      address: defaultValues?.address ?? '',
      city: defaultValues?.city ?? '',
      state: defaultValues?.state ?? '',
      pincode: defaultValues?.pincode ?? '',
      bankName: defaultValues?.bankName ?? '',
      bankAccount: defaultValues?.bankAccount ?? '',
      bankIfsc: defaultValues?.bankIfsc ?? '',
      creditDays: defaultValues?.creditDays ?? 30,
      notes: defaultValues?.notes ?? '',
    },
  })

  const onSubmit = async (data: SupplierFormValues) => {
    setIsSubmitting(true)
    try {
      const url =
        mode === 'edit' && defaultValues?.id
          ? `/api/suppliers/${defaultValues.id}`
          : '/api/suppliers'
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
          mode === 'create' ? 'Failed to create supplier' : 'Failed to update supplier',
          json.error?.message
        )
        return
      }

      toast.success(
        mode === 'create'
          ? `Supplier "${json.data?.name}" created`
          : `Supplier "${json.data?.name}" updated`
      )

      reset()
      if (onClose) {
        onClose()
      } else {
        router.push(ROUTES.SUPPLIERS)
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
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">

      {/* ── Basic Info ────────────────────────────── */}
      <SectionHeader icon={User} title="Basic Information" />

      <div className="space-y-1.5">
        <Label htmlFor="dlg-name">
          Supplier Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="dlg-name"
          placeholder="e.g. Apex Pharmaceuticals Pvt. Ltd."
          {...register('name')}
          aria-invalid={!!errors.name}
        />
        <FieldError message={errors.name?.message} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="dlg-contact">Contact Person</Label>
          <Input id="dlg-contact" placeholder="Rahul Sharma" {...register('contactPerson')} />
          <FieldError message={errors.contactPerson?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dlg-phone">Phone</Label>
          <Input id="dlg-phone" type="tel" placeholder="+91 98765 43210" {...register('phone')} />
          <FieldError message={errors.phone?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dlg-email">Email</Label>
          <Input id="dlg-email" type="email" placeholder="orders@apexpharma.com" {...register('email')} />
          <FieldError message={errors.email?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dlg-credit">Credit Days</Label>
          <Input
            id="dlg-credit"
            type="number"
            min={0}
            max={365}
            placeholder="30"
            {...register('creditDays', { valueAsNumber: true })}
          />
          <FieldError message={errors.creditDays?.message} />
        </div>
      </div>

      {/* ── Legal Details ─────────────────────────── */}
      <SectionHeader icon={FileText} title="Legal Details" />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="dlg-gstin">GSTIN</Label>
          <Input
            id="dlg-gstin"
            placeholder="29ABCDE1234F1Z5"
            maxLength={15}
            className="uppercase"
            {...register('gstin')}
          />
          <FieldError message={errors.gstin?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dlg-pan">PAN</Label>
          <Input
            id="dlg-pan"
            placeholder="ABCDE1234F"
            maxLength={10}
            className="uppercase"
            {...register('pan')}
          />
          <FieldError message={errors.pan?.message} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="dlg-dl">Drug License No.</Label>
        <Input id="dlg-dl" placeholder="DL/MH/123456/2024" {...register('dlNumber')} />
        <FieldError message={errors.dlNumber?.message} />
      </div>

      {/* ── Address ───────────────────────────────── */}
      <SectionHeader icon={MapPin} title="Address" />

      <div className="space-y-1.5">
        <Label htmlFor="dlg-address">Street Address</Label>
        <Textarea id="dlg-address" placeholder="Building / Street / Area" rows={2} {...register('address')} />
        <FieldError message={errors.address?.message} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="dlg-city">City</Label>
          <Input id="dlg-city" placeholder="Mumbai" {...register('city')} />
          <FieldError message={errors.city?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dlg-state">State</Label>
          <Input id="dlg-state" placeholder="Maharashtra" {...register('state')} />
          <FieldError message={errors.state?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dlg-pin">Pincode</Label>
          <Input id="dlg-pin" placeholder="400001" maxLength={10} {...register('pincode')} />
          <FieldError message={errors.pincode?.message} />
        </div>
      </div>

      {/* ── Bank Details ──────────────────────────── */}
      <SectionHeader icon={CreditCard} title="Bank Details" />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="dlg-bank">Bank Name</Label>
          <Input id="dlg-bank" placeholder="HDFC Bank" {...register('bankName')} />
          <FieldError message={errors.bankName?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dlg-acc">Account No.</Label>
          <Input id="dlg-acc" placeholder="50100123456789" {...register('bankAccount')} />
          <FieldError message={errors.bankAccount?.message} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="dlg-ifsc">IFSC Code</Label>
        <Input
          id="dlg-ifsc"
          placeholder="HDFC0001234"
          maxLength={11}
          className="uppercase max-w-[14rem]"
          {...register('bankIfsc')}
        />
        <FieldError message={errors.bankIfsc?.message} />
      </div>

      {/* ── Notes ─────────────────────────────────── */}
      <SectionHeader icon={Building2} title="Notes" />

      <div className="space-y-1.5">
        <Label htmlFor="dlg-notes">Internal Notes</Label>
        <Textarea
          id="dlg-notes"
          placeholder="Payment terms, special conditions, etc."
          rows={2}
          {...register('notes')}
        />
        <FieldError message={errors.notes?.message} />
      </div>

      {/* ── Footer actions ────────────────────────── */}
      <div className="flex items-center gap-3 pt-2 border-t">
        <Button type="submit" disabled={isSubmitting || (mode === 'edit' && !isDirty)}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {mode === 'create' ? 'Creating…' : 'Saving…'}
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {mode === 'create' ? 'Create Supplier' : 'Save Changes'}
            </>
          )}
        </Button>
        <Button
          variant="outline"
          type="button"
          onClick={onClose ?? (() => router.push(ROUTES.SUPPLIERS))}
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

// ─── Exported Standalone Form Component ───────────────────────

export interface SupplierFormProps {
  mode: 'create' | 'edit'
  defaultValues?: SupplierFormDefaults
  onSuccess?: () => void
}

export function SupplierForm({ mode, defaultValues, onSuccess }: SupplierFormProps) {
  const router = useRouter()
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <SupplierFormInner
        mode={mode}
        defaultValues={defaultValues}
        onSuccess={onSuccess}
        onClose={() => router.push(ROUTES.SUPPLIERS)}
      />
    </div>
  )
}

// ─── Exported Dialog Component ────────────────────────────────

export function SupplierFormDialog({
  mode,
  defaultValues,
  trigger,
  onSuccess,
}: SupplierFormDialogProps) {
  const [open, setOpen] = useState(false)

  const defaultTrigger =
    mode === 'create' ? (
      <Button id="btn-new-supplier">
        <Plus className="mr-2 h-4 w-4" />
        New Supplier
      </Button>
    ) : (
      <Button variant="ghost" size="sm" id={`btn-edit-supplier-${defaultValues?.id ?? 'unknown'}`}>
        Edit
      </Button>
    )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>

      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        aria-describedby="supplier-dialog-desc"
      >
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'New Supplier' : `Edit — ${defaultValues?.name ?? 'Supplier'}`}
          </DialogTitle>
          <DialogDescription id="supplier-dialog-desc">
            {mode === 'create'
              ? 'Fill in the details to register a new supplier.'
              : 'Update supplier details. Only changed fields are saved.'}
          </DialogDescription>
        </DialogHeader>

        <SupplierFormInner
          mode={mode}
          defaultValues={defaultValues}
          onSuccess={onSuccess}
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
