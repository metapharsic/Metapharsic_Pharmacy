// ─────────────────────────────────────────────────────────────
// Sales Pattern Service — 1-Tablet Dispensing & Pattern Auto-Billing
//
// Enables pharmacists and chemists to configure, load, and auto-bill
// single-tablet sales patterns (loose unit / fractional strip dispensing)
// both manually from POS and automatically from Inventory loading.
// ─────────────────────────────────────────────────────────────
import prisma from '@/lib/db/prisma'
import { round2 } from '@/lib/sales/pricing'
import { createSale, type SaleActor, type SaleDetail } from '@/lib/sales/sales-service'

export interface PatternItemRequirement {
  searchTerm: string
  quantity: number
  unit: 'TABLET'
  isTabletSale: true
  roleDescription: string
}

export interface PatternPresetDefinition {
  id: string
  title: string
  category: 'OTC_ACUTE' | 'SYMPTOM_COMBO' | 'CHRONIC_EMERGENCY' | 'CUSTOM'
  badge: string
  description: string
  defaultNotes: string
  items: PatternItemRequirement[]
}

export const PRESET_SALES_PATTERNS: PatternPresetDefinition[] = [
  {
    id: 'single-tab-dolo',
    title: '1-Tablet OTC Dolo 650 (Fast Dispense)',
    category: 'OTC_ACUTE',
    badge: 'Single Tablet OTC',
    description: 'Instant single-tablet fever / headache relief for walk-in retail patients.',
    defaultNotes: '1-Tablet OTC Quick Sale: Dolo 650mg',
    items: [
      {
        searchTerm: 'Dolo 650',
        quantity: 1,
        unit: 'TABLET',
        isTabletSale: true,
        roleDescription: 'Antipyretic / Analgesic (1 Tab)',
      },
    ],
  },
  {
    id: 'single-tab-antacid',
    title: '1-Tablet OTC Acidity Relief',
    category: 'OTC_ACUTE',
    badge: 'Single Tablet OTC',
    description: 'Immediate single-tablet gastric relief (Pantoprazole / Omeprazole / Antacid).',
    defaultNotes: '1-Tablet OTC Quick Sale: Gastric Acidity Relief',
    items: [
      {
        searchTerm: 'Pantocid',
        quantity: 1,
        unit: 'TABLET',
        isTabletSale: true,
        roleDescription: 'Proton Pump Inhibitor (1 Tab)',
      },
    ],
  },
  {
    id: 'fever-acidity-duo',
    title: 'Fever & Gastric Dual Combo (1+1 Duo)',
    category: 'SYMPTOM_COMBO',
    badge: 'Dual-Tablet Combo',
    description: '1 Tab Paracetamol 650mg + 1 Tab Antacid for fever with stomach protection.',
    defaultNotes: 'Sales Pattern: Fever + Acidity Dual Combo (1+1)',
    items: [
      {
        searchTerm: 'Dolo 650',
        quantity: 1,
        unit: 'TABLET',
        isTabletSale: true,
        roleDescription: 'Antipyretic (1 Tab)',
      },
      {
        searchTerm: 'Pantocid',
        quantity: 1,
        unit: 'TABLET',
        isTabletSale: true,
        roleDescription: 'Gastric Protector (1 Tab)',
      },
    ],
  },
  {
    id: 'cold-allergy-duo',
    title: 'Cold & Allergy Rapid Relief',
    category: 'SYMPTOM_COMBO',
    badge: 'Allergy Duo',
    description: '1 Tab Antihistamine + 1 Tab Vitamin C for immediate seasonal cold & rhinitis.',
    defaultNotes: 'Sales Pattern: Cold & Allergy Relief Duo',
    items: [
      {
        searchTerm: 'Cetirizine',
        quantity: 1,
        unit: 'TABLET',
        isTabletSale: true,
        roleDescription: 'Antihistamine (1 Tab)',
      },
      {
        searchTerm: 'Vitamin C',
        quantity: 1,
        unit: 'TABLET',
        isTabletSale: true,
        roleDescription: 'Immunity Booster (1 Tab)',
      },
    ],
  },
  {
    id: 'acute-pain-relief',
    title: 'Acute Body Pain & Headache Pattern',
    category: 'SYMPTOM_COMBO',
    badge: 'Pain Relief',
    description: 'Immediate analgesic dispensing for acute muscular, dental, or headache pain.',
    defaultNotes: 'Sales Pattern: Acute Pain & Headache Relief',
    items: [
      {
        searchTerm: 'Combiflam',
        quantity: 1,
        unit: 'TABLET',
        isTabletSale: true,
        roleDescription: 'Analgesic Combo (1 Tab)',
      },
    ],
  },
]

export interface ResolvedPatternItem {
  productId: string
  productName: string
  sku: string
  unitOfMeasure: string
  tabsPerStrip: number
  quantity: number
  unit: 'TABLET'
  isTabletSale: boolean
  stripMrp: number
  tabletUnitPrice: number
  lineTotal: number
  stripCostPrice: number
  tabletCostBasis: number
  lineCost: number
  profitEarned: number
  profitPct: number
  availableStock: number
  batchNumber?: string | null
  expiryDate?: string | null
  isAvailable: boolean
}

export interface ResolvedSalesPattern {
  id: string
  title: string
  category: string
  badge: string
  description: string
  defaultNotes: string
  items: ResolvedPatternItem[]
  totalBillAmount: number
  totalPurchaseCost: number
  totalProfit: number
  profitPct: number
  canAutoBill: boolean
  stockWarning?: string | null
}

/**
 * Resolve pre-configured and custom sales patterns against the active branch inventory.
 */
export async function getAvailableSalesPatterns(branchId: string): Promise<ResolvedSalesPattern[]> {
  const resolvedPatterns: ResolvedSalesPattern[] = []

  for (const preset of PRESET_SALES_PATTERNS) {
    const resolvedItems: ResolvedPatternItem[] = []
    let patternCanBill = true
    let warning: string | null = null

    for (const req of preset.items) {
      // Find candidate product in branch
      const candidates = await prisma.product.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: req.searchTerm, mode: 'insensitive' } },
            { genericName: { contains: req.searchTerm, mode: 'insensitive' } },
            { composition: { contains: req.searchTerm, mode: 'insensitive' } },
            { sku: { contains: req.searchTerm, mode: 'insensitive' } },
          ],
        },
        include: {
          inventory: {
            where: { branchId },
            select: { availableQuantity: true, totalQuantity: true },
          },
          batches: {
            where: {
              branchId,
              status: 'ACTIVE',
              quantity: { gt: 0 },
              expiryDate: { gt: new Date() },
            },
            orderBy: { expiryDate: 'asc' },
            take: 1,
            select: {
              id: true,
              batchNumber: true,
              expiryDate: true,
              purchasePrice: true,
              mrp: true,
              quantity: true,
              soldQuantity: true,
              reservedQuantity: true,
            },
          },
        },
        take: 3,
      })

      // Prefer a candidate that has available stock
      const matched = candidates.find((c) => (c.inventory[0]?.availableQuantity ?? 0) > 0) || candidates[0]

      if (!matched) {
        patternCanBill = false
        warning = `Product '${req.searchTerm}' not found in store catalog.`
        continue
      }

      const availableStock = matched.inventory[0]?.availableQuantity ?? 0
      const activeBatch = matched.batches[0]

      const tabs = matched.tabsPerStrip && matched.tabsPerStrip > 1 ? matched.tabsPerStrip : 10
      const stripMrp = activeBatch ? Number(activeBatch.mrp) : Number(matched.mrp)
      const tabletUnitPrice = round2(stripMrp / tabs)
      const lineTotal = round2(tabletUnitPrice * req.quantity)

      const stripCost = activeBatch?.purchasePrice
        ? Number(activeBatch.purchasePrice)
        : matched.costPrice
          ? Number(matched.costPrice)
          : round2(stripMrp * 0.7) // 30% margin fallback if unpriced

      const tabletCostBasis = round2(stripCost / tabs)
      const lineCost = round2(tabletCostBasis * req.quantity)
      const profitEarned = round2(lineTotal - lineCost)
      const profitPct = lineTotal > 0 ? round2((profitEarned / lineTotal) * 100) : 0

      const isAvailable = availableStock >= 1
      if (!isAvailable) {
        patternCanBill = false
        warning = `${matched.name} is currently out of stock.`
      }

      resolvedItems.push({
        productId: matched.id,
        productName: matched.name,
        sku: matched.sku,
        unitOfMeasure: matched.unitOfMeasure,
        tabsPerStrip: tabs,
        quantity: req.quantity,
        unit: req.unit,
        isTabletSale: true,
        stripMrp,
        tabletUnitPrice,
        lineTotal,
        stripCostPrice: stripCost,
        tabletCostBasis,
        lineCost,
        profitEarned,
        profitPct,
        availableStock,
        batchNumber: activeBatch?.batchNumber ?? null,
        expiryDate: activeBatch?.expiryDate ? activeBatch.expiryDate.toISOString() : null,
        isAvailable,
      })
    }

    if (resolvedItems.length === 0) continue

    const totalBillAmount = round2(resolvedItems.reduce((acc, it) => acc + it.lineTotal, 0))
    const totalPurchaseCost = round2(resolvedItems.reduce((acc, it) => acc + it.lineCost, 0))
    const totalProfit = round2(totalBillAmount - totalPurchaseCost)
    const profitPct = totalBillAmount > 0 ? round2((totalProfit / totalBillAmount) * 100) : 0

    resolvedPatterns.push({
      id: preset.id,
      title: preset.title,
      category: preset.category,
      badge: preset.badge,
      description: preset.description,
      defaultNotes: preset.defaultNotes,
      items: resolvedItems,
      totalBillAmount,
      totalPurchaseCost,
      totalProfit,
      profitPct,
      canAutoBill: patternCanBill && resolvedItems.length === preset.items.length,
      stockWarning: warning,
    })
  }

  return resolvedPatterns
}

export interface AutoBillSalesPatternInput {
  branchId: string
  patternId: string
  paymentMethod?: 'CASH' | 'UPI' | 'CARD'
  customerName?: string
  customerPhone?: string
  notes?: string
  items?: {
    productId: string
    quantity: number
    unit?: 'STRIP' | 'TABLET'
    isTabletSale?: boolean
  }[]
}

/**
 * Execute automatic billing of a sales pattern:
 * Deducts FEFO inventory, computes exact 1-tablet prices, logs transaction,
 * and generates a complete retail invoice in a single transactional step.
 */
export async function executeAutoBillFromPattern(
  input: AutoBillSalesPatternInput,
  actor: SaleActor
): Promise<{ success: boolean; sale: SaleDetail }> {
  const { branchId, patternId, paymentMethod = 'CASH', customerName, customerPhone, notes } = input

  // If custom items are not provided, resolve items from the preset pattern
  let itemsToBill: { productId: string; quantity: number; unit: 'TABLET'; isTabletSale: boolean }[] = []

  if (input.items && input.items.length > 0) {
    itemsToBill = input.items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity || 1,
      unit: 'TABLET',
      isTabletSale: true,
    }))
  } else {
    const patterns = await getAvailableSalesPatterns(branchId)
    const pattern = patterns.find((p) => p.id === patternId)
    if (!pattern) {
      throw new Error(`Sales pattern '${patternId}' not found or no matching products in branch`)
    }
    if (!pattern.canAutoBill) {
      throw new Error(`Cannot auto-bill pattern: ${pattern.stockWarning || 'insufficient stock'}`)
    }
    itemsToBill = pattern.items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      unit: 'TABLET',
      isTabletSale: true,
    }))
  }

  // Pre-calculate total amount to generate exact payment
  let estimatedTotal = 0
  for (const it of itemsToBill) {
    const prod = await prisma.product.findUnique({
      where: { id: it.productId },
      select: { mrp: true, tabsPerStrip: true },
    })
    if (prod) {
      const tabs = prod.tabsPerStrip && prod.tabsPerStrip > 1 ? prod.tabsPerStrip : 10
      const tabPrice = round2(Number(prod.mrp) / tabs)
      estimatedTotal += round2(tabPrice * it.quantity)
    }
  }
  estimatedTotal = round2(estimatedTotal)
  if (estimatedTotal <= 0) estimatedTotal = 1 // Safe floor

  const sale = await createSale(
    {
      branchId,
      items: itemsToBill.map((it) => ({
        productId: it.productId,
        quantity: it.quantity,
        unit: it.unit,
        isTabletSale: it.isTabletSale,
      })),
      payments: [
        {
          method: paymentMethod,
          amount: estimatedTotal,
          reference: `AUTO-BILL-${patternId.toUpperCase()}-${Date.now().toString().slice(-4)}`,
        },
      ],
      customer: {
        name: customerName?.trim() || 'Walk-in Tablet Patient',
        phone: customerPhone?.trim() || undefined,
      },
      notes: notes?.trim() || `Auto-billed pattern: ${patternId}`,
    },
    actor
  )

  return { success: true, sale }
}

