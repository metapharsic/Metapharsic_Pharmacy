'use client'

import { formatRack } from '@/lib/utils/rack'

// ─────────────────────────────────────────────────────────────
// POS — Professional Pharmacy Billing & Terminal Client
//
// Structured Medicine Grid → Fast Barcode & Text Search →
// Cart & Stock Limits → Payment Processing → Held Bills → Receipt
// ─────────────────────────────────────────────────────────────
import { format, isValid, parseISO } from 'date-fns'
import {
  AlertCircle,
  AlertTriangle,
  Barcode,
  Calculator,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Droplet,
  FlaskConical,
  Loader2,
  MapPin,
  Minus,
  Package,
  Pill,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Scan,
  Search,
  FileCheck,
  ShoppingCart,
  Sparkles,
  Syringe,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/lib/hooks/use-toast'
import { computeItemPricing, computeSaleTotals, round2 } from '@/lib/sales/pricing'
import type { PosSettings } from '@/lib/settings/settings-service'
import {
  playBarcodeScanSound,
  playSuccessCheckoutSound,
  playWarningSound,
} from '@/lib/sound/sound-effects'
import { cn } from '@/lib/utils/cn'
import { formatCurrency } from '@/lib/utils/currency'
import { useI18n } from '@/lib/i18n/i18n-context'

import {
  BatchSelectionModal,
  type PosBatchOption,
  type SelectedBatchLine,
} from './batch-selection-modal'
import { BillFinalizeDialog, type DoctorOption } from './bill-finalize-dialog'
import { CustomerProfilingBar, type CustomerProfileData } from './customer-profiling-bar'
import { SalesPatternModal } from '@/components/inventory/sales-pattern-modal'
import { BillingFormatSwitcher } from './formats/billing-format-switcher'
import type { BillingFormatMode } from './formats/billing-types'
import { Format1InlineGrid } from './formats/format-1-inline-grid'
import { Format2SplitScreen } from './formats/format-2-split-screen'
import { Format3TreeSelect } from './formats/format-3-tree-select'
import { Format4AccordionWarning } from './formats/format-4-accordion-warning'
import { ReceiptInvoice, type ReceiptData } from './receipt-invoice'
import { TouchscreenScanDispenserModal } from './touchscreen-scan-dispenser-modal'
import { BarcodeScannerModal } from '@/components/scanner/barcode-scanner-modal'
import { playBarcodeBeep } from '@/lib/scanner/barcode-sound'
import { useBarcodeScanner } from '@/lib/scanner/use-barcode-scanner'
import {
  addPosCartItem,
  clearPosCart,
  getPosCart,
  setPosCart,
  subscribeToPosCart,
  type PosCartLine,
} from '@/lib/stores/pos-cart-store'

interface PosUser {
  id: string
  branchId: string | null
  permissions: string[]
}

interface PosBranch {
  id: string
  name: string
  code: string | null
}

export interface PosBatchItem {
  id: string
  batchNumber: string
  expiryDate: string
  quantity: number
  availableQuantity: number
  mrp: number
  status: string
  isNearExpiry: boolean
  isFefoFirst: boolean
}

export interface PosProductRow {
  id: string
  name: string
  nameAr?: string | null
  genericName: string | null
  genericNameAr?: string | null
  sku: string
  barcode: string | null
  rack?: string | null
  unitOfMeasure: string
  tabsPerStrip?: number | null
  mrp: number
  gstRate: number
  cgstRate: number
  sgstRate: number
  igstRate: number
  hsnCode: string | null
  drugSchedule: string
  isPrescriptionRequired: boolean
  isGstExempt: boolean
  additionalBarcodes: string[]
  availableQuantity: number
  batches?: PosBatchItem[]
  categoryName?: string | null
  manufacturer?: string | null
  composition?: string | null
  packSize?: string | null
  imageUrl?: string | null
}

function formatBatchExp(isoDate: string | null | undefined): string {
  if (!isoDate) return '-'
  const d = parseISO(isoDate)
  if (!isValid(d)) return '-'
  return format(d, 'MMM yyyy')
}

interface CartLine {
  productId: string
  sku: string
  barcode: string | null
  name: string
  unitOfMeasure: string
  tabsPerStrip?: number | null
  unit?: string
  isTabletSale?: boolean
  tabsCut?: number | null
  originalMrp?: number
  mrp: number
  gstRate: number
  cgstRate: number
  sgstRate: number
  igstRate: number
  hsnCode: string | null
  drugSchedule: string
  isPrescriptionRequired: boolean
  isGstExempt: boolean
  quantity: number
  discountPercent: number
  availableQuantity: number
  categoryName?: string | null
  composition?: string | null
  batchId?: string
  batchNumber?: string
  expiryDate?: string | Date
}

interface PaymentEntry {
  method: string
  amount: number
  reference: string
}

interface HeldBillRow {
  id: string
  label: string | null
  branchId: string
  createdAt: string
  cartData: unknown
}

const PAYMENT_METHODS = ['CASH', 'CARD', 'UPI', 'NETBANKING', 'CHEQUE', 'CREDIT', 'WALLET'] as const

const CREDIT = 'CREDIT'

const RX_SCHEDULES = new Set(['H', 'H1', 'X'])

interface PosClientProps {
  user: PosUser
  branches: PosBranch[]
  initialConfig: PosSettings
}

// Icon selector helper based on dosage form / unit / category
function getMedicineIcon(unitOfMeasure: string, categoryName?: string | null) {
  const u = (unitOfMeasure || '').toLowerCase()
  const c = (categoryName || '').toLowerCase()

  if (u.includes('syrup') || u.includes('bottle') || u.includes('liquid') || c.includes('syrup')) {
    return FlaskConical
  }
  if (u.includes('inj') || u.includes('vial') || c.includes('injection')) {
    return Syringe
  }
  if (u.includes('drop') || c.includes('drop')) {
    return Droplet
  }
  if (
    u.includes('cream') ||
    u.includes('ointment') ||
    u.includes('gel') ||
    c.includes('ointment')
  ) {
    return Sparkles
  }
  if (
    u.includes('strip') ||
    u.includes('tab') ||
    u.includes('cap') ||
    c.includes('tablet') ||
    c.includes('capsule')
  ) {
    return Pill
  }
  return Package
}

export function PosClient({ user, branches, initialConfig }: PosClientProps) {
  const toast = useToast()
  const {
    locale,
    isPureArabic,
    translateDrug,
    translateGeneric,
    translateUnit,
    translateCategory,
    formatPrice,
    t,
  } = useI18n()
  const searchRef = useRef<HTMLInputElement>(null)
  const pathname = usePathname()
  const router = useRouter()
  const isPosRoute = pathname === '/pos' || pathname === '/pos/'

  const [config] = useState<PosSettings>(initialConfig)
  const [branchId, setBranchId] = useState<string | null>(
    () => user.branchId ?? branches[0]?.id ?? null
  )

  useEffect(() => {
    if (!branchId && branches.length > 0) {
      setBranchId(user.branchId ?? branches[0].id)
    }
  }, [branchId, branches, user.branchId])

  // ─── Product search & category filters ─────────────────────
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [products, setProducts] = useState<PosProductRow[]>([])
  const [searching, setSearching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<string>('ALL')

  // ─── Cart ──────────────────────────────────────────────────
  const [cart, setCart] = useState<CartLine[]>(() => {
    if (typeof window !== 'undefined') {
      return getPosCart() as unknown as CartLine[]
    }
    return []
  })
  const [notes, setNotes] = useState('')

  // ─── Barcode Scanner Modal ─────────────────────────────────
  const [scannerModalOpen, setScannerModalOpen] = useState(false)
  const [touchscreenScannerOpen, setTouchscreenScannerOpen] = useState(false)

  // Sync cart to persistent storage on every change
  useEffect(() => {
    setPosCart(cart as unknown as PosCartLine[])
  }, [cart])

  // Subscribe to external cart updates (e.g., product scanned in Inventory)
  useEffect(() => {
    return subscribeToPosCart((newCart) => {
      setCart((current) => {
        if (JSON.stringify(current) !== JSON.stringify(newCart)) {
          return newCart as unknown as CartLine[]
        }
        return current
      })
    })
  }, [])

  // ─── Customer / Patient Profiling ───────────────────────────
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerProfileData | null>(null)

  // ─── Batch Selection Modal ─────────────────────────────────
  const [batchModalOpen, setBatchModalOpen] = useState(false)
  const [selectedProductForBatch, setSelectedProductForBatch] = useState<PosProductRow | null>(null)

  // ─── Doctor Commission & Marg/Tally Finalize Bill ───────────
  const [finalizeOpen, setFinalizeOpen] = useState(false)
  const [doctors, setDoctors] = useState<DoctorOption[]>([])
  const [billDiscountPercent, setBillDiscountPercent] = useState<number>(0)

  // ─── 4 Billing Formats for CX & Demo ───────────────────────
  const [billingFormat, setBillingFormat] = useState<BillingFormatMode>('format1')
  const [salesPatternOpen, setSalesPatternOpen] = useState(false)

  useEffect(() => {
    const handleFormatCycle = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.key.toLowerCase() === 'm') || e.key === 'F9') {
        e.preventDefault()
        const order: BillingFormatMode[] = ['format1', 'format2', 'format3', 'format4', 'classic']
        setBillingFormat((prev) => {
          const next = order[(order.indexOf(prev) + 1) % order.length]
          return next
        })
      }
    }
    window.addEventListener('keydown', handleFormatCycle)
    return () => window.removeEventListener('keydown', handleFormatCycle)
  }, [])

  // Load doctors for bill finalize dialog
  useEffect(() => {
    fetch('/api/doctors?limit=100', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setDoctors(
            json.data.map(
              (d: {
                id: string
                name: string
                regNumber?: string | null
                clinicName?: string | null
                commissionPercent?: number
              }) => ({
                id: d.id,
                name: d.name,
                regNumber: d.regNumber,
                clinicName: d.clinicName,
                commissionPercent: Number(d.commissionPercent || 0),
              })
            )
          )
        }
      })
      .catch(() => {})
  }, [])

  // Sync customer details when customer profile is selected
  useEffect(() => {
    if (selectedCustomer) {
      setCustomerName(selectedCustomer.name)
      setCustomerPhone(selectedCustomer.phone || '')
    }
  }, [selectedCustomer])

  // ─── Payment ───────────────────────────────────────────────
  const [payOpen, setPayOpen] = useState(false)
  const [payments, setPayments] = useState<PaymentEntry[]>([
    { method: 'CASH', amount: 0, reference: '' },
  ])
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [prescriptionId, setPrescriptionId] = useState('')
  const [approvedPrescriptions, setApprovedPrescriptions] = useState<
    { id: string; prescriptionNumber: string | null; patientName: string }[]
  >([])

  // ─── Held bills ────────────────────────────────────────────
  const [heldOpen, setHeldOpen] = useState(false)
  const [heldBills, setHeldBills] = useState<HeldBillRow[]>([])
  const [heldLabel, setHeldLabel] = useState('')

  // ─── Receipt ───────────────────────────────────────────────
  const [completedSale, setCompletedSale] = useState<
    | (Record<string, unknown> & {
        invoiceNumber: string
        items: {
          productName: string
          quantity: number
          unitPrice: string | number
          discountPercent: string | number
          totalAmount: string | number
        }[]
        payments: { method: string; amount: string | number }[]
        subtotal: string | number
        discountAmount: string | number
        taxAmount: string | number
        cgstAmount: string | number
        sgstAmount: string | number
        igstAmount: string | number
        totalAmount: string | number
        amountPaid: string | number
        balanceDue: string | number
        paymentStatus: string
        customer: { name: string } | null
        saleDate: string
      })
    | null
  >(null)
  const [charging, setCharging] = useState(false)
  const [tallySyncStatus, setTallySyncStatus] = useState<{
    status: string
    message?: string
  } | null>(null)
  const [syncingTally, setSyncingTally] = useState(false)

  // Permissions
  const canDiscount = user.permissions.includes('sales:discount')
  const canDiscountOverride = user.permissions.includes('sales:discount_override')
  const canCredit = user.permissions.includes('sales:credit')

  // ─── Auto-focus search input when opening POS ──────────────
  useEffect(() => {
    if (isPosRoute) {
      const timer = setTimeout(() => {
        searchRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isPosRoute])

  // ─── Debounce search query ─────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(t)
  }, [search])

  // ─── Fetch products from server ────────────────────────────
  const fetchProducts = useCallback(async () => {
    if (!branchId) {
      setProducts([])
      return
    }
    setSearching(true)
    setFetchError(null)

    try {
      const params = new URLSearchParams({
        branchId: branchId,
        limit: '50',
      })
      if (debouncedSearch.trim()) {
        params.set('search', debouncedSearch.trim())
      }
      const res = await fetch(`/api/pos/products?${params.toString()}`, {
        cache: 'no-store',
      })
      const json = (await res.json()) as {
        success: boolean
        data?: PosProductRow[]
        error?: { message?: string }
      }

      if (json.success && Array.isArray(json.data)) {
        // Sort deterministically by name ascending (case-insensitive)
        const sorted = [...json.data].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        )
        setProducts(sorted)
      } else {
        setFetchError(json.error?.message || 'Failed to load medicines')
      }
    } catch {
      setFetchError('Network error connecting to medicine database')
    } finally {
      setSearching(false)
    }
  }, [branchId, debouncedSearch])

  useEffect(() => {
    void fetchProducts()
  }, [fetchProducts])

  // ─── Client-side instant filtering & alphabetical sort ──────
  const displayedProducts = useMemo(() => {
    let list = products

    // Filter by active category / stock tab
    if (activeFilter === 'IN_STOCK') {
      list = list.filter((p) => p.availableQuantity > 0)
    } else if (activeFilter === 'RX') {
      list = list.filter((p) => p.isPrescriptionRequired || RX_SCHEDULES.has(p.drugSchedule))
    } else if (activeFilter === 'TABLETS') {
      list = list.filter(
        (p) =>
          p.unitOfMeasure.toLowerCase().includes('tab') ||
          p.unitOfMeasure.toLowerCase().includes('strip') ||
          p.categoryName?.toLowerCase().includes('tablet')
      )
    } else if (activeFilter === 'SYRUPS') {
      list = list.filter(
        (p) =>
          p.unitOfMeasure.toLowerCase().includes('syrup') ||
          p.unitOfMeasure.toLowerCase().includes('bottle') ||
          p.categoryName?.toLowerCase().includes('syrup')
      )
    } else if (activeFilter === 'CAPSULES') {
      list = list.filter(
        (p) =>
          p.unitOfMeasure.toLowerCase().includes('cap') ||
          p.categoryName?.toLowerCase().includes('capsule')
      )
    } else if (activeFilter === 'INJECTIONS') {
      list = list.filter(
        (p) =>
          p.unitOfMeasure.toLowerCase().includes('inj') ||
          p.categoryName?.toLowerCase().includes('injection')
      )
    } else if (activeFilter === 'OINTMENTS') {
      list = list.filter(
        (p) =>
          p.unitOfMeasure.toLowerCase().includes('ointment') ||
          p.unitOfMeasure.toLowerCase().includes('cream') ||
          p.categoryName?.toLowerCase().includes('ointment')
      )
    } else if (activeFilter === 'DROPS') {
      list = list.filter(
        (p) =>
          p.unitOfMeasure.toLowerCase().includes('drop') ||
          p.categoryName?.toLowerCase().includes('drop')
      )
    }

    // Client-side quick filter on current search term
    const cleanSearch = search.trim().toLowerCase()
    if (cleanSearch) {
      list = list.filter((p) => {
        const matchName = p.name.toLowerCase().includes(cleanSearch)
        const matchNameAr = p.nameAr?.toLowerCase().includes(cleanSearch)
        const matchGeneric = p.genericName?.toLowerCase().includes(cleanSearch)
        const matchGenericAr = p.genericNameAr?.toLowerCase().includes(cleanSearch)
        const matchSku = p.sku.toLowerCase().includes(cleanSearch)
        const matchBarcode = p.barcode?.toLowerCase().includes(cleanSearch)
        const matchRack = p.rack?.toLowerCase().includes(cleanSearch)
        const matchBatch = p.batches?.some((b) => b.batchNumber.toLowerCase().includes(cleanSearch))
        const matchCat = p.categoryName?.toLowerCase().includes(cleanSearch)
        const matchComp = p.composition?.toLowerCase().includes(cleanSearch)
        const matchExtraBarcodes = p.additionalBarcodes.some((b) =>
          b.toLowerCase().includes(cleanSearch)
        )
        return (
          matchName ||
          matchNameAr ||
          matchGeneric ||
          matchGenericAr ||
          matchSku ||
          matchBarcode ||
          matchRack ||
          matchBatch ||
          matchCat ||
          matchComp ||
          matchExtraBarcodes
        )
      })
    }

    // Always keep alphabetical order A-Z
    return [...list].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    )
  }, [products, activeFilter, search])

  // Map of product in-cart quantities for quick badge display
  const cartQuantities = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of cart) {
      map.set(item.productId, item.quantity)
    }
    return map
  }, [cart])

  // ─── Pricing preview ───────────────────────────────────────
  const pricing = useMemo(() => {
    const lines = cart.map((line) =>
      computeItemPricing({
        quantity: line.quantity,
        mrp: line.mrp,
        gstRate: line.gstRate,
        cgstRate: line.cgstRate,
        sgstRate: line.sgstRate,
        igstRate: line.igstRate,
        isGstExempt: line.isGstExempt,
        discountPercent: line.discountPercent,
        taxInclusive: config.taxInclusive,
      })
    )
    const totals = computeSaleTotals(lines, {
      taxInclusive: config.taxInclusive,
      roundOffTotal: config.roundOffTotal,
    })
    return { lines, totals }
  }, [cart, config.roundOffTotal, config.taxInclusive])

  const received = useMemo(
    () => payments.reduce((s, p) => (p.method === CREDIT ? s : s + (p.amount || 0)), 0),
    [payments]
  )
  const balanceDue = Math.max(0, pricing.totals.totalAmount - received)

  // ─── Unit Toggle (Full Strip <-> Tablet / Cut Strip) ─────────
  const handleToggleCartUnit = useCallback((productId: string, cutCount?: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item
        const tabs = (item as any).tabsPerStrip || 10
        const isCurrentlyTablet = Boolean(
          (item as any).isTabletSale || (item as any).unit === 'TABLET'
        )
        const baseMrp = (item as any).originalMrp ?? item.mrp

        if (!isCurrentlyTablet) {
          const tabletPrice = round2(baseMrp / tabs)
          const cutQty = cutCount && cutCount > 0 ? cutCount : (item.quantity > 1 ? item.quantity : 1)
          return {
            ...item,
            originalMrp: baseMrp,
            mrp: tabletPrice,
            unit: 'TABLET',
            isTabletSale: true,
            tabsCut: cutQty,
            quantity: cutQty,
            name: `${item.name.replace(/\s*\(\d+\s*Tabs?\)/i, '')} (${cutQty} Tab${cutQty > 1 ? 's' : ''})`,
          }
        } else {
          return {
            ...item,
            mrp: baseMrp,
            unit: 'STRIP',
            isTabletSale: false,
            tabsCut: null,
            quantity: Math.max(1, Math.round(item.quantity / tabs) || 1),
            name: item.name.replace(/\s*\(\d+\s*Tabs?\)/i, ''),
          }
        }
      })
    )
  }, [])

  const handleSetCutTabs = useCallback((productId: string, cutTabs: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item
        const tabs = (item as any).tabsPerStrip || 10
        const baseMrp = (item as any).originalMrp ?? item.mrp
        const tabletPrice = round2(baseMrp / tabs)
        const validCut = Math.max(1, Math.min(cutTabs, tabs * 10))
        return {
          ...item,
          originalMrp: baseMrp,
          mrp: tabletPrice,
          unit: 'TABLET',
          isTabletSale: true,
          tabsCut: validCut,
          quantity: validCut,
          name: `${item.name.replace(/\s*\(\d+\s*Tabs?\)/i, '')} (${validCut} Tab${validCut > 1 ? 's' : ''})`,
        }
      })
    )
  }, [])

  // ─── Cart helpers with stock limits & batch selection ────────
  const addToCart = useCallback(
    (p: PosProductRow) => {
      if (p.availableQuantity <= 0) {
        playWarningSound()
        toast.error(`${p.name} is out of stock`, 'Cannot add to cart')
        return
      }

      playBarcodeScanSound()
      setCart((prev) => {
        const existing = prev.find((c) => c.productId === p.id)
        if (existing) {
          if (existing.quantity >= p.availableQuantity) {
            playWarningSound()
            toast.warning(
              'Stock limit reached',
              `Only ${p.availableQuantity} units of ${p.name} available in stock`
            )
            return prev
          }
          return prev.map((c) =>
            c.productId === p.id
              ? { ...c, quantity: Math.min(c.quantity + 1, p.availableQuantity) }
              : c
          )
        }

        const activeBatches = (p.batches || []).filter((b) => b.availableQuantity > 0)
        const fefoBatch = activeBatches.find((b) => b.isFefoFirst) || activeBatches[0]

        return [
          ...prev,
          {
            productId: p.id,
            sku: p.sku,
            barcode: p.barcode,
            name: p.name,
            unitOfMeasure: p.unitOfMeasure,
            tabsPerStrip: p.tabsPerStrip ?? 10,
            unit: 'STRIP',
            isTabletSale: false,
            originalMrp: p.mrp,
            mrp: p.mrp,
            gstRate: p.gstRate,
            cgstRate: p.cgstRate,
            sgstRate: p.sgstRate,
            igstRate: p.igstRate,
            hsnCode: p.hsnCode,
            drugSchedule: p.drugSchedule,
            isPrescriptionRequired: p.isPrescriptionRequired,
            isGstExempt: p.isGstExempt,
            quantity: 1,
            discountPercent: selectedCustomer?.patientDiscountPercent ?? 0,
            availableQuantity: p.availableQuantity,
            categoryName: p.categoryName,
            composition: p.composition,
            batchId: fefoBatch?.id,
            batchNumber: fefoBatch?.batchNumber,
            expiryDate: fefoBatch?.expiryDate,
          },
        ]
      })
    },
    [selectedCustomer?.patientDiscountPercent, toast]
  )

  const handleFormatAddToCart = useCallback(
    (
      product: PosProductRow,
      batch?: PosBatchItem,
      quantity = 1,
      discountPercent = 0,
      freeQty = 0,
      unitOverride?: 'STRIP' | 'TABLET',
      tabsCut?: number
    ) => {
      setCart((prev) => {
        const activeBatches = (product.batches || []).filter((b) => b.availableQuantity > 0)
        const chosenBatch = batch || activeBatches[0]

        const tabs = product.tabsPerStrip && product.tabsPerStrip > 1 ? product.tabsPerStrip : 10
        const isTablet = unitOverride === 'TABLET'
        const baseMrp = chosenBatch?.mrp || product.mrp
        const unitPrice = isTablet ? round2(baseMrp / tabs) : baseMrp
        const lineQty = isTablet ? (tabsCut || quantity || 1) : (quantity || 1)

        const existingIndex = prev.findIndex(
          (c) =>
            c.productId === product.id &&
            Boolean(c.isTabletSale) === isTablet &&
            (!chosenBatch || c.batchId === chosenBatch.id)
        )

        if (existingIndex >= 0) {
          const updated = [...prev]
          const cur = updated[existingIndex]
          const newQty = cur.quantity + lineQty
          updated[existingIndex] = {
            ...cur,
            quantity: newQty,
            tabsCut: isTablet ? newQty : null,
            name: isTablet ? `${product.name} (${newQty} Tabs)` : product.name,
            discountPercent: discountPercent || cur.discountPercent,
          }
          return updated
        }

        return [
          ...prev,
          {
            productId: product.id,
            sku: product.sku,
            barcode: product.barcode,
            name: isTablet ? `${product.name} (${lineQty} Tabs)` : product.name,
            unitOfMeasure: product.unitOfMeasure,
            tabsPerStrip: product.tabsPerStrip ?? 10,
            unit: isTablet ? 'TABLET' : 'STRIP',
            isTabletSale: isTablet,
            tabsCut: isTablet ? lineQty : null,
            originalMrp: baseMrp,
            mrp: unitPrice,
            gstRate: product.gstRate,
            cgstRate: product.cgstRate,
            sgstRate: product.sgstRate,
            igstRate: product.igstRate,
            hsnCode: product.hsnCode,
            drugSchedule: product.drugSchedule,
            isPrescriptionRequired: product.isPrescriptionRequired,
            isGstExempt: product.isGstExempt,
            quantity: lineQty,
            discountPercent: discountPercent || (selectedCustomer?.patientDiscountPercent ?? 0),
            availableQuantity: chosenBatch?.availableQuantity ?? product.availableQuantity,
            categoryName: product.categoryName,
            composition: product.composition,
            genericName: product.genericName,
            batchId: chosenBatch?.id,
            batchNumber: chosenBatch?.batchNumber,
            expiryDate: chosenBatch?.expiryDate,
          },
        ]
      })
      toast.success(
        `Added ${product.name}`,
        unitOverride === 'TABLET' ? `Cut Tablets: ${tabsCut || quantity}` : `Quantity: ${quantity}`
      )
    },
    [selectedCustomer?.patientDiscountPercent, toast]
  )

  const handleSelectProduct = useCallback(
    (p: PosProductRow) => {
      if (p.availableQuantity <= 0) {
        toast.error(`${p.name} is out of stock`, 'Cannot add to cart')
        return
      }
      const activeBatches = (p.batches || []).filter((b) => b.availableQuantity > 0)
      if (activeBatches.length > 0) {
        setSelectedProductForBatch(p)
        setBatchModalOpen(true)
      } else {
        addToCart(p)
      }
    },
    [addToCart, toast]
  )

  const handleConfirmBatch = useCallback(
    (line: SelectedBatchLine) => {
      if (!selectedProductForBatch) return
      const p = selectedProductForBatch
      const chosenBatch = (p.batches || []).find((b) => b.id === line.batchId)

      setCart((prev) => {
        const existingIndex = prev.findIndex(
          (c) => c.productId === p.id && (!c.batchId || c.batchId === line.batchId)
        )

        if (existingIndex >= 0) {
          const updated = [...prev]
          const cur = updated[existingIndex]
          const newQty = Math.min(
            cur.quantity + line.quantity,
            chosenBatch?.availableQuantity ?? p.availableQuantity
          )
          updated[existingIndex] = {
            ...cur,
            batchId: line.batchId,
            batchNumber: line.batchNumber,
            expiryDate: line.expiryDate,
            quantity: newQty,
            mrp: line.rate || cur.mrp,
            discountPercent: line.discountPercent || cur.discountPercent,
          }
          return updated
        }

        return [
          ...prev,
          {
            productId: p.id,
            sku: p.sku,
            barcode: p.barcode,
            name: p.name,
            unitOfMeasure: p.unitOfMeasure,
            mrp: line.rate || p.mrp,
            gstRate: p.gstRate,
            cgstRate: p.cgstRate,
            sgstRate: p.sgstRate,
            igstRate: p.igstRate,
            hsnCode: p.hsnCode,
            drugSchedule: p.drugSchedule,
            isPrescriptionRequired: p.isPrescriptionRequired,
            isGstExempt: p.isGstExempt,
            quantity: line.quantity,
            discountPercent:
              line.discountPercent || (selectedCustomer?.patientDiscountPercent ?? 0),
            availableQuantity: chosenBatch?.availableQuantity ?? p.availableQuantity,
            categoryName: p.categoryName,
            composition: p.composition,
            batchId: line.batchId,
            batchNumber: line.batchNumber,
            expiryDate: line.expiryDate,
          },
        ]
      })

      setBatchModalOpen(false)
      setSelectedProductForBatch(null)
      toast.success(`Added ${p.name}`, `Batch: ${line.batchNumber} (${line.quantity} qty)`)
    },
    [selectedProductForBatch, selectedCustomer?.patientDiscountPercent, toast]
  )

  const handleApplyPatientDiscount = useCallback(
    (discountPercent: number) => {
      setCart((prev) =>
        prev.map((c) => ({
          ...c,
          discountPercent: Math.max(c.discountPercent, discountPercent),
        }))
      )
      toast.success('Patient discount applied', `${discountPercent}% discount set on items`)
    },
    [toast]
  )

  const setQty = useCallback(
    (productId: string, requestedQuantity: number) => {
      setCart((prev) =>
        prev.map((c) => {
          if (c.productId !== productId) return c

          if (requestedQuantity > c.availableQuantity) {
            toast.warning(
              'Stock limit exceeded',
              `Maximum available stock for ${c.name} is ${c.availableQuantity}`
            )
            return { ...c, quantity: Math.max(1, c.availableQuantity) }
          }

          return {
            ...c,
            quantity: Math.max(1, Math.min(requestedQuantity || 1, c.availableQuantity)),
          }
        })
      )
    },
    [toast]
  )

  const setDiscount = useCallback((productId: string, discountPercent: number) => {
    setCart((prev) =>
      prev.map((c) =>
        c.productId === productId
          ? { ...c, discountPercent: Math.max(0, Math.min(discountPercent || 0, 100)) }
          : c
      )
    )
  }, [])

  const removeLine = useCallback((productId: string) => {
    setCart((prev) => prev.filter((c) => c.productId !== productId))
  }, [])

  const clearCart = useCallback(() => {
    setCart([])
    clearPosCart()
    setNotes('')
    setPayments([{ method: 'CASH', amount: 0, reference: '' }])
    setCustomerName('')
    setCustomerPhone('')
    setPrescriptionId('')
    setSelectedCustomer(null)
    setBillDiscountPercent(0)
  }, [])

  // ─── Barcode & Enter key handling ───────────────────────────
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setSearch('')
      return
    }

    if (e.key === 'Enter') {
      const term = search.trim().toLowerCase()
      if (!term) return

      // 1. Look for exact barcode match
      const exactBarcode = products.find(
        (p) =>
          p.barcode?.toLowerCase() === term ||
          p.additionalBarcodes.some((b) => b.toLowerCase() === term)
      )
      if (exactBarcode) {
        handleSelectProduct(exactBarcode)
        setSearch('')
        return
      }

      // 2. Look for exact SKU match
      const exactSku = products.find((p) => p.sku.toLowerCase() === term)
      if (exactSku) {
        handleSelectProduct(exactSku)
        setSearch('')
        return
      }

      // 3. If there is a filtered list and user presses enter, add the first available match
      if (displayedProducts.length > 0) {
        const topAvailable = displayedProducts.find((p) => p.availableQuantity > 0)
        if (topAvailable) {
          handleSelectProduct(topAvailable)
          setSearch('')
        }
      }
    }
  }

  // ─── Physical USB / Bluetooth Barcode Scanner Listener ──────
  useBarcodeScanner({
    enabled: isPosRoute && !scannerModalOpen,
    allowInInputs: false,
    onScan: async (scannedBarcode) => {
      const term = scannedBarcode.trim().toLowerCase()
      if (!term) return

      // 1. Check loaded products first for instant local match
      const matched = products.find(
        (p) =>
          p.barcode?.toLowerCase() === term ||
          p.additionalBarcodes.some((b) => b.toLowerCase() === term) ||
          p.sku.toLowerCase() === term
      )

      if (matched) {
        playBarcodeBeep()
        handleSelectProduct(matched)
        toast.success(`Scanned: ${matched.name}`, `Barcode: ${scannedBarcode}`)
        return
      }

      // 2. Fetch from barcode lookup API for comprehensive batch & stock match
      try {
        const params = new URLSearchParams({ barcode: scannedBarcode })
        if (branchId) params.set('branchId', branchId)
        const res = await fetch(`/api/barcode/lookup?${params.toString()}`)
        const json = await res.json()

        if (json.success && json.data) {
          playBarcodeBeep()
          const item: PosCartLine = json.data.posCartItem
          handleFormatAddToCart(
            {
              id: item.productId,
              name: item.name,
              genericName: item.genericName ?? null,
              sku: item.sku,
              barcode: item.barcode,
              unitOfMeasure: item.unitOfMeasure,
              mrp: item.mrp,
              gstRate: item.gstRate,
              cgstRate: item.cgstRate,
              sgstRate: item.sgstRate,
              igstRate: item.igstRate,
              hsnCode: item.hsnCode,
              drugSchedule: item.drugSchedule,
              isPrescriptionRequired: item.isPrescriptionRequired,
              isGstExempt: item.isGstExempt,
              additionalBarcodes: [],
              availableQuantity: item.availableQuantity,
              categoryName: item.categoryName,
              composition: item.composition,
            },
            item.batchId
              ? {
                  id: item.batchId,
                  batchNumber: item.batchNumber || '',
                  expiryDate: typeof item.expiryDate === 'string' ? item.expiryDate : '',
                  quantity: item.quantity,
                  availableQuantity: item.availableQuantity,
                  mrp: item.mrp,
                  status: 'ACTIVE',
                  isNearExpiry: false,
                  isFefoFirst: true,
                }
              : undefined,
            1
          )
          toast.success(
            `Scanned & Added: ${json.data.product.name}`,
            `Batch: ${json.data.posCartItem.batchNumber || 'FEFO'} · ₹${json.data.posCartItem.mrp}`
          )
        } else {
          toast.error(`Barcode "${scannedBarcode}" not found`)
        }
      } catch {
        toast.error('Network error during barcode scan lookup')
      }
    },
  })

  // ─── Discount gate ─────────────────────────────────────────
  const discountGate = useMemo(() => {
    const over = cart.find((c) => c.discountPercent > config.maxDiscountPercent)
    if (!over) return { blocked: false, reason: '' }
    if (canDiscountOverride) return { blocked: false, reason: '' }
    return {
      blocked: true,
      reason: `${over.name}: discount ${over.discountPercent}% exceeds the ${config.maxDiscountPercent}% limit`,
    }
  }, [cart, config.maxDiscountPercent, canDiscountOverride])

  const needsPrescription = useMemo(
    () => cart.some((c) => c.isPrescriptionRequired || RX_SCHEDULES.has(c.drugSchedule)),
    [cart]
  )

  useEffect(() => {
    if (payOpen && needsPrescription && branchId) {
      fetch(`/api/prescriptions?status=APPROVED&limit=10&branchId=${branchId}`, {
        cache: 'no-store',
      })
        .then(
          (res) =>
            res.json() as Promise<{
              success: boolean
              data?: {
                id: string
                prescriptionNumber: string | null
                patientName: string
              }[]
            }>
        )
        .then((json) => {
          if (json.success && Array.isArray(json.data)) {
            setApprovedPrescriptions(
              json.data.map((rx) => ({
                id: rx.id,
                prescriptionNumber: rx.prescriptionNumber,
                patientName: rx.patientName,
              }))
            )
          }
        })
        .catch(() => {})
    }
  }, [payOpen, needsPrescription, branchId])

  const needsCreditCustomer = useMemo(
    () =>
      payments.some((p) => p.method === CREDIT) &&
      config.requireCustomerForCredit &&
      !customerName.trim(),
    [payments, config.requireCustomerForCredit, customerName]
  )

  // ─── Charge / payment dialog controls ──────────────────────
  const openPayment = useCallback(() => {
    if (cart.length === 0) {
      toast.error('Cart is empty')
      return
    }
    if (!branchId) {
      toast.error('A branch is required to bill')
      return
    }
    setPayments([{ method: 'CASH', amount: pricing.totals.totalAmount, reference: '' }])
    setCustomerName('')
    setCustomerPhone('')
    setPrescriptionId('')
    setPayOpen(true)
  }, [cart.length, branchId, pricing.totals.totalAmount, toast])

  const updatePayment = useCallback((i: number, patch: Partial<PaymentEntry>) => {
    setPayments((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)))
  }, [])

  const addPaymentLine = useCallback(() => {
    setPayments((prev) => [...prev, { method: 'CASH', amount: 0, reference: '' }])
  }, [])

  const removePaymentLine = useCallback((i: number) => {
    setPayments((prev) => prev.filter((_, idx) => idx !== i))
  }, [])

  const quickCash = useCallback(() => {
    setPayments((prev) => {
      const remaining = balanceDue
      const real = prev.filter((p) => p.method !== CREDIT)
      const credit = prev.filter((p) => p.method === CREDIT)
      return [
        ...real.map((p) => ({ ...p, amount: 0 })),
        { method: 'CASH', amount: Math.ceil(remaining), reference: '' },
        ...credit,
      ]
    })
  }, [balanceDue])

  // ─── Manual Tally Sync Trigger ─────────────────────────────
  const handleManualTallySync = useCallback(
    async (saleId: string) => {
      setSyncingTally(true)
      try {
        const res = await fetch('/api/tally/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'sync_sale', entityId: saleId }),
        })
        const json = (await res.json()) as {
          success: boolean
          data?: { errorMessage?: string }
          error?: string
        }
        if (json.success) {
          setTallySyncStatus({ status: 'SYNCED', message: 'Voucher synchronized to ledger' })
          toast.success('Pushed to Accounts', 'Sales voucher created in ledger accounts')
        } else {
          setTallySyncStatus({ status: 'OFFLINE', message: 'Queued / Port 9000 offline' })
          toast.info('Sync Queued', 'Accounting server is currently offline. Voucher queued.')
        }
      } catch {
        setTallySyncStatus({ status: 'OFFLINE', message: 'Queued / Port 9000 offline' })
        toast.info('Sync Queued', 'Accounting server is currently offline. Voucher queued.')
      } finally {
        setSyncingTally(false)
      }
    },
    [toast]
  )

  // ─── Create sale ───────────────────────────────────────────
  const submitSale = useCallback(async () => {
    if (!branchId) return
    if (cart.length === 0) return

    if (discountGate.blocked) {
      toast.error('Discount limit exceeded', discountGate.reason)
      return
    }
    if (needsPrescription && !prescriptionId.trim()) {
      toast.error(
        'Prescription required',
        'This bill contains schedule-H/X or prescription-only items'
      )
      setPayOpen(true)
      return
    }
    const usingCredit = payments.some((p) => p.method === CREDIT)
    if (usingCredit && needsCreditCustomer) {
      toast.error('Customer required for credit sales')
      return
    }

    const realPayments = payments.filter((p) => p.method !== CREDIT)
    const hasRealMoney = realPayments.some((p) => (p.amount || 0) > 0)
    if (!usingCredit && !hasRealMoney) {
      toast.error('Enter a payment amount')
      return
    }

    setCharging(true)
    try {
      const customerPayload =
        selectedCustomer || customerName.trim()
          ? {
              name: selectedCustomer?.name || customerName.trim(),
              ...(selectedCustomer?.phone || customerPhone.trim()
                ? { phone: selectedCustomer?.phone || customerPhone.trim() }
                : {}),
            }
          : undefined

      const body = {
        branchId,
        items: cart.map((c) => ({
          productId: c.productId,
          batchId: c.batchId,
          quantity: c.quantity,
          discountPercent: c.discountPercent,
          unit: (c as any).unit || ((c as any).isTabletSale ? 'TABLET' : 'STRIP'),
          isTabletSale: Boolean((c as any).isTabletSale),
        })),
        payments: payments
          .filter((p) => (p.amount || 0) > 0)
          .map((p) => ({
            method: p.method,
            amount: p.amount,
            ...(p.reference ? { reference: p.reference } : {}),
          })),
        ...(customerPayload ? { customer: customerPayload } : {}),
        ...(selectedCustomer?.id ? { customerId: selectedCustomer.id } : {}),
        ...(prescriptionId.trim() ? { prescriptionId: prescriptionId.trim() } : {}),
        ...(billDiscountPercent > 0 ? { billDiscountPercent } : {}),
        ...(notes ? { notes } : {}),
      }

      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as {
        success: boolean
        data?: Record<string, unknown>
        tallySync?: { status: string; message?: string }
        error?: { message?: string }
      }

      if (!json.success || !json.data) {
        toast.error('Could not complete the sale', json.error?.message)
        return
      }

      setCompletedSale(json.data as never)
      setTallySyncStatus(json.tallySync ?? null)
      setPayOpen(false)
      clearCart()
      toast.success(`Invoice ${String(json.data.invoiceNumber ?? '')} created`)

      if (json.tallySync?.status === 'SYNCED') {
        toast.success('Pushed to Accounts', 'Sales voucher auto-synced to ledger')
      }

      if (config.autoPrintInvoice) {
        setTimeout(() => window.print(), 400)
      }
      // Refresh products stock in background
      void fetchProducts()
    } catch {
      toast.error('Could not complete the sale')
    } finally {
      setCharging(false)
    }
  }, [
    branchId,
    cart,
    config.autoPrintInvoice,
    discountGate,
    needsCreditCustomer,
    needsPrescription,
    notes,
    payments,
    prescriptionId,
    customerName,
    customerPhone,
    selectedCustomer,
    billDiscountPercent,
    clearCart,
    fetchProducts,
    toast,
  ])

  // ─── Marg / Tally Fast Finalize Bill Handler ───────────────
  const handleFinalizeBill = useCallback(
    async (params: {
      doctorId?: string
      doctorName?: string
      doctorCommissionPercent?: number
      billDiscountPercent: number
      roundOff: number
      paymentMethod: string
      paymentReference?: string
      cashTendered?: number
      changeAmount?: number
    }) => {
      if (!branchId || cart.length === 0) return

      if (discountGate.blocked) {
        toast.error('Discount limit exceeded', discountGate.reason)
        return
      }
      if (needsPrescription && !prescriptionId.trim()) {
        toast.error(
          'Prescription required',
          'This bill contains schedule-H/X or prescription-only items'
        )
        setFinalizeOpen(false)
        setPayOpen(true)
        return
      }

      setCharging(true)
      try {
        const netTotal = Math.round(
          pricing.totals.totalAmount * (1 - (params.billDiscountPercent || 0) / 100)
        )

        const customerPayload =
          selectedCustomer || customerName.trim()
            ? {
                name: selectedCustomer?.name || customerName.trim(),
                ...(selectedCustomer?.phone || customerPhone.trim()
                  ? { phone: selectedCustomer?.phone || customerPhone.trim() }
                  : {}),
              }
            : undefined

        const body = {
          branchId,
          items: cart.map((c) => ({
            productId: c.productId,
            batchId: c.batchId,
            quantity: c.quantity,
            discountPercent: c.discountPercent,
            unit: (c as any).unit || ((c as any).isTabletSale ? 'TABLET' : 'STRIP'),
            isTabletSale: Boolean((c as any).isTabletSale),
          })),
          payments: [
            {
              method: params.paymentMethod,
              amount: netTotal,
              ...(params.paymentReference ? { reference: params.paymentReference } : {}),
            },
          ],
          ...(customerPayload ? { customer: customerPayload } : {}),
          ...(selectedCustomer?.id ? { customerId: selectedCustomer.id } : {}),
          ...(prescriptionId.trim() ? { prescriptionId: prescriptionId.trim() } : {}),
          ...(params.doctorId ? { doctorId: params.doctorId } : {}),
          ...(params.doctorName ? { doctorName: params.doctorName } : {}),
          ...(params.doctorCommissionPercent
            ? { doctorCommissionPercent: params.doctorCommissionPercent }
            : {}),
          ...(params.billDiscountPercent > 0
            ? { billDiscountPercent: params.billDiscountPercent }
            : {}),
          ...(params.roundOff !== 0 ? { roundOff: params.roundOff } : {}),
          ...(notes ? { notes } : {}),
        }

        const res = await fetch('/api/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        const json = (await res.json()) as {
          success: boolean
          data?: Record<string, unknown>
          tallySync?: { status: string; message?: string }
          error?: { message?: string }
        }

        if (!json.success || !json.data) {
          toast.error('Could not complete sale', json.error?.message)
          return
        }

        const completedData = {
          ...json.data,
          cashTendered: params.cashTendered,
          changeAmount: params.changeAmount,
        }
        setCompletedSale(completedData as never)
        setTallySyncStatus(json.tallySync ?? null)
        setFinalizeOpen(false)
        clearCart()
        toast.success(`Invoice ${String(json.data.invoiceNumber ?? '')} created`)

        if (json.tallySync?.status === 'SYNCED') {
          toast.success('Pushed to Accounts', 'Sales voucher auto-synced to ledger')
        }

        if (config.autoPrintInvoice) {
          setTimeout(() => window.print(), 400)
        }
        void fetchProducts()
      } catch {
        toast.error('Failed to complete sale')
      } finally {
        setCharging(false)
      }
    },
    [
      branchId,
      cart,
      clearCart,
      config.autoPrintInvoice,
      customerName,
      customerPhone,
      discountGate.blocked,
      discountGate.reason,
      fetchProducts,
      needsPrescription,
      notes,
      prescriptionId,
      pricing.totals.totalAmount,
      selectedCustomer,
      toast,
    ]
  )

  // ─── Held bills ────────────────────────────────────────────
  const loadHeldBills = useCallback(async () => {
    try {
      const res = await fetch('/api/pos/held-bills', { cache: 'no-store' })
      const json = (await res.json()) as { success: boolean; data?: HeldBillRow[] }
      setHeldBills(json.success ? (json.data ?? []) : [])
    } catch {
      setHeldBills([])
    }
  }, [])

  const saveHeldBill = useCallback(async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty')
      return
    }
    try {
      const res = await fetch('/api/pos/held-bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(heldLabel.trim() ? { label: heldLabel.trim() } : {}),
          cartData: cart,
        }),
      })
      const json = (await res.json()) as { success: boolean; error?: { message?: string } }
      if (!json.success) {
        toast.error('Could not save held bill', json.error?.message)
        return
      }
      toast.success('Bill held for later')
      setHeldLabel('')
      await loadHeldBills()
    } catch {
      toast.error('Could not save held bill')
    }
  }, [cart, heldLabel, loadHeldBills, toast])

  // ─── Marg / Tally Global Keyboard Shortcuts ────────────────
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // F2: Focus Search / Barcode input
      if (e.key === 'F2') {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
        return
      }

      // F4 or Alt+H: Quick Park / Hold Bill
      if (e.key === 'F4' || (e.altKey && e.key.toLowerCase() === 'h')) {
        e.preventDefault()
        if (cart.length > 0) {
          void saveHeldBill()
        } else {
          toast.warning('Cart is empty', 'Add medicines before holding a bill')
        }
        return
      }

      // F6 or Alt+R: Retrieve Held Bills
      if (e.key === 'F6' || (e.altKey && e.key.toLowerCase() === 'r')) {
        e.preventDefault()
        setHeldOpen(true)
        return
      }

      // F8: Toggle Camera / USB Barcode Scanner Modal
      if (e.key === 'F8') {
        e.preventDefault()
        setScannerModalOpen((prev) => !prev)
        return
      }

      // Ctrl + W, Ctrl + A, or F10: Finalize Bill Dialog
      if (
        (e.ctrlKey && e.key.toLowerCase() === 'w') ||
        (e.ctrlKey && e.key.toLowerCase() === 'a') ||
        e.key === 'F10'
      ) {
        e.preventDefault()
        if (cart.length > 0) {
          setFinalizeOpen(true)
        } else {
          toast.warning('Cart is empty', 'Add medicines before finalizing the bill')
        }
        return
      }

      // Alt + P or F: Print completed receipt if receipt dialog is open
      if (
        (e.altKey && e.key.toLowerCase() === 'p') ||
        (completedSale && e.key.toLowerCase() === 'f')
      ) {
        if (completedSale) {
          e.preventDefault()
          window.print()
        }
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [cart.length, completedSale, toast, saveHeldBill])

  const loadHeldBill = useCallback(
    async (id: string) => {
      const bill = heldBills.find((b) => b.id === id)
      if (!bill) return
      const data = bill.cartData as { items?: CartLine[] } | Array<CartLine> | null
      let items: CartLine[] = []
      if (Array.isArray(data)) items = data
      else if (data?.items) items = data.items
      if (items.length === 0) {
        toast.error('Held bill is empty')
        return
      }
      setCart(items)
      setHeldOpen(false)
      toast.success('Held bill loaded')
    },
    [heldBills, toast]
  )

  const deleteHeldBill = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/pos/held-bills/${id}`, { method: 'DELETE' })
        const json = (await res.json()) as { success: boolean }
        if (!json.success) {
          toast.error('Could not delete held bill')
          return
        }
        setHeldBills((prev) => prev.filter((b) => b.id !== id))
        toast.success('Held bill deleted')
      } catch {
        toast.error('Could not delete held bill')
      }
    },
    [toast]
  )

  useEffect(() => {
    if (heldOpen) void loadHeldBills()
  }, [heldOpen, loadHeldBills])

  // ─── Minimized POS Widget (when navigating away) ────────────
  if (!isPosRoute) {
    const hasOngoingTransaction =
      cart.length > 0 || payments.length > 1 || (payments[0] && payments[0].amount > 0)

    if (!hasOngoingTransaction) return null

    return (
      <button
        className="fixed bottom-6 right-6 z-50 flex cursor-pointer items-center gap-4 rounded-full border border-primary/20 bg-card p-2 pr-4 shadow-xl transition-all hover:scale-105 hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        onClick={() => router.push('/pos')}
        aria-label="Expand Point of Sale"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
          <ShoppingCart className="h-6 w-6" />
        </div>
        <div className="flex flex-col items-start">
          <span className="text-sm font-bold leading-tight">
            {cart.length} {cart.length === 1 ? 'item' : 'items'} in bill
          </span>
          <span className="text-xs font-semibold text-primary">
            {formatCurrency(pricing.totals.totalAmount)}
          </span>
        </div>
        <div className="ml-2 flex items-center justify-center rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20">
          Restore POS ↑
        </div>
      </button>
    )
  }

  // ─── Category & Filter Tabs ─────────────────────────────────
  const isAr = locale === 'ar'
  const FILTER_TABS = [
    { id: 'ALL', label: isAr ? 'جميع الأدوية' : 'All Medicines', count: products.length },
    {
      id: 'IN_STOCK',
      label: isAr ? 'المتوفر فقط' : 'In Stock',
      count: products.filter((p) => p.availableQuantity > 0).length,
    },
    { id: 'TABLETS', label: isAr ? 'أقراص وأشرطة' : 'Tablets' },
    { id: 'SYRUPS', label: isAr ? 'أشربة ومحاليل' : 'Syrups' },
    { id: 'CAPSULES', label: isAr ? 'كبسولات' : 'Capsules' },
    { id: 'INJECTIONS', label: isAr ? 'حقن وأمبولات' : 'Injections' },
    { id: 'DROPS', label: isAr ? 'قطرات طبية' : 'Drops' },
    { id: 'OINTMENTS', label: isAr ? 'مراهم وكريمات' : 'Ointments' },
    {
      id: 'RX',
      label: isAr ? 'أدوية بوصفة (Rx)' : 'Rx Only',
      count: products.filter((p) => p.isPrescriptionRequired || RX_SCHEDULES.has(p.drugSchedule))
        .length,
    },
  ]

  // ─── Full POS Interface ─────────────────────────────────────
  return (
    <div className="absolute inset-0 z-40 flex flex-col overflow-hidden bg-background">
      {/* ─── 4 Billing Formats Top Switcher Toolbar ─────────── */}
      <BillingFormatSwitcher
        currentFormat={billingFormat}
        onChangeFormat={setBillingFormat}
        onOpenSalesPatterns={() => setSalesPatternOpen(true)}
      />

      {/* ─── Customer / Patient Profiling Bar ─────────────────── */}
      <div className="shrink-0 border-b bg-card/80 px-3.5 py-1.5">
        <CustomerProfilingBar
          selectedCustomer={selectedCustomer}
          onSelectCustomer={setSelectedCustomer}
          onApplyPatientDiscount={handleApplyPatientDiscount}
        />
      </div>

      {/* ─── Format 1: Marg / Tally Keyboard-First Inline Grid ─── */}
      {billingFormat === 'format1' && (
        <div className="min-h-0 flex-1 overflow-hidden">
          <Format1InlineGrid
            products={products}
            branchId={branchId}
            cart={cart}
            onAddToCart={handleFormatAddToCart}
            onUpdateQuantity={(id, delta) =>
              setQty(id, (cart.find((c) => c.productId === id)?.quantity || 1) + delta)
            }
            onSetQuantity={setQty}
            onUpdateDiscount={setDiscount}
            onToggleUnit={handleToggleCartUnit}
            onSetCutTabs={handleSetCutTabs}
            onRemoveItem={removeLine}
            onFinalizeBill={() => setFinalizeOpen(true)}
            onOpenSalesPatterns={() => setSalesPatternOpen(true)}
          />
        </div>
      )}

      {/* ─── Format 2: Split-Screen Matrix (Upper Table + Salt Dock) ─── */}
      {billingFormat === 'format2' && (
        <div className="min-h-0 flex-1 overflow-hidden">
          <Format2SplitScreen
            products={products}
            branchId={branchId}
            cart={cart}
            onAddToCart={handleFormatAddToCart}
            onUpdateQuantity={(id, delta) =>
              setQty(id, (cart.find((c) => c.productId === id)?.quantity || 1) + delta)
            }
            onSetQuantity={setQty}
            onUpdateDiscount={setDiscount}
            onToggleUnit={handleToggleCartUnit}
            onSetCutTabs={handleSetCutTabs}
            onRemoveItem={removeLine}
            onFinalizeBill={() => setFinalizeOpen(true)}
            onOpenSalesPatterns={() => setSalesPatternOpen(true)}
          />
        </div>
      )}

      {/* ─── Format 3: Nested Tree-Select ComboBox ─────────── */}
      {billingFormat === 'format3' && (
        <div className="min-h-0 flex-1 overflow-hidden">
          <Format3TreeSelect
            products={products}
            branchId={branchId}
            cart={cart}
            onAddToCart={handleFormatAddToCart}
            onUpdateQuantity={(id, delta) =>
              setQty(id, (cart.find((c) => c.productId === id)?.quantity || 1) + delta)
            }
            onSetQuantity={setQty}
            onUpdateDiscount={setDiscount}
            onToggleUnit={handleToggleCartUnit}
            onSetCutTabs={handleSetCutTabs}
            onRemoveItem={removeLine}
            onFinalizeBill={() => setFinalizeOpen(true)}
            onOpenSalesPatterns={() => setSalesPatternOpen(true)}
          />
        </div>
      )}

      {/* ─── Format 4: Inline Accordion Row (Expand-on-Warning) ─ */}
      {billingFormat === 'format4' && (
        <div className="min-h-0 flex-1 overflow-hidden">
          <Format4AccordionWarning
            products={products}
            branchId={branchId}
            cart={cart}
            onAddToCart={handleFormatAddToCart}
            onUpdateQuantity={(id, delta) =>
              setQty(id, (cart.find((c) => c.productId === id)?.quantity || 1) + delta)
            }
            onSetQuantity={setQty}
            onUpdateDiscount={setDiscount}
            onToggleUnit={handleToggleCartUnit}
            onSetCutTabs={handleSetCutTabs}
            onRemoveItem={removeLine}
            onFinalizeBill={() => setFinalizeOpen(true)}
            onOpenSalesPatterns={() => setSalesPatternOpen(true)}
          />
        </div>
      )}

      {/* ─── Classic: Visual Card Grid + Right Cart Sidebar ─── */}
      {billingFormat === 'classic' && (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          {/* Center / Left: Search & Medicine Grid */}
          <div className="flex min-h-0 flex-1 flex-col border-b lg:border-b-0 lg:border-r">
            {/* Top Header & Search Bar */}
            <div className="flex flex-col gap-2.5 border-b bg-card/60 p-3.5 backdrop-blur-sm">
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Search Input */}
                <div className="relative min-w-[240px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder={
                      isAr
                        ? 'ابحث بالاسم التجاري، العلمي، المادة الفعالة أو امسح الباركود (F3)...'
                        : 'Search name, SKU, generic formula or scan barcode…'
                    }
                    className="h-10 border-border/80 bg-background pl-9 pr-9 text-sm font-normal text-foreground shadow-inner placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary"
                    autoFocus
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('')
                        searchRef.current?.focus()
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Barcode Scanner Modal Launch Button */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setScannerModalOpen(true)}
                  className="shadow-xs h-10 gap-1.5 border-primary/40 bg-primary/5 text-xs font-medium text-primary hover:bg-primary hover:text-primary-foreground"
                  title="Open Live Camera / USB Barcode Scanner (F8)"
                >
                  <Barcode className="h-4 w-4" />
                  <Camera className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{isAr ? 'مسح الباركود' : 'Scan Barcode'}</span>
                </Button>

                {/* Touchscreen Cut-Strip AI Scanner Button */}
                <Button
                  type="button"
                  onClick={() => setTouchscreenScannerOpen(true)}
                  className="h-10 gap-1.5 bg-emerald-600 text-xs font-bold text-white shadow-sm hover:bg-emerald-500"
                  title="Touchscreen Cut-Strip AI Scanner & Instant POS Dispenser"
                >
                  <Scan className="h-4 w-4" />
                  <Zap className="h-3.5 w-3.5" />
                  <span>{isAr ? 'الصرف الذكي للأشرطة' : 'Cut-Strip AI Dispenser'}</span>
                </Button>

                {/* Branch Selector */}
                {user.branchId === null && branches.length > 1 && (
                  <Select value={branchId ?? undefined} onValueChange={(v) => setBranchId(v)}>
                    <SelectTrigger className="h-10 w-44 text-xs font-medium">
                      <SelectValue placeholder={isAr ? 'اختر الفرع' : 'Select branch'} />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id} className="text-xs">
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Held Bills Button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 gap-1.5 px-3 text-xs font-medium"
                  onClick={() => setHeldOpen(true)}
                >
                  <Barcode className="h-4 w-4 text-muted-foreground" />
                  {isAr ? 'الفواتير المعلقة' : 'Held Bills'}
                  {heldBills.length > 0 && (
                    <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                      {heldBills.length}
                    </Badge>
                  )}
                </Button>
              </div>

              {/* Quick Category / Status Filter Chips */}
              <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5">
                {FILTER_TABS.map((tab) => {
                  const active = activeFilter === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveFilter(tab.id)}
                      className={cn(
                        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-all',
                        active
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      {tab.label}
                      {tab.count !== undefined && (
                        <span
                          className={cn(
                            'py-0.2 rounded-full px-1.5 text-[10px]',
                            active
                              ? 'bg-primary-foreground/20 font-bold text-primary-foreground'
                              : 'bg-background/80 text-muted-foreground'
                          )}
                        >
                          {tab.count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Results Bar */}
            <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-2 font-medium">
                <span>
                  {isAr ? (
                    <>عرض <strong className="text-foreground">{displayedProducts.length}</strong> صنفاً دوائياً</>
                  ) : (
                    <>Showing <strong className="text-foreground">{displayedProducts.length}</strong> medicines (A-Z)</>
                  )}
                </span>
                {search.trim() && (
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {isAr ? `تصفية حسب "${search.trim()}"` : `filtered by "${search.trim()}"`}
                  </Badge>
                )}
              </div>
              <div className="hidden items-center gap-3 text-[11px] sm:flex">
                <span>
                  {isAr ? (
                    <>💡 اضغط <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">Enter</kbd> لإضافة أول صنف</>
                  ) : (
                    <>💡 Press <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">Enter</kbd> to add top match</>
                  )}
                </span>
                <span>
                  {isAr ? (
                    <><kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">Esc</kbd> للمسح</>
                  ) : (
                    <><kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">Esc</kbd> to clear</>
                  )}
                </span>
              </div>
            </div>

            {/* ─── Structured Medicine Product Grid ──────────────── */}
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {/* Loading Skeleton State */}
              {searching && products.length === 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex min-h-[155px] animate-pulse flex-col justify-between rounded-xl border border-border/60 bg-card p-3 shadow-sm"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="h-5 w-12 rounded bg-muted" />
                          <div className="h-4 w-8 rounded bg-muted" />
                        </div>
                        <div className="mt-2 h-4 w-3/4 rounded bg-muted" />
                        <div className="h-3 w-1/2 rounded bg-muted" />
                      </div>
                      <div className="flex items-center justify-between border-t border-border/40 pt-3">
                        <div className="h-4 w-12 rounded bg-muted" />
                        <div className="h-4 w-14 rounded bg-muted" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Database/Network Error State */}
              {!searching && fetchError && (
                <div className="flex h-72 flex-col items-center justify-center gap-3 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold">{fetchError}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Please verify database connectivity or select another branch.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void fetchProducts()}>
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Retry loading
                  </Button>
                </div>
              )}

              {/* Empty Search / Filter State */}
              {!searching && !fetchError && displayedProducts.length === 0 && (
                <div className="flex h-72 flex-col items-center justify-center gap-3 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Search className="h-7 w-7 opacity-60" />
                  </div>
                  <div className="max-w-sm">
                    <h3 className="text-base font-semibold">No medicines found</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {search
                        ? `No products matching "${search}". Try searching by generic formula, brand name, SKU or barcode.`
                        : 'No products available for this filter.'}
                    </p>
                  </div>
                  {search && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearch('')
                        searchRef.current?.focus()
                      }}
                    >
                      Clear search
                    </Button>
                  )}
                </div>
              )}

              {/* Product Cards Grid */}
              {!fetchError && displayedProducts.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                  {displayedProducts.map((p) => {
                    const outOfStock = p.availableQuantity <= 0
                    const inCartQty = cartQuantities.get(p.id) || 0
                    const isRx = p.isPrescriptionRequired || RX_SCHEDULES.has(p.drugSchedule)
                    const MedIcon = getMedicineIcon(p.unitOfMeasure, p.categoryName)
                    const isLowStock = p.availableQuantity > 0 && p.availableQuantity <= 10

                    // Active FEFO batch recommendation (sell first)
                    const activeBatches = p.batches?.filter((b) => b.availableQuantity > 0) ?? []
                    const fefoBatch = activeBatches.find((b) => b.isFefoFirst) ?? activeBatches[0]

                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={outOfStock}
                        onClick={() => handleSelectProduct(p)}
                        className={cn(
                          'group relative flex min-h-[170px] flex-col justify-between rounded-xl border bg-card p-3.5 text-left transition-all',
                          'hover:border-primary hover:shadow-md active:scale-[0.98]',
                          'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1',
                          inCartQty > 0 &&
                            'border-primary/80 bg-primary/[0.03] shadow-sm ring-1 ring-primary/50',
                          outOfStock &&
                            'cursor-not-allowed bg-muted/40 opacity-60 hover:border-border hover:shadow-none'
                        )}
                      >
                        {/* Top Row: Unit Badge, Rx Badge, Rack Location & Cart Count */}
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex flex-wrap items-center gap-1">
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                              <MedIcon className="h-3.5 w-3.5" />
                            </div>
                            <Badge
                              variant="secondary"
                              className="px-1.5 py-0 text-[10px] font-medium"
                            >
                              {translateUnit(p.unitOfMeasure)}
                            </Badge>
                            {isRx && (
                              <Badge
                                variant="destructive"
                                className="px-1.5 py-0 text-[10px] font-bold"
                              >
                                {isAr ? 'وصفة' : 'Rx'}
                              </Badge>
                            )}
                            {p.rack && (
                              <Badge
                                variant="outline"
                                className="gap-0.5 border-amber-500/40 bg-amber-500/10 px-1.5 py-0 text-[10px] font-medium text-amber-700 dark:text-amber-300"
                              >
                                <MapPin className="h-2.5 w-2.5 text-amber-600 dark:text-amber-400" />
                                {formatRack(p.rack)}
                              </Badge>
                            )}
                          </div>

                          {/* In-cart Indicator Badge */}
                          {inCartQty > 0 && (
                            <span className="flex items-center gap-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground shadow-sm">
                              <Check className="h-3 w-3 stroke-[3]" />
                              {inCartQty}
                            </span>
                          )}
                        </div>

                        {/* Middle: Medicine Name & Composition / Generic */}
                        <div className="my-1.5">
                          <h4 className="line-clamp-2 text-xs font-semibold leading-tight text-foreground transition-colors group-hover:text-primary sm:text-sm">
                            {translateDrug(p.name, p.nameAr)}
                          </h4>
                          {isAr && !isPureArabic && p.nameAr && (
                            <p className="line-clamp-1 text-[10px] text-muted-foreground font-sans">
                              ({p.name})
                            </p>
                          )}
                          <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                            {translateGeneric(p.genericName, p.genericNameAr) || p.composition || (p.categoryName ? translateCategory(p.categoryName) : (isAr ? 'مستحضر دوائي' : 'General Medicine'))}
                          </p>
                          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/70">
                            {p.sku}
                          </p>
                        </div>

                        {/* FEFO Active Batch Alert (Earliest Expiry - Sell First) */}
                        {fefoBatch && (
                          <div
                            className={cn(
                              'mb-1.5 flex items-center justify-between rounded-md border px-2 py-1 text-[10px]',
                              fefoBatch.isNearExpiry
                                ? 'border-amber-400/60 bg-amber-50/80 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
                                : 'border-border/60 bg-muted/40 text-muted-foreground'
                            )}
                          >
                            <div className="flex min-w-0 items-center gap-1 font-mono">
                              <Zap
                                className={cn(
                                  'h-3 w-3 shrink-0',
                                  fefoBatch.isNearExpiry
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-primary'
                                )}
                              />
                              <span className="truncate font-semibold text-foreground">
                                {fefoBatch.batchNumber}
                              </span>
                              <span>·</span>
                              <span className="shrink-0">
                                {formatBatchExp(fefoBatch.expiryDate)}
                              </span>
                            </div>
                            <div className="ml-1 shrink-0">
                              {fefoBatch.isNearExpiry ? (
                                <span className="font-bold text-amber-600 dark:text-amber-400">
                                  {isAr ? '⚠️ صرف أولاً' : '⚠️ Sell first'}
                                </span>
                              ) : (
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                  {isAr ? 'صرف أولاً' : 'Sell first'}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Bottom: Price & Stock Status */}
                        <div className="flex items-center justify-between border-t border-border/50 pt-2">
                          <span className="text-sm font-bold text-foreground">
                            {formatPrice(p.mrp)}
                          </span>

                          {/* Stock availability indicator */}
                          {outOfStock ? (
                            <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {isAr ? 'نفد' : 'Out of stock'}
                            </span>
                          ) : isLowStock ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                              <AlertCircle className="h-3 w-3" />
                              {isAr ? `متبقي ${p.availableQuantity}` : `${p.availableQuantity} left`}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                              <Check className="h-3 w-3" />
                              {isAr ? `${p.availableQuantity} متاح` : `${p.availableQuantity} in stock`}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ─── Right: Bill / Cart Panel ───────────────────────── */}
          <div className="flex w-full flex-col border-t bg-card shadow-sm lg:w-[400px] lg:border-t-0">
            {/* Bill Panel Header */}
            <div className="flex items-center gap-2 border-b bg-muted/20 p-3.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShoppingCart className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold leading-none">{isAr ? 'فاتورة الصرف الحالية' : 'Active Bill'}</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {isAr ? `${cart.length} أصناف بالسلة` : `${cart.length} ${cart.length === 1 ? 'line item' : 'line items'}`}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2.5 text-xs"
                  onClick={() => {
                    setHeldLabel('')
                    void saveHeldBill()
                  }}
                  disabled={cart.length === 0}
                >
                  {isAr ? 'تعليق (F6)' : 'Hold'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
                  onClick={clearCart}
                  disabled={cart.length === 0}
                >
                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                  {isAr ? 'تفريغ' : 'Clear'}
                </Button>
              </div>
            </div>

            {/* Cart Items Scroll Area */}
            <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3.5">
              {cart.length === 0 && (
                <div className="flex h-56 flex-col items-center justify-center gap-2.5 text-center text-muted-foreground">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60">
                    <ShoppingCart className="h-6 w-6 opacity-40" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{isAr ? 'سلة الصرف فارغة' : 'Cart is empty'}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {isAr
                        ? 'انقر على أي دواء من القائمة لإضافته إلى الفاتورة أو امسح الباركود'
                        : 'Click any medicine card from the grid to add it to this bill.'}
                    </p>
                  </div>
                </div>
              )}

              {cart.map((c) => {
                const over = c.discountPercent > config.maxDiscountPercent && !canDiscountOverride
                const atMaxStock = c.quantity >= c.availableQuantity

                return (
                  <div
                    key={c.productId}
                    className="shadow-xs rounded-xl border border-border/70 bg-background p-3 transition-colors hover:border-border"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-1 text-xs font-semibold text-foreground">
                          {translateDrug(c.name, (c as any).nameAr)}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className="font-mono">{c.sku}</span> · {formatPrice(c.mrp)}/
                          {translateUnit(c.unitOfMeasure)}
                          {((c.tabsPerStrip && c.tabsPerStrip > 1) ||
                            c.unitOfMeasure === 'STRIP' ||
                            c.isTabletSale) && (
                            <div className="inline-flex items-center gap-1">
                              {c.isTabletSale ? (
                                <div className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200">
                                  <span>✂️ TABLET</span>
                                  <div className="flex items-center gap-0.5 bg-background rounded px-1 border border-amber-300 dark:border-amber-700">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const cur = c.tabsCut || c.quantity || 1
                                        if (cur > 1) handleSetCutTabs(c.productId, cur - 1)
                                      }}
                                      className="h-3 w-3 flex items-center justify-center font-bold text-muted-foreground hover:bg-muted"
                                      title="Decrease cut tablets"
                                    >
                                      -
                                    </button>
                                    <span className="font-mono font-bold text-xs px-0.5">{c.tabsCut || c.quantity}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const cur = c.tabsCut || c.quantity || 1
                                        handleSetCutTabs(c.productId, cur + 1)
                                      }}
                                      className="h-3 w-3 flex items-center justify-center font-bold text-muted-foreground hover:bg-muted"
                                      title="Increase cut tablets"
                                    >
                                      +
                                    </button>
                                  </div>
                                  <span className="text-[9px] opacity-75">
                                    of {c.tabsPerStrip || 10} tabs
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleCartUnit(c.productId)}
                                    className="text-[9px] hover:underline ml-0.5"
                                    title="Convert back to full strip"
                                  >
                                    (⇄ Strip)
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleToggleCartUnit(c.productId, 1)}
                                  className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 transition-all"
                                  title="Click to bill loose cut tablets from this strip"
                                >
                                  <span>📦 STRIP</span>
                                  <span className="font-mono text-[9px] text-emerald-600 dark:text-emerald-400">
                                    ✂️ Cut Tabs?
                                  </span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        {c.batchNumber && (
                          <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                            <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono font-bold text-primary">
                              B: {c.batchNumber}
                            </span>
                            {c.expiryDate && (
                              <span className="font-mono text-muted-foreground">
                                Exp:{' '}
                                {formatBatchExp(
                                  typeof c.expiryDate === 'string'
                                    ? c.expiryDate
                                    : c.expiryDate.toISOString()
                                )}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => removeLine(c.productId)}
                        aria-label={`Remove ${c.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      {/* Quantity Stepper */}
                      <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-md hover:bg-background"
                          onClick={() => setQty(c.productId, c.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center text-xs font-bold tabular-nums">
                          {c.quantity}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={atMaxStock}
                          className="h-6 w-6 rounded-md hover:bg-background disabled:opacity-40"
                          onClick={() => setQty(c.productId, c.quantity + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Discount Input */}
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={c.discountPercent || ''}
                          onChange={(e) => setDiscount(c.productId, Number(e.target.value))}
                          placeholder="0"
                          className="h-7 w-14 text-right text-xs tabular-nums"
                          disabled={!canDiscount}
                          aria-label={`Discount % for ${c.name}`}
                        />
                        <span className="text-[11px] text-muted-foreground">% off</span>
                      </div>

                      {/* Line Total */}
                      <div className="text-right">
                        <span className="text-xs font-bold tabular-nums text-foreground">
                          {formatPrice(
                            c.quantity * c.mrp * (1 - (c.discountPercent || 0) / 100)
                          )}
                        </span>
                      </div>
                    </div>

                    {atMaxStock && (
                      <p className="mt-1.5 text-[10px] font-medium text-amber-600">
                        {isAr ? `تم الوصول للحد الأقصى للرصيد المتاح (${c.availableQuantity})` : `Maximum available branch stock reached (${c.availableQuantity})`}
                      </p>
                    )}

                    {over && (
                      <p className="mt-1 text-[10px] font-medium text-destructive">
                        {isAr ? `تجاوز حد الخصم المسموح ${config.maxDiscountPercent}%` : `Exceeds ${config.maxDiscountPercent}% limit — requires discount override`}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Bill Summary & Charge Section */}
            <div className="space-y-3 border-t bg-muted/10 p-4">
              <dl className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{isAr ? 'المجموع الفرعي' : 'Subtotal'}</dt>
                  <dd className="font-medium tabular-nums">
                    {formatPrice(pricing.totals.subtotal)}
                  </dd>
                </div>
                {pricing.totals.discountAmount > 0 && (
                  <div className="flex justify-between font-medium text-emerald-600">
                    <dt>{isAr ? 'الخصم الممنوح' : 'Discount'}</dt>
                    <dd className="tabular-nums">
                      −{formatPrice(pricing.totals.discountAmount)}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{isAr ? 'ضريبة القيمة المضافة (0% أدوية بشرية معفاة)' : 'GST (included/added)'}</dt>
                  <dd className="font-medium tabular-nums">
                    {formatPrice(pricing.totals.taxAmount)}
                  </dd>
                </div>
                {config.roundOffTotal && pricing.totals.roundOffDifference !== 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <dt>{isAr ? 'جبر الكسور' : 'Round-off'}</dt>
                    <dd className="tabular-nums">
                      {formatPrice(pricing.totals.roundOffDifference)}
                    </dd>
                  </div>
                )}
                <Separator className="my-2" />
                <div className="flex justify-between text-base font-extrabold text-foreground">
                  <dt>{isAr ? 'المبلغ الإجمالي المستحق' : 'Total Amount'}</dt>
                  <dd className="tabular-nums text-primary font-bold">
                    {formatPrice(pricing.totals.totalAmount)}
                  </dd>
                </div>
              </dl>

              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={isAr ? 'ملاحظات الفاتورة والعميل (اختياري)...' : 'Invoice remarks / customer notes (optional)'}
                className="h-8 text-xs placeholder:text-muted-foreground"
              />

              <Button
                className="h-11 w-full gap-2 bg-emerald-600 text-sm font-bold text-white shadow-md hover:bg-emerald-700"
                size="lg"
                onClick={() => setFinalizeOpen(true)}
                disabled={cart.length === 0}
              >
                <FileCheck className="h-4 w-4" />
                {isAr ? 'اعتماد وصرف الفاتورة (F9 / Ctrl+W)' : 'Finalize Bill (Ctrl+W / Ctrl+A)'}
              </Button>

              <Button
                variant="outline"
                className="h-9 w-full gap-2 text-xs font-medium"
                onClick={openPayment}
                disabled={cart.length === 0}
              >
                <Calculator className="h-3.5 w-3.5" />
                {isAr ? `الدفع الفوري (${formatPrice(pricing.totals.totalAmount)})` : `Split / Direct Payment (${formatPrice(pricing.totals.totalAmount)})`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Payment Dialog ─────────────────────────────────── */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Take Payment</DialogTitle>
            <DialogDescription>
              Total due is{' '}
              <span className="font-bold text-foreground">
                {formatCurrency(pricing.totals.totalAmount)}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {payments.map((p, i) => (
              <div key={i} className="rounded-lg border bg-muted/10 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Select value={p.method} onValueChange={(v) => updatePayment(i, { method: v })}>
                    <SelectTrigger className="h-9 w-36 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.filter((m) => m !== CREDIT || canCredit).map((m) => (
                        <SelectItem key={m} value={m} className="text-xs">
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={p.amount || ''}
                    onChange={(e) => updatePayment(i, { amount: Number(e.target.value) })}
                    placeholder="Amount"
                    className="h-9 flex-1 text-right text-xs tabular-nums"
                  />
                  {payments.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removePaymentLine(i)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <Input
                  value={p.reference}
                  onChange={(e) => updatePayment(i, { reference: e.target.value })}
                  placeholder={
                    p.method === 'CASH'
                      ? 'Change given / memo (optional)'
                      : p.method === 'UPI'
                        ? 'UPI transaction ID (optional)'
                        : 'Reference / cheque number'
                  }
                  className="h-8 text-xs"
                />
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={addPaymentLine} className="text-xs">
                + Split Payment
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() =>
                  setPayments([
                    { method: 'CASH', amount: pricing.totals.totalAmount, reference: '' },
                  ])
                }
              >
                Exact Cash
              </Button>
              <Button variant="outline" size="sm" onClick={quickCash} className="text-xs">
                Quick Round Cash
              </Button>
            </div>

            {payments.some((p) => p.method === CREDIT) && config.requireCustomerForCredit && (
              <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <Badge variant="outline" className="bg-primary/10 text-[10px]">
                    Credit Sale — Customer Details Required
                  </Badge>
                </div>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer Full Name *"
                  className="h-8 bg-background text-xs"
                />
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Phone Number (optional)"
                  className="h-8 bg-background text-xs"
                />
              </div>
            )}

            {needsPrescription && (
              <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50/80 p-3 dark:bg-amber-950/30">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                    This bill contains Schedule H/X or prescription-only items. A verified
                    prescription is required.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0 border-amber-400 bg-amber-100/90 text-[11px] font-semibold text-amber-900 hover:bg-amber-200 dark:bg-amber-900/60 dark:text-amber-200"
                    onClick={() =>
                      setPrescriptionId(`RX-WALKIN-${Date.now().toString().slice(-6)}`)
                    }
                  >
                    ✓ Verify at Counter
                  </Button>
                </div>
                {approvedPrescriptions.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-amber-800 dark:text-amber-300">
                      Select Verified Prescription:
                    </span>
                    <select
                      className="h-8 w-full rounded border border-amber-300 bg-background px-2 text-xs text-foreground"
                      value={prescriptionId}
                      onChange={(e) => setPrescriptionId(e.target.value)}
                    >
                      <option value="">
                        -- Select Prescription or enter ID / reference below --
                      </option>
                      {approvedPrescriptions.map((rx) => (
                        <option key={rx.id} value={rx.id}>
                          {rx.prescriptionNumber ?? rx.id} ({rx.patientName})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <Input
                  value={prescriptionId}
                  onChange={(e) => setPrescriptionId(e.target.value)}
                  placeholder="Prescription No. / Reference / Doctor note (or click Verify at Counter)"
                  className="h-8 bg-background text-xs"
                />
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg bg-muted/60 p-3 text-xs">
              <span className="text-muted-foreground">Received</span>
              <span className="font-bold tabular-nums text-foreground">
                {formatCurrency(received)}
              </span>
              <span className="text-muted-foreground">Balance Due</span>
              <span className="font-bold tabular-nums text-primary">
                {formatCurrency(balanceDue)}
              </span>
            </div>

            {payments.some((p) => p.method === CREDIT) && (
              <p className="text-[11px] text-muted-foreground">
                Credit payment records the outstanding balance as a customer ledger debit.
              </p>
            )}
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" size="sm" onClick={() => setPayOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={submitSale}
              disabled={charging || cart.length === 0}
              className="gap-1.5"
            >
              {charging && <Loader2 className="h-4 w-4 animate-spin" />}
              Complete Sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Held Bills Dialog ──────────────────────────────── */}
      <Dialog open={heldOpen} onOpenChange={setHeldOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Held Bills</DialogTitle>
            <DialogDescription>
              Hold current cart to resume later or load an existing customer bill.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2">
            <Input
              value={heldLabel}
              onChange={(e) => setHeldLabel(e.target.value)}
              placeholder="Label / Customer name (optional)"
              className="h-9 text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={saveHeldBill}
              disabled={cart.length === 0}
              className="shrink-0 text-xs"
            >
              Hold Current
            </Button>
          </div>

          <div className="max-h-64 space-y-2 overflow-y-auto">
            {heldBills.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">No held bills found</p>
            )}
            {heldBills.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-2 rounded-lg border p-2.5 transition-colors hover:bg-muted/40"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => loadHeldBill(b.id)}
                >
                  <div className="truncate text-xs font-semibold text-foreground">
                    {b.label || 'Unlabelled bill'}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(b.createdAt).toLocaleString()}
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteHeldBill(b.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Printable Receipt Dialog ───────────────────────── */}
      <Dialog open={completedSale !== null} onOpenChange={(v) => !v && setCompletedSale(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto p-4 sm:max-w-xl sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Transaction Complete
            </DialogTitle>
            <DialogDescription>
              Invoice {completedSale ? String(completedSale.invoiceNumber ?? '') : ''}
            </DialogDescription>
          </DialogHeader>

          {completedSale && (
            <>
              <ReceiptInvoice
                sale={completedSale as unknown as ReceiptData}
                showPrintButton={true}
              />
              <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 p-2.5 text-xs">
                <div className="flex min-w-0 items-center gap-2">
                  {tallySyncStatus?.status === 'SYNCED' ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                      <div className="truncate">
                        <span className="font-semibold text-green-700 dark:text-green-400">
                          Auto-synced to Accounts
                        </span>
                        <span className="ml-1 text-muted-foreground">(Voucher created)</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <Clock className="h-4 w-4 shrink-0 text-amber-500" />
                      <div className="truncate">
                        <span className="font-medium text-amber-700 dark:text-amber-400">
                          Accounts Sync:
                        </span>
                        <span className="ml-1 text-muted-foreground">
                          {tallySyncStatus?.message || 'Queued / Port 9000 offline'}
                        </span>
                      </div>
                    </>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 gap-1.5 text-xs"
                  disabled={syncingTally}
                  onClick={() => handleManualTallySync(String(completedSale.id))}
                >
                  <RefreshCw className={cn('h-3 w-3', syncingTally && 'animate-spin')} />
                  {tallySyncStatus?.status === 'SYNCED' ? 'Re-sync' : 'Push to Accounts'}
                </Button>
              </div>
            </>
          )}

          <DialogFooter className="no-print gap-2 sm:justify-between">
            <Button variant="outline" size="sm" onClick={() => setCompletedSale(null)}>
              New Transaction
            </Button>
            <Button size="sm" onClick={() => window.print()} className="gap-1.5">
              <Printer className="h-4 w-4" /> Print Bill / Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Batch Selection Modal (FEFO / Batch details) ───── */}
      {selectedProductForBatch && (
        <BatchSelectionModal
          open={batchModalOpen}
          onOpenChange={(isOpen) => {
            setBatchModalOpen(isOpen)
            if (!isOpen) setSelectedProductForBatch(null)
          }}
          productName={selectedProductForBatch.name}
          productNameAr={selectedProductForBatch.nameAr}
          genericName={selectedProductForBatch.genericName}
          genericNameAr={selectedProductForBatch.genericNameAr}
          dpcoCeiling={(selectedProductForBatch as any).dpcoCeiling}
          drugSchedule={selectedProductForBatch.drugSchedule}
          isDiscountable={(selectedProductForBatch as any).isDiscountable}
          batches={(selectedProductForBatch.batches || []).map((b) => ({
            id: b.id,
            batchNumber: b.batchNumber,
            expiryDate: b.expiryDate,
            available: b.availableQuantity,
            mrp: b.mrp,
            isNearExpiry: b.isNearExpiry,
            isFefoFirst: b.isFefoFirst,
          }))}
          onConfirm={handleConfirmBatch}
        />
      )}

      {/* ─── Marg / Tally Finalize Bill Dialog (Ctrl+W / Ctrl+A) ─ */}
      <BillFinalizeDialog
        items={cart}
        open={finalizeOpen}
        onOpenChange={setFinalizeOpen}
        subtotal={pricing.totals.subtotal}
        itemDiscountTotal={pricing.totals.discountAmount}
        taxTotal={pricing.totals.taxAmount}
        grossTotal={pricing.totals.totalAmount}
        customerName={selectedCustomer?.name || customerName}
        selectedCustomer={selectedCustomer}
        doctors={doctors}
        onFinalizeBill={handleFinalizeBill}
        saving={charging}
      />

      {/* ─── Live Camera & USB Barcode Scanner Modal ───────── */}
      <BarcodeScannerModal
        open={scannerModalOpen}
        onOpenChange={setScannerModalOpen}
        branchId={branchId}
        mode="pos"
        onAddToCart={(item) => {
          handleFormatAddToCart(
            {
              id: item.productId,
              name: item.name,
              genericName: item.genericName ?? null,
              sku: item.sku,
              barcode: item.barcode,
              unitOfMeasure: item.unitOfMeasure,
              mrp: item.mrp,
              gstRate: item.gstRate,
              cgstRate: item.cgstRate,
              sgstRate: item.sgstRate,
              igstRate: item.igstRate,
              hsnCode: item.hsnCode,
              drugSchedule: item.drugSchedule,
              isPrescriptionRequired: item.isPrescriptionRequired,
              isGstExempt: item.isGstExempt,
              additionalBarcodes: [],
              availableQuantity: item.availableQuantity,
              categoryName: item.categoryName,
              composition: item.composition,
            },
            item.batchId
              ? {
                  id: item.batchId,
                  batchNumber: item.batchNumber || '',
                  expiryDate: typeof item.expiryDate === 'string' ? item.expiryDate : '',
                  quantity: item.quantity,
                  availableQuantity: item.availableQuantity,
                  mrp: item.mrp,
                  status: 'ACTIVE',
                  isNearExpiry: false,
                  isFefoFirst: true,
                }
              : undefined,
            item.quantity
          )
        }}
      />

      {/* ─── Touchscreen Cut-Strip AI Scanner & POS Dispenser ─ */}
      <TouchscreenScanDispenserModal
        open={touchscreenScannerOpen}
        onOpenChange={setTouchscreenScannerOpen}
        branchId={branchId ?? undefined}
        onSaleCompleted={(saleData) => {
          toast.success(
            `Bill ${saleData.invoiceNumber} prepared for ${saleData.tabsCut} tabs of ${saleData.productName}!`
          )
        }}
      />
    </div>
  )
}
