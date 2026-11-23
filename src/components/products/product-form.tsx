'use client'

// ─────────────────────────────────────────────────────────────
// Component — ProductForm
// Create / edit a product with categories, HSN/GST, pricing,
// stock levels, and additional barcodes.
// ─────────────────────────────────────────────────────────────
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Barcode,
  CheckCircle2,
  Cpu,
  Layers,
  Loader2,
  Package,
  Pill,
  Plus,
  Scan,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import type { z } from 'zod'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AiStripScannerModal } from '@/components/scanner/ai-strip-scanner-modal'
import { playBarcodeBeep } from '@/lib/scanner/barcode-sound'
import { useBarcodeScanner } from '@/lib/scanner/use-barcode-scanner'
import type { WorkerExtractedEntity } from '@/lib/scanner/workers/pharma-scanner.worker'
import { useToast } from '@/lib/hooks/use-toast'
import { cn } from '@/lib/utils/cn'
import { useI18n } from '@/lib/i18n/i18n-context'
import { getTerritoryTaxProfile } from '@/lib/territory/sovereign-tax-service'
import { createProductSchema } from '@/lib/validations/product'

type ProductFormValues = z.infer<typeof createProductSchema>

type CategoryOption = { id: string; name: string; slug?: string; parentId?: string | null; parentName?: string | null }
type HsnCodeOption = {
  code: string
  description: string
  gstRate: string | number
  cgstRate: string | number
  sgstRate: string | number
  igstRate: string | number
}

const DRUG_SCHEDULES = ['NONE', 'H', 'H1', 'X', 'G', 'J'] as const

interface ProductFormInit {
  id?: string
  name: string
  genericName?: string | null
  sku: string
  barcode?: string | null
  description?: string | null
  manufacturer?: string | null
  composition?: string | null
  drugSchedule: string
  isPrescriptionRequired: boolean
  unitOfMeasure: string
  tabsPerStrip?: number | null
  packSize?: string | null
  hsnCode?: string | null
  mrp: string | number
  ptr?: string | number | null
  costPrice?: string | number | null
  gstRate?: string | number
  cgstRate?: string | number
  sgstRate?: string | number
  igstRate?: string | number
  isGstExempt?: boolean
  minStockLevel: number
  maxStockLevel?: number | null
  reorderLevel: number
  imageUrl?: string | null
  isActive: boolean
  isReturnable: boolean
  categories: { category: { id: string; name: string } }[]
  barcodes: { id: string; barcode: string; type?: string | null }[]
}

interface ProductFormProps {
  initialData?: ProductFormInit
  onSuccess?: () => void
  onCancel?: () => void
  successHref?: string
}

function toNumber(v: string | number | null | undefined): number {
  if (v === null || v === undefined || v === '') return 0
  return typeof v === 'number' ? v : Number(v)
}

export function ProductForm({ initialData, onSuccess, onCancel, successHref }: ProductFormProps) {
  const router = useRouter()
  const { territory, territoryDef, isAr, locale } = useI18n()
  const taxProfile = getTerritoryTaxProfile(territory)
  const isIndia = territory === 'IN'
  const currencySymbol = isAr ? territoryDef.currency.symbolAr : territoryDef.currency.symbolEn
  const currencyDecimals = territoryDef.currency.decimals
  const priceStep = currencyDecimals === 3 ? '0.001' : '0.01'

  const defaultTaxRate =
    initialData?.gstRate !== undefined
      ? toNumber(initialData.gstRate)
      : isIndia
        ? 12
        : (taxProfile.zeroRatedMedicines ? 0 : taxProfile.standardRate)

  const defaultIsExempt =
    initialData?.isGstExempt ?? (isIndia ? false : taxProfile.zeroRatedMedicines)
  const toast = useToast()
  const isEditing = Boolean(initialData?.id)

  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [hsnCodes, setHsnCodes] = useState<HsnCodeOption[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)

  // ─── Multi-Thread Strip & Barcode Scanner Integration ───────
  const [scannerOpen, setScannerOpen] = useState(false)
  const [loadIntoInventory, setLoadIntoInventory] = useState(false)
  const [initialBatch, setInitialBatch] = useState<{
    batchNumber: string
    expiryDate: string
    manufacturingDate: string
    quantity: number
    purchasePrice: number
    mrp: number
    rack: string
  }>({
    batchNumber: '',
    expiryDate: '',
    manufacturingDate: '',
    quantity: 10,
    purchasePrice: 0,
    mrp: 0,
    rack: 'A1-SHELF-01',
  })

  // Physical USB / Bluetooth Barcode Scanner listener (identical to billing POS)
  useBarcodeScanner({
    enabled: !isEditing,
    allowInInputs: false,
    onScan: (barcode) => {
      playBarcodeBeep()
      setValue('barcode', barcode, { shouldValidate: true })
      toast.success(`Scanned Barcode: ${barcode}`)
      setScannerOpen(true)
    },
  })

  // Callback when Strip / Barcode is analyzed by the Multi-Thread Web Worker
  const handleScanApplied = (entity: WorkerExtractedEntity) => {
    // Fill each and every component of the SKU
    setValue('name', entity.name, { shouldValidate: true })
    setValue('genericName', entity.genericName || '', { shouldValidate: true })
    setValue('sku', entity.sku, { shouldValidate: true })
    setValue('barcode', entity.barcode || '', { shouldValidate: true })
    setValue(
      'description',
      `${entity.name} contains ${entity.genericName || 'active therapeutic agents'}. Formulated as ${entity.packSize || entity.unitOfMeasure}.`,
      { shouldValidate: true }
    )
    setValue('manufacturer', entity.manufacturer || '', { shouldValidate: true })
    setValue('composition', entity.composition || '', { shouldValidate: true })
    setValue('drugSchedule', entity.drugSchedule, { shouldValidate: true })
    setValue('isPrescriptionRequired', entity.isPrescriptionRequired, { shouldValidate: true })
    setValue('unitOfMeasure', entity.unitOfMeasure, { shouldValidate: true })
    setValue('tabsPerStrip', entity.tabsPerStrip, { shouldValidate: true })
    setValue('packSize', entity.packSize, { shouldValidate: true })
    setValue('hsnCode', entity.hsnCode, { shouldValidate: true })
    setValue('gstRate', entity.gstRate, { shouldValidate: true })
    setValue('cgstRate', entity.cgstRate, { shouldValidate: true })
    setValue('sgstRate', entity.sgstRate, { shouldValidate: true })
    setValue('igstRate', entity.igstRate, { shouldValidate: true })
    setValue('mrp', entity.mrp, { shouldValidate: true })
    setValue('ptr', entity.ptr, { shouldValidate: true })
    setValue('costPrice', entity.costPrice, { shouldValidate: true })
    setValue('minStockLevel', entity.minStockLevel, { shouldValidate: true })
    setValue('reorderLevel', entity.reorderLevel, { shouldValidate: true })

    // Auto-select category if none selected
    if (selectedCategories.length === 0 && categories.length > 0) {
      setValue('categoryIds', [categories[0].id], { shouldValidate: true })
    }

    // Auto-populate & enable initial inventory loading
    setLoadIntoInventory(true)
    setInitialBatch({
      batchNumber: entity.initialBatch.batchNumber,
      expiryDate: entity.initialBatch.expiryDate,
      manufacturingDate: entity.initialBatch.manufacturingDate || '',
      quantity: entity.initialBatch.quantity,
      purchasePrice: entity.initialBatch.purchasePrice,
      mrp: entity.initialBatch.mrp,
      rack: entity.initialBatch.rack,
    })
  }

  // Direct commit to inventory from scanner modal
  const handleDirectCommitToInventory = async (entity: WorkerExtractedEntity) => {
    const payload: ProductFormValues = {
      name: entity.name,
      genericName: entity.genericName || undefined,
      sku: entity.sku,
      barcode: entity.barcode || undefined,
      description: `${entity.name} - auto-cataloged via multi-thread strip scan.`,
      manufacturer: entity.manufacturer || undefined,
      composition: entity.composition || undefined,
      drugSchedule: entity.drugSchedule,
      isPrescriptionRequired: entity.isPrescriptionRequired,
      unitOfMeasure: entity.unitOfMeasure,
      tabsPerStrip: entity.tabsPerStrip,
      packSize: entity.packSize,
      hsnCode: entity.hsnCode,
      gstRate: entity.gstRate,
      cgstRate: entity.cgstRate,
      sgstRate: entity.sgstRate,
      igstRate: entity.igstRate,
      isGstExempt: false,
      mrp: entity.mrp,
      ptr: entity.ptr,
      costPrice: entity.costPrice,
      minStockLevel: entity.minStockLevel,
      reorderLevel: entity.reorderLevel,
      isActive: true,
      isReturnable: true,
      categoryIds: categories.length > 0 ? [categories[0].id] : [],
      initialBatch: {
        batchNumber: entity.initialBatch.batchNumber,
        expiryDate: entity.initialBatch.expiryDate,
        manufacturingDate: entity.initialBatch.manufacturingDate || undefined,
        quantity: entity.initialBatch.quantity,
        purchasePrice: entity.initialBatch.purchasePrice,
        mrp: entity.initialBatch.mrp,
        rack: entity.initialBatch.rack,
      },
    }

    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error?.message || 'Failed to auto-catalog product')
    }

    onSuccess?.()
    if (successHref) {
      router.push(successHref)
      router.refresh()
    }
  }

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      name: initialData?.name ?? '',
      genericName: initialData?.genericName ?? '',
      sku: initialData?.sku ?? '',
      barcode: initialData?.barcode ?? '',
      description: initialData?.description ?? '',
      manufacturer: initialData?.manufacturer ?? '',
      composition: initialData?.composition ?? '',
      drugSchedule: (initialData?.drugSchedule as ProductFormValues['drugSchedule']) ?? 'NONE',
      isPrescriptionRequired: initialData?.isPrescriptionRequired ?? false,
      unitOfMeasure: initialData?.unitOfMeasure ?? 'Strip',
      tabsPerStrip: initialData?.tabsPerStrip ?? undefined,
      packSize: initialData?.packSize ?? '',
      hsnCode: initialData?.hsnCode ?? undefined,
      gstRate: defaultTaxRate,
      cgstRate: isIndia ? (toNumber(initialData?.cgstRate) || 6) : 0,
      sgstRate: isIndia ? (toNumber(initialData?.sgstRate) || 6) : 0,
      igstRate: isIndia ? (toNumber(initialData?.igstRate) || 12) : defaultTaxRate,
      isGstExempt: defaultIsExempt,
      mrp: toNumber(initialData?.mrp),
      ptr: toNumber(initialData?.ptr),
      costPrice: toNumber(initialData?.costPrice),
      minStockLevel: initialData?.minStockLevel ?? 10,
      maxStockLevel: initialData?.maxStockLevel ?? undefined,
      reorderLevel: initialData?.reorderLevel ?? 20,
      imageUrl: initialData?.imageUrl ?? '',
      isActive: initialData?.isActive ?? true,
      isReturnable: initialData?.isReturnable ?? true,
      categoryIds: initialData?.categories.map((c) => c.category.id) ?? [],
      barcodes:
        initialData?.barcodes.map((b) => ({
          barcode: b.barcode,
          type: b.type ?? 'EAN13',
          isPrimary: false,
        })) ?? [],
    },
  })

  const barcodeFields = useFieldArray({ control, name: 'barcodes' })

  const selectedCategories = watch('categoryIds')
  function toggleCategory(id: string) {
    const current = selectedCategories
    const next = current.includes(id) ? current.filter((c) => c !== id) : [...current, id]
    setValue('categoryIds', next, { shouldValidate: true })
  }

  const selectedHsn = watch('hsnCode')
  function applyHsn(code: string) {
    setValue('hsnCode', code, { shouldValidate: true })
    const hsn = hsnCodes.find((h) => h.code === code)
    if (hsn) {
      setValue('gstRate', toNumber(hsn.gstRate))
      setValue('cgstRate', toNumber(hsn.cgstRate))
      setValue('sgstRate', toNumber(hsn.sgstRate))
      setValue('igstRate', toNumber(hsn.igstRate))
    }
  }

  // Load options
  useEffect(() => {
    Promise.all([
      fetch('/api/categories/options').then((r) => r.json()),
      fetch('/api/hsn-codes').then((r) => r.json()),
    ])
      .then(([catJson, hsnJson]) => {
        if (catJson.success) {
          setCategories(catJson.data as CategoryOption[])
          if (initialData && initialData.categories.length === 0) {
            // no-op; store on submit
          }
        }
        if (hsnJson.success) {
          setHsnCodes(hsnJson.data as HsnCodeOption[])
        }
      })
      .catch(() => toast.error('Failed to load categories or HSN codes'))
      .finally(() => setLoadingOptions(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(raw: ProductFormValues) {
    // Normalize empty numeric inputs (NaN from empty fields) to undefined
    const data: ProductFormValues = { ...raw }
    for (const key of ['ptr', 'costPrice'] as const) {
      const v = data[key]
      if (v === 0) (data as Record<string, unknown>)[key] = undefined
    }
    const optNum = (v: number | undefined) => (v === undefined || Number.isNaN(v) ? undefined : v)
    data.tabsPerStrip = optNum(data.tabsPerStrip)
    data.maxStockLevel = optNum(data.maxStockLevel)
    data.ptr = optNum(data.ptr)
    data.costPrice = optNum(data.costPrice)

    // Include initial batch into inventory if enabled (e.g. from strip/barcode scan)
    if (!isEditing && loadIntoInventory && initialBatch.batchNumber.trim()) {
      data.initialBatch = {
        batchNumber: initialBatch.batchNumber.trim().toUpperCase(),
        expiryDate: initialBatch.expiryDate,
        manufacturingDate: initialBatch.manufacturingDate || undefined,
        quantity: Number(initialBatch.quantity) || 1,
        purchasePrice: Number(data.costPrice) || Number(initialBatch.purchasePrice),
        mrp: Number(data.mrp) || Number(initialBatch.mrp),
        rack: initialBatch.rack,
      }
    }

    const url = isEditing ? `/api/products/${initialData!.id}` : '/api/products'
    const method = isEditing ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (res.ok) {
      toast.success(isEditing ? 'Product updated successfully' : 'Product created successfully')
      onSuccess?.()
      if (successHref) {
        router.push(successHref)
        router.refresh()
      }
    } else {
      const json = (await res.json()) as { error?: { message?: string; code?: string } }
      toast.error(json.error?.message ?? 'Something went wrong')
    }
  }

  const numeric = {
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'e' || e.key === 'E') e.preventDefault()
    },
  }

  const getScheduleLabel = (sched: string) => {
    if (territory === 'OM') {
      const labels: Record<string, { en: string; ar: string }> = {
        NONE: { en: 'OTC (General Sale List)', ar: 'بيع عام (بدون وصفة - OTC)' },
        H: { en: 'POM (Prescription Only Medicine)', ar: 'أدوية وصفية معتمدة (POM)' },
        H1: { en: 'MoH Controlled Drugs (POM-R)', ar: 'أدوية مراقبة وزارة الصحة (POM-R)' },
        X: { en: 'MoH Narcotic & Psychotropic Registry', ar: 'سجل الأدوية المخدرة والمؤثرات العقلية' },
        G: { en: 'Hospital & Specialist Formulary', ar: 'استخدام مستشفيات وتخصصي' },
        J: { en: 'Special Treatment Formulation', ar: 'تركيبات علاجية تخصصية' },
      }
      return labels[sched] ? (isAr ? labels[sched].ar : labels[sched].en) : sched
    }
    if (territory === 'SA') {
      const labels: Record<string, { en: string; ar: string }> = {
        NONE: { en: 'OTC (General Sale List)', ar: 'أدوية لا وصفية (OTC)' },
        H: { en: 'Prescription Only (SFDA Rx)', ar: 'أدوية وصفية (SFDA Rx)' },
        H1: { en: 'SFDA Controlled Substances', ar: 'أدوية مقيدة وخاضعة للرقابة' },
        X: { en: 'SFDA Narcotic Register (RSD)', ar: 'أدوية مخدرة مسجلة (رصد RSD)' },
        G: { en: 'Hospital Clinic Dispensing', ar: 'صرف سريري مستشفيات' },
        J: { en: 'Compounding Formulations', ar: 'تركيبات صيدلانية خاصة' },
      }
      return labels[sched] ? (isAr ? labels[sched].ar : labels[sched].en) : sched
    }
    if (territory === 'BH') {
      const labels: Record<string, string> = {
        NONE: 'OTC (General Sale)',
        H: 'NHRA Prescription Only',
        H1: 'NHRA Controlled Drugs',
        X: 'NHRA Narcotics Register',
        G: 'Clinical Hospital Use',
        J: 'Special Formulations',
      }
      return labels[sched] || sched
    }
    return sched === 'NONE' ? 'OTC (General Sale)' : `Schedule ${sched}`
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* ── Multi-Thread AI Strip Scanner & Barcode Launch Banner ── */}
      {!isEditing && (
        <div className="rounded-xl border border-violet-200 dark:border-violet-900/60 bg-gradient-to-r from-violet-50/70 via-indigo-50/40 to-card dark:from-violet-950/30 dark:via-indigo-950/20 dark:to-card p-4 space-y-3 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-md">
                <Scan className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-foreground">
                    AI Strip Scanner & Barcode Auto-Fill
                  </h3>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 text-[10px] gap-1 px-2 py-0.5 font-semibold">
                    <Cpu className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400 animate-pulse" />
                    Multi-Thread Worker
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Scan medicine strip, blister, or read barcode (USB handheld / camera) to auto-fill all SKU components & load into inventory.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button
                type="button"
                size="sm"
                onClick={() => setScannerOpen(true)}
                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold gap-1.5 shadow-sm"
              >
                <Sparkles className="h-3.5 w-3.5" /> Open AI Strip & Barcode Scanner
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-violet-100 dark:border-violet-900/40">
            <span className="flex items-center gap-1.5 font-mono">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping inline-block" />
              <span>Hardware USB / Bluetooth Scanner Gun: <strong className="text-foreground">Listening</strong></span>
            </span>
            <span className="hidden sm:inline text-muted-foreground/80">
              Scans medicine strips across Alu-Alu, Blister, Carton & Box packs
            </span>
          </div>
        </div>
      )}

      {/* ── Basic Info ─────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Basic Information
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="product-name">Product Name *</Label>
            <Input id="product-name" {...register('name')} placeholder="e.g. Paracetamol 500mg" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="product-generic">Generic Name</Label>
            <Input
              id="product-generic"
              {...register('genericName')}
              placeholder="e.g. Paracetamol"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="product-sku">SKU *</Label>
            <Input
              id="product-sku"
              {...register('sku')}
              placeholder="e.g. PCM-500"
              className="font-mono"
            />
            {errors.sku && <p className="text-xs text-destructive">{errors.sku.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="product-barcode">Primary Barcode</Label>
            <Input
              id="product-barcode"
              {...register('barcode')}
              placeholder="EAN/UPC"
              className="font-mono"
            />
            {errors.barcode && <p className="text-xs text-destructive">{errors.barcode.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="product-manufacturer">Manufacturer</Label>
            <Input
              id="product-manufacturer"
              {...register('manufacturer')}
              placeholder="e.g. Generic Pharma"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="product-pack">Pack Size</Label>
            <Input
              id="product-pack"
              {...register('packSize')}
              placeholder="e.g. 10 tablets or 100ml"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="product-desc">Description</Label>
          <Input
            id="product-desc"
            {...register('description')}
            placeholder="Short description (optional)"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="product-composition">Composition</Label>
          <Input
            id="product-composition"
            {...register('composition')}
            placeholder="e.g. Paracetamol 500mg"
          />
        </div>
      </section>

      {/* ── Classification ─────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Classification
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Drug Schedule *</Label>
            <Select
              value={watch('drugSchedule')}
              onValueChange={(v) =>
                setValue('drugSchedule', v as ProductFormValues['drugSchedule'], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DRUG_SCHEDULES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {getScheduleLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="product-uom">Unit of Measure *</Label>
            <Input id="product-uom" {...register('unitOfMeasure')} placeholder="Strip" />
            {errors.unitOfMeasure && (
              <p className="text-xs text-destructive">{errors.unitOfMeasure.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="product-tabs">Tabs per Strip</Label>
            <Input
              id="product-tabs"
              type="number"
              min={0}
              {...register('tabsPerStrip', { valueAsNumber: true })}
              {...numeric}
            />
          </div>
          <div className="flex items-end gap-4 pb-1">
            <Checkbox
              id="product-rx"
              checked={watch('isPrescriptionRequired')}
              onCheckedChange={(checked) => setValue('isPrescriptionRequired', checked === true)}
            />
            <Label htmlFor="product-rx" className="font-normal">
              Prescription required (Rx)
            </Label>
          </div>
        </div>

        {/* Categories */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Dosage Forms &amp; Therapeutic Classifications *</Label>
            <span className="text-[11px] text-muted-foreground">
              Select formulation and therapeutic class
            </span>
          </div>
          {loadingOptions ? (
            <p className="text-sm text-muted-foreground">Loading categories…</p>
          ) : categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No categories found. Add a category first.
            </p>
          ) : (
            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/10 p-3">
              {Object.entries(
                categories.reduce<Record<string, CategoryOption[]>>((acc, cat) => {
                  const group = cat.parentName || 'General Classifications'
                  if (!acc[group]) acc[group] = []
                  acc[group].push(cat)
                  return acc
                }, {})
              ).map(([groupName, groupCats]) => (
                <div key={groupName} className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {groupName}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {groupCats.map((cat) => {
                      const selected = selectedCategories.includes(cat.id)
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => toggleCategory(cat.id)}
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                            selected
                              ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                              : 'border-border bg-background hover:bg-muted text-foreground'
                          }`}
                        >
                          {cat.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          {errors.categoryIds && (
            <p className="text-xs text-destructive">{errors.categoryIds.message}</p>
          )}
        </div>
      </section>

      {/* ── Sovereign Tax / VAT & Pricing Section ──────────────────────── */}
      <section className="space-y-4">
        {isIndia ? (
          <>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              HSN Code &amp; GST
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>HSN Code</Label>
                <Select
                  value={selectedHsn ?? 'none'}
                  onValueChange={(v) => applyHsn(v === 'none' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select HSN code" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {hsnCodes.map((h) => (
                      <SelectItem key={h.code} value={h.code}>
                        {h.code} — {h.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="product-gst">GST Rate (%)</Label>
                <Input
                  id="product-gst"
                  type="number"
                  step="0.01"
                  {...register('gstRate', { valueAsNumber: true })}
                  {...numeric}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="product-cgst">CGST (%)</Label>
                <Input
                  id="product-cgst"
                  type="number"
                  step="0.01"
                  {...register('cgstRate', { valueAsNumber: true })}
                  {...numeric}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="product-sgst">SGST (%)</Label>
                <Input
                  id="product-sgst"
                  type="number"
                  step="0.01"
                  {...register('sgstRate', { valueAsNumber: true })}
                  {...numeric}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="product-igst">IGST (%)</Label>
                <Input
                  id="product-igst"
                  type="number"
                  step="0.01"
                  {...register('igstRate', { valueAsNumber: true })}
                  {...numeric}
                />
              </div>
              <div className="flex items-end gap-4 pb-1">
                <Checkbox
                  id="product-gst-exempt"
                  checked={watch('isGstExempt')}
                  onCheckedChange={(checked) => setValue('isGstExempt', checked === true)}
                />
                <Label htmlFor="product-gst-exempt" className="font-normal">
                  GST exempt
                </Label>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-4 rounded-xl border border-border/80 bg-muted/20 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-foreground">
                    {isAr
                      ? `ضريبة القيمة المضافة والتصنيف (${taxProfile.authorityNameAr})`
                      : `${taxProfile.authorityNameEn} — VAT & Regulatory Classification`}
                  </h3>
                  <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 uppercase bg-primary/10 border-primary/30 text-primary">
                    {taxProfile.regime} {taxProfile.standardRate > 0 ? `${taxProfile.standardRate}%` : ''} ({taxProfile.currency})
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isAr
                    ? `النسبة الأساسية ${taxProfile.standardRate}%، أو نسبة الصفر (0% معتمد للأدوية البشرية).`
                    : `Standard ${taxProfile.standardRate.toFixed(1)}% statutory VAT, or 0.0% Zero-Rated for approved human medicines.`}
                </p>
              </div>

              {/* Quick Zero-Rate / Standard Toggle Pills */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    'text-xs h-7.5 px-2.5 font-medium transition-colors',
                    watch('gstRate') === 0 && watch('isGstExempt')
                      ? 'bg-teal-600 text-white border-teal-600 hover:bg-teal-700'
                      : 'hover:border-teal-500 hover:bg-teal-500/10'
                  )}
                  onClick={() => {
                    setValue('gstRate', 0)
                    setValue('cgstRate', 0)
                    setValue('sgstRate', 0)
                    setValue('igstRate', 0)
                    setValue('isGstExempt', true)
                  }}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {isAr ? '0% نسبة الصفر (أدوية)' : '0% Zero-Rated (Medicines)'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    'text-xs h-7.5 px-2.5 font-medium transition-colors',
                    watch('gstRate') === taxProfile.standardRate && !watch('isGstExempt')
                      ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'
                      : 'hover:border-primary hover:bg-primary/10'
                  )}
                  onClick={() => {
                    setValue('gstRate', taxProfile.standardRate)
                    setValue('cgstRate', 0)
                    setValue('sgstRate', 0)
                    setValue('igstRate', taxProfile.standardRate)
                    setValue('isGstExempt', false)
                  }}
                >
                  {isAr
                    ? `${taxProfile.standardRate}% النسبة الأساسية`
                    : `${taxProfile.standardRate.toFixed(1)}% Standard VAT`}
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="product-tariff">
                  {isAr ? 'كود التعريفة الجمركية / رمز وزارة الصحة' : 'Tariff / HS / Regulatory Code'}
                </Label>
                <Input
                  id="product-tariff"
                  placeholder={isAr ? 'مثال: 3004.90.00' : 'e.g. 3004.90.00 (Medicaments)'}
                  {...register('hsnCode')}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="product-vat-rate">
                  {isAr ? 'نسبة ضريبة القيمة المضافة (%)' : `VAT Rate (%) — [${taxProfile.currency}]`}
                </Label>
                <Input
                  id="product-vat-rate"
                  type="number"
                  step="0.1"
                  min={0}
                  max={100}
                  {...register('gstRate', {
                    valueAsNumber: true,
                    onChange: (e) => {
                      const val = parseFloat(e.target.value) || 0
                      setValue('igstRate', val)
                      if (val === 0) setValue('isGstExempt', true)
                      else setValue('isGstExempt', false)
                    },
                  })}
                  {...numeric}
                />
              </div>

              <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                <Checkbox
                  id="product-vat-exempt"
                  checked={watch('isGstExempt')}
                  onCheckedChange={(checked) => {
                    const isChecked = checked === true
                    setValue('isGstExempt', isChecked)
                    if (isChecked) {
                      setValue('gstRate', 0)
                      setValue('igstRate', 0)
                      setValue('cgstRate', 0)
                      setValue('sgstRate', 0)
                    } else if (watch('gstRate') === 0) {
                      setValue('gstRate', taxProfile.standardRate)
                      setValue('igstRate', taxProfile.standardRate)
                    }
                  }}
                />
                <Label htmlFor="product-vat-exempt" className="font-normal text-xs text-foreground cursor-pointer">
                  {isAr
                    ? `خاضع لنسبة الصفر / معفى من الضريبة (0% للأدوية والمستحضرات الطبية المعتمدة لـ ${taxProfile.authorityNameAr})`
                    : `Statutory Zero-Rated / Exempt (0% VAT for approved human medicines under ${taxProfile.authorityNameEn})`}
                </Label>
              </div>
            </div>

            {/* Hidden synchronization fields for standard database compatibility */}
            <input type="hidden" {...register('cgstRate', { valueAsNumber: true })} value={0} />
            <input type="hidden" {...register('sgstRate', { valueAsNumber: true })} value={0} />
            <input type="hidden" {...register('igstRate', { valueAsNumber: true })} value={watch('gstRate') || 0} />
          </div>
        )}

        {/* Pricing Sub-Section */}
        <div className="grid gap-4 sm:grid-cols-3 pt-2">
          <div className="space-y-1">
            <Label htmlFor="product-mrp">
              {isAr ? `سعر الجمهور (${currencySymbol}) *` : `MRP (${currencySymbol}) *`}
            </Label>
            <Input
              id="product-mrp"
              type="number"
              step={priceStep}
              min={0}
              {...register('mrp', { valueAsNumber: true })}
              {...numeric}
            />
            {errors.mrp && <p className="text-xs text-destructive">{errors.mrp.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="product-ptr">
              {isAr ? `سعر الشراء للصيدلية (${currencySymbol})` : `PTR (${currencySymbol})`}
            </Label>
            <Input
              id="product-ptr"
              type="number"
              step={priceStep}
              min={0}
              {...register('ptr', { valueAsNumber: true })}
              {...numeric}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="product-cost">
              {isAr ? `سعر التكلفة (${currencySymbol})` : `Cost Price (${currencySymbol})`}
            </Label>
            <Input
              id="product-cost"
              type="number"
              step={priceStep}
              min={0}
              {...register('costPrice', { valueAsNumber: true })}
              {...numeric}
            />
          </div>
        </div>
      </section>

      {/* ── Stock Levels ───────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Stock Levels
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="product-min">Min Stock Level</Label>
            <Input
              id="product-min"
              type="number"
              min={0}
              {...register('minStockLevel', { valueAsNumber: true })}
              {...numeric}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="product-max">Max Stock Level</Label>
            <Input
              id="product-max"
              type="number"
              min={0}
              {...register('maxStockLevel', { valueAsNumber: true })}
              {...numeric}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="product-reorder">Reorder Level</Label>
            <Input
              id="product-reorder"
              type="number"
              min={0}
              {...register('reorderLevel', { valueAsNumber: true })}
              {...numeric}
            />
          </div>
        </div>
      </section>

      {/* ── Additional Barcodes ────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Additional Barcodes
        </h3>
        {barcodeFields.fields.map((field, index) => (
          <div key={field.id} className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor={`bc-${index}`}>Barcode</Label>
              <Input
                id={`bc-${index}`}
                className="font-mono"
                {...register(`barcodes.${index}.barcode`)}
                placeholder="EAN/UPC"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mb-0.5 h-10 w-10 text-destructive"
              onClick={() => barcodeFields.remove(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => barcodeFields.append({ barcode: '', type: 'EAN13', isPrimary: false })}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Add Barcode
        </Button>
        {errors.barcodes && <p className="text-xs text-destructive">{errors.barcodes.message}</p>}
      </section>

      {/* ── Initial Batch & Inventory Ingestion (from strip/barcode scan) ── */}
      {!isEditing && (
        <section className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/20 dark:bg-indigo-950/20 p-4 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-indigo-600" />
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Load Initial Stock into Inventory
                </h3>
                <p className="text-xs text-muted-foreground">
                  Instantly ingest scanned batch and stock into inventory upon product creation.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="load-inventory-toggle"
                checked={loadIntoInventory}
                onCheckedChange={(c) => setLoadIntoInventory(c === true)}
              />
              <Label htmlFor="load-inventory-toggle" className="text-xs font-semibold cursor-pointer">
                Load batch into inventory
              </Label>
            </div>
          </div>

          {loadIntoInventory && (
            <div className="grid gap-3 sm:grid-cols-3 pt-1">
              <div className="space-y-1">
                <Label htmlFor="batch-number" className="text-xs font-semibold">
                  Batch Number (B.No) *
                </Label>
                <Input
                  id="batch-number"
                  value={initialBatch.batchNumber}
                  onChange={(e) => setInitialBatch({ ...initialBatch, batchNumber: e.target.value })}
                  placeholder="e.g. 26D044"
                  className="font-mono text-xs uppercase"
                  required={loadIntoInventory}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="batch-expiry" className="text-xs font-semibold">
                  Expiry Date (EXP) *
                </Label>
                <Input
                  id="batch-expiry"
                  type="date"
                  value={initialBatch.expiryDate}
                  onChange={(e) => setInitialBatch({ ...initialBatch, expiryDate: e.target.value })}
                  className="font-mono text-xs"
                  required={loadIntoInventory}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="batch-mfg" className="text-xs font-semibold">
                  Manufacturing Date (MFD)
                </Label>
                <Input
                  id="batch-mfg"
                  type="date"
                  value={initialBatch.manufacturingDate}
                  onChange={(e) => setInitialBatch({ ...initialBatch, manufacturingDate: e.target.value })}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="batch-qty" className="text-xs font-semibold">
                  Initial Quantity to Ingest (Strips/Units) *
                </Label>
                <Input
                  id="batch-qty"
                  type="number"
                  min="1"
                  value={initialBatch.quantity}
                  onChange={(e) =>
                    setInitialBatch({
                      ...initialBatch,
                      quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                    })
                  }
                  className="text-xs font-semibold"
                  required={loadIntoInventory}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="batch-cost" className="text-xs font-semibold">
                  Purchase Price / Cost per Unit
                </Label>
                <Input
                  id="batch-cost"
                  type="number"
                  step="0.01"
                  value={initialBatch.purchasePrice || ''}
                  onChange={(e) =>
                    setInitialBatch({
                      ...initialBatch,
                      purchasePrice: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="Auto-calculated from MRP"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="batch-rack" className="text-xs font-semibold">
                  Storage Rack / Shelf Location
                </Label>
                <Input
                  id="batch-rack"
                  value={initialBatch.rack}
                  onChange={(e) => setInitialBatch({ ...initialBatch, rack: e.target.value })}
                  placeholder="e.g. A1-SHELF-01"
                  className="text-xs uppercase"
                />
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Status ─────────────────────────────────── */}
      <section className="flex flex-wrap gap-6">
        <div className="flex items-center gap-2">
          <Checkbox
            id="product-active"
            checked={watch('isActive')}
            onCheckedChange={(c) => setValue('isActive', c === true)}
          />
          <Label htmlFor="product-active" className="font-normal">
            Active product
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="product-returnable"
            checked={watch('isReturnable')}
            onCheckedChange={(c) => setValue('isReturnable', c === true)}
          />
          <Label htmlFor="product-returnable" className="font-normal">
            Returnable
          </Label>
        </div>
      </section>

      {/* ── Actions ────────────────────────────────── */}
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? 'Save Changes' : 'Create Product'}
        </Button>
      </div>

      {/* ── AI Pharma Strip & Packaging Scanner Modal ── */}
      <AiStripScannerModal
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onApplyToForm={handleScanApplied}
      />
    </form>
  )
}
