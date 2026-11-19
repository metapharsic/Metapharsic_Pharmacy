import type { PosBatchItem, PosProductRow } from '@/components/pos/pos-client'

export type BillingFormatMode = 'format1' | 'format2' | 'format3' | 'format4' | 'classic'

export interface FormatMeta {
  id: BillingFormatMode
  title: string
  shortLabel: string
  badge: string
  benchmark: string
  tagline: string
  billingSpeed: 'Fastest' | 'High' | 'Fast' | 'Standard'
  learningCurve: 'Low' | 'Medium' | 'Very Low'
  substituteVisibility: string
  screenSpaceNeeded: string
  recommendedFor: string
}

export const BILLING_FORMATS: FormatMeta[] = [
  {
    id: 'format1',
    title: 'Format 1: Keyboard-First Inline Grid',
    shortLabel: 'F1: Classic Inline',
    badge: 'Classic Keyboard Grid',
    benchmark: 'Enterprise Rapid Counter Billing',
    tagline: 'Entire billing completed in the table row. Zero mouse clicks, intelligent auto-substitutes on OOS/F2.',
    billingSpeed: 'Fastest',
    learningCurve: 'Low',
    substituteVisibility: 'Grouped inside floating dropdown sub-panel',
    screenSpaceNeeded: 'Compact (Single unified accounting table)',
    recommendedFor: 'High-speed retail counters, experienced pharmacists, wholesale billing desks',
  },
  {
    id: 'format2',
    title: 'Format 2: Split-Screen Matrix',
    shortLabel: 'F2: Split Matrix Dock',
    badge: 'Dual-Pane Inspector',
    benchmark: 'Modern Enterprise Hospital & Chain Pharmacy POS',
    tagline: 'Upper 60% data table + Lower 40% persistent salt inspector dock with side-by-side brand & generic equivalents.',
    billingSpeed: 'High',
    learningCurve: 'Medium',
    substituteVisibility: 'Persistent in bottom inspection dock (Tab to jump)',
    screenSpaceNeeded: 'High (Dedicated split viewport height)',
    recommendedFor: 'Large desktop screens, clinical counters, multi-brand substitution counseling',
  },
  {
    id: 'format3',
    title: 'Format 3: Nested Tree-Select ComboBox',
    shortLabel: 'F3: Nested Tree-Select',
    badge: 'Hierarchical Tree',
    benchmark: 'Compact Dense POS / Multi-Variant Catalogs',
    tagline: 'Hierarchical tree (Brand → Dosage/Strength → Generic Substitutes) inside a compact cell dropdown.',
    billingSpeed: 'High',
    learningCurve: 'Low',
    substituteVisibility: 'Nested directly under variant node with generic indentation',
    screenSpaceNeeded: 'Compact (Floating overlay tree)',
    recommendedFor: 'Laptops, compact screens, structured product variant exploration',
  },
  {
    id: 'format4',
    title: 'Format 4: Inline Accordion Row',
    shortLabel: 'F4: Expand-on-Warning',
    badge: 'Contextual Drawer',
    benchmark: 'Adaptive Guidance / Zero-Stock Prevention',
    tagline: 'Standard tabular row expands a contextual alert drawer when zero stock occurs with Alt+1/2/3 instant swap hotkeys.',
    billingSpeed: 'Fast',
    learningCurve: 'Very Low',
    substituteVisibility: 'Appears only when needed (Zero-stock or near expiry)',
    screenSpaceNeeded: 'Expands dynamically on warning condition',
    recommendedFor: 'Trainees, busy retail desks preventing lost sales, fast swap workflows',
  },
  {
    id: 'classic',
    title: 'Classic: Visual Medicine Card Grid',
    shortLabel: 'Classic: Tile Grid',
    badge: 'Visual Touch Tiles',
    benchmark: 'Modern Tablet & Touchscreen POS',
    tagline: 'Visual category chips and responsive medicine cards with real-time stock pills and FEFO indicators.',
    billingSpeed: 'Standard',
    learningCurve: 'Very Low',
    substituteVisibility: 'Separate card inspection',
    screenSpaceNeeded: 'Responsive grid + side cart panel',
    recommendedFor: 'Touchscreens, tablets, OTC retail shelves',
  },
]

export interface BillingFormatComponentProps {
  products: PosProductRow[]
  branchId: string | null
  cart: Array<{
    productId: string
    sku: string
    barcode: string | null
    name: string
    unitOfMeasure: string
    tabsPerStrip?: number | null
    unit?: string
    isTabletSale?: boolean
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
    genericName?: string | null
    batchId?: string
    batchNumber?: string
    expiryDate?: string | Date
    freeQty?: number
    tabsCut?: number | null
  }>
  onAddToCart: (
    product: PosProductRow,
    batch?: PosBatchItem,
    quantity?: number,
    discountPercent?: number,
    freeQty?: number,
    unitOverride?: 'STRIP' | 'TABLET',
    tabsCut?: number
  ) => void
  onUpdateQuantity: (productId: string, delta: number) => void
  onSetQuantity: (productId: string, quantity: number) => void
  onUpdateDiscount: (productId: string, discountPercent: number) => void
  onToggleUnit?: (productId: string, cutCount?: number) => void
  onSetCutTabs?: (productId: string, cutTabs: number) => void
  onRemoveItem: (productId: string) => void
  onOpenBatchModal?: (product: PosProductRow) => void
  onFinalizeBill: () => void
  onOpenSalesPatterns?: () => void
}

import { computeItemPricing, computeSaleTotals, type SaleTotals } from '@/lib/sales/pricing'

export function computeCartTotals(cart: BillingFormatComponentProps['cart']): SaleTotals {
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
      taxInclusive: true,
    })
  )
  return computeSaleTotals(lines, { taxInclusive: true, roundOffTotal: true })
}
