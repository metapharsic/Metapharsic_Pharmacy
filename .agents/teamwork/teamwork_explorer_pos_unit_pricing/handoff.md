# Technical Blueprint & Architectural Investigation Report: Flexible Unit/Strip Pricing, Real-Time Profit Intelligence, and Multi-Threaded Engine in POS

**Mission**: Design a comprehensive technical blueprint to enable flexible medicine selling rates (strips and loose tablets), single tablet rate designing, real-time strip/tablet cost & profit calculation at Point of Sale (POS), and multi-threaded worker offloading.  
**Author**: `teamwork_explorer_pos_unit_pricing`  
**Date**: 2026-11-02  
**Status**: Investigation Complete — Ready for Implementation  

---

## 1. Observation

Direct observations from the local codebase and execution environment:

### 1.1 Product, Batch & Sale Data Models (`prisma/schema.prisma`)
- **Product Model (`prisma/schema.prisma:300-356`)**:
  ```prisma
  model Product {
    id                     String            @id @default(cuid())
    name                   String
    sku                    String            @unique
    unitOfMeasure          String            @default("Strip")
    tabsPerStrip           Int?
    packSize               String?           // e.g., "10 tablets", "100ml"
    mrp                    Decimal           @db.Decimal(12, 2)
    ptr                    Decimal?          @db.Decimal(12, 2) // Price to retailer
    pts                    Decimal?          @db.Decimal(12, 2) // Price to stockist
    costPrice              Decimal?          @db.Decimal(12, 2)
    // ...
  }
  ```
  *Observation*: `tabsPerStrip` exists on `Product`. However, there is no stored field for a configured `tabletRate` (custom loose tablet rate) or `tabletCost`. Loose tablet rate is currently assumed to be strictly pro-rated as `mrp / tabsPerStrip` without allowing the pharmacy to define a premium loose tablet rate (e.g., to cover blister-cut wastage and handling).

- **Batch Model (`prisma/schema.prisma:500-535`)**:
  ```prisma
  model Batch {
    id                String      @id @default(cuid())
    productId         String
    batchNumber       String
    purchasePrice     Decimal     @db.Decimal(12, 2) // Cost price per pack/strip
    mrp               Decimal     @db.Decimal(12, 2)
    quantity          Int         @default(0)        // In pack/strip units
    soldQuantity      Int         @default(0)
    status            BatchStatus @default(ACTIVE)
    // ...
  }
  ```
  *Observation*: Batch stores `purchasePrice` as the pack/strip purchase cost. Tablet cost is not persisted, but can be derived dynamically as `purchasePrice / (tabsPerStrip ?? 1)`.

- **SaleItem Model (`prisma/schema.prisma:645-675`)**:
  ```prisma
  model SaleItem {
    id               String   @id @default(cuid())
    saleId           String
    productId        String
    productName      String
    productSku       String
    quantity         Int
    billedUnits      Int      @default(0)
    looseUnits       Int      @default(0)
    totalBaseQty     Int      @default(0)
    unitPrice        Decimal  @db.Decimal(12, 2)
    discountPercent  Decimal  @default(0) @db.Decimal(5, 2)
    discountAmount   Decimal  @default(0) @db.Decimal(12, 2)
    taxPercent       Decimal  @default(0) @db.Decimal(5, 2)
    taxAmount        Decimal  @default(0) @db.Decimal(12, 2)
    totalAmount      Decimal  @db.Decimal(12, 2)
    mrp              Decimal  @db.Decimal(12, 2)
    // ...
  }
  ```
  *Observation*: Fields `billedUnits`, `looseUnits`, and `totalBaseQty` exist in the schema, but are currently not populated by `sales-service.ts`. Neither `costPrice`, `profitAmount`, nor `profitPercent` are persisted on `SaleItem`, requiring them to be calculated dynamically on the fly.

### 1.2 Sales Pricing & Profit Intelligence Logic (`src/lib/sales/pricing.ts`)
- In `src/lib/sales/pricing.ts:272-355`, `computeItemProfit` already contains math for loose tablets:
  ```typescript
  const isTablet = Boolean(
    item.isTabletSale === true ||
    item.unit === 'TABLET' ||
    item.unit === 'Tablet'
  )
  const tabsPerStrip = item.tabsPerStrip ?? item.product?.tabsPerStrip ?? 1
  const stripDivisor = isTablet && tabsPerStrip > 1 ? tabsPerStrip : 1

  // Allocated cost per tablet
  allocatedCost += (rate / stripDivisor) * q
  ```
- In `src/lib/sales/pricing.test.ts:241-255`, this math is verified:
  ```typescript
  // Batch purchasePrice = 21, tabsPerStrip = 15 => 21 / 15 = 1.40 cost per tab
  // TotalAmount = 2.24 => Profit = 0.84 (37.5%)
  ```
- *Observation*: The core pure math functions for profit already support pro-rated tablet cost division (`rate / stripDivisor`). However, this logic is currently executed only on historical sale reads (`listSales`), and is **never called or rendered during the active POS checkout flow**.

### 1.3 POS Frontend Cart & Inline Billing Grid
- In `src/components/pos/formats/format-1-inline-grid.tsx:579-584`:
  ```tsx
  <td className="py-2 px-3 text-right font-mono text-foreground">
    <div>₹{line.mrp.toFixed(2)}</div>
    <div className="text-[9px] text-muted-foreground font-normal">
      {line.isTabletSale ? 'per tab' : 'per strip'}
    </div>
  </td>
  ```
  And in the entry row (`format-1-inline-grid.tsx:914-924`):
  ```tsx
  <td className="py-2.5 px-3 text-right font-mono text-xs font-bold text-foreground">
    {selectedProduct ? <div>₹{effectiveUnitRate.toFixed(2)}</div> : '-'}
  </td>
  ```
  *Observation*:
  1. The MRP/Rate cell is rendered as **static read-only text**. Pharmacists cannot edit the selling rate at the point of sale.
  2. The cost price of the strip and tablet is completely hidden.
  3. Real-time profit and profit margin % are missing from the table rows and the footer summary bar.

- In `src/components/pos/formats/format-1-inline-grid.tsx:471-521`:
  There is already a toggle for `✂️ TABLET` vs `📦 STRIP` with cut-tabs stepper (`tabsCut`), but it strictly computes tablet price as `round2(baseMrp / tabs)`. There is no interface to design or customize the tablet rate.

### 1.4 Critical Stock Deduction Discrepancy in `src/lib/sales/sales-service.ts`
- In `src/lib/sales/sales-service.ts:1103-1113` & `1222-1239`:
  ```typescript
  for (const { product, input } of resolved) {
    const quantity = input.quantity
    const inventory = await tx.inventory.findUnique(...)
    if (inventory.availableQuantity < quantity) {
      throw new Error(`Insufficient available stock: ${product.name} (available ${inventory.availableQuantity})`)
    }
    // ...
    const afterTotal = inventory.totalQuantity - quantity
    const afterAvailable = inventory.availableQuantity - quantity
  ```
  *Observation*: When a tablet sale occurs (e.g., selling 5 tablets from a strip of 10), `input.quantity` is 5. Because inventory is stored in pack/strip units, `sales-service.ts` subtracts 5 **strips** (50 tablets) from inventory instead of 0.5 strips or base unit fractional conversion!

### 1.5 Existing Worker Thread Architecture
- The codebase already contains mature worker thread implementations:
  1. `src/lib/db/db-worker-pool.ts` (Persistent worker thread pool with task queues and message handlers).
  2. `src/lib/reports/reporting-worker-bridge.ts` (Dispatches tasks to `reporting-analytics.worker.js` with timeout watchdogs and synchronous fallbacks).
  3. `src/lib/inventory/workers/inventory-analytics.worker.js` (Performs dead-stock and valuation calculations off the event loop).
  4. `scripts/multithreaded_wire_sales_profit_and_whatsapp_eod.ts` (Exercises worker threads with `THREAD_PROFIT_INTELLIGENCE_ENGINE`).
- *Observation*: The standard IPC pattern in this repository is:
  ```typescript
  // Parent -> Worker
  worker.postMessage({ id: taskId, command: 'COMMAND_NAME', payload: { ... } })

  // Worker -> Parent
  parentPort.postMessage({ id: taskId, success: true, data: result })
  ```
  With a guaranteed fallback function `runSynchronousFallback()` when `Worker` is unavailable.

---

## 2. Logic Chain

From the observations above, the design requirements proceed along this causal chain:

1. **Flexible Selling Rate**:
   - Because pharmacists negotiate rates with retail patients, wholesalers, and chronic-care customers, POS cart lines must allow direct input of a `customRate` (or `sellingRate`).
   - If `customRate` is entered:
     - When Unit is `STRIP`: `sellingRate = customRate` (pro-rated tablet rate updates automatically).
     - When Unit is `TABLET`: `sellingRate = customRate` (strip rate remains baseline or recalculates).
   - This directly maps to `ItemPricingInput.customUnitPrice` which is already supported in `computeItemPricing` (`src/lib/sales/pricing.ts:92`).

2. **Designing the Single Tablet Rate**:
   - Pharmacies often sell loose cut tablets at a higher rate per tablet than the pure strip pro-rata to absorb blister strip wastage, damaged foil, and labor.
   - For example: Strip MRP = ₹100 for 10 tablets (pro-rata = ₹10.00/tab). The pharmacy wants to sell 1 loose tablet at ₹12.00 (+20% loose markup) or a custom ₹11.50.
   - Therefore, the system requires a **Single Tablet Rate Designer**:
     - Formula: $\text{DefaultTabletRate} = \text{round2}(\text{StripRate} / \text{tabsPerStrip})$
     - Markup Formula: $\text{DesignedTabletRate} = \text{round2}(\text{DefaultTabletRate} \times (1 + \text{LooseMarkupPct} / 100))$
     - Custom Override: Pharmacist can type any exact rupee value $\ge 0.01$.

3. **Calculating Cost and Real-Time Profit at POS**:
   - For any item in the cart:
     - $\text{StripCost} = \text{Batch.purchasePrice} \text{ (fallback: Product.costPrice } \to \text{Product.ptr)}$
     - $\text{TabletCost} = \text{round2}(\text{StripCost} / (\text{Product.tabsPerStrip} \text{ or } 10))$
     - If selling Strips ($Q_{\text{strip}}$):
       - $\text{LineCost} = \text{StripCost} \times Q_{\text{strip}}$
       - $\text{LineGross} = \text{StripRate} \times Q_{\text{strip}}$
     - If selling Tablets ($Q_{\text{tab}}$):
       - $\text{LineCost} = \text{TabletCost} \times Q_{\text{tab}}$
       - $\text{LineGross} = \text{TabletRate} \times Q_{\text{tab}}$
     - $\text{LineDiscount} = \text{round2}(\text{LineGross} \times (\text{DiscountPct} / 100))$
     - $\text{LineRevenue} = \text{LineGross} - \text{LineDiscount}$
     - $\text{LineProfit} = \text{LineRevenue} - \text{LineCost}$
     - $\text{LineMarginPct} = \text{LineRevenue} > 0 ? \text{round2}((\text{LineProfit} / \text{LineRevenue}) \times 100) : 0$
   - Displaying this live in the POS UI gives the pharmacist instant visibility into margin and immediately warns if a custom rate dips below cost price ($\text{LineProfit} < 0$).

4. **Multi-Threaded Worker Offloading**:
   - Recalculating line pricing, multi-batch cost allocations, GST back-calculations, and profit metrics across 20-50 line items every time a quantity, discount, or rate keystroke occurs can cause input jank on the main JavaScript thread.
   - A dedicated Node.js Worker Thread (`pos-pricing.worker.js`) combined with a client-side Web Worker / debounced bridge offloads 100% of the cost attribution, tax calculation, and profit aggregation from the main UI thread.
   - This maintains a 60 FPS counter billing experience while guaranteeing mathematical precision.

---

## 3. Comprehensive Technical Blueprint & Architecture

### 3.1 Mathematical Engine & Business Formulas

| Metric | Strip Sale ($Q_{\text{strip}}$) | Loose Tablet Sale ($Q_{\text{tab}}$) |
|---|---|---|
| **Unit Cost ($C_{\text{unit}}$)** | $\text{Batch.purchasePrice}$ (or Product costPrice) | $C_{\text{strip}} / \text{tabsPerStrip}$ |
| **Unit Selling Rate ($R_{\text{unit}}$)** | Custom Strip Rate (default: MRP) | Custom Tablet Rate (default: Strip Rate / tabsPerStrip) |
| **Gross Amount ($G$)** | $R_{\text{unit}} \times Q_{\text{strip}}$ | $R_{\text{unit}} \times Q_{\text{tab}}$ |
| **Discount Amount ($D$)** | $\text{round2}(G \times \text{Disc\%} / 100)$ | $\text{round2}(G \times \text{Disc\%} / 100)$ |
| **Net Revenue ($L$)** | $G - D$ | $G - D$ |
| **Total Cost ($C_{\text{total}}$)** | $C_{\text{unit}} \times Q_{\text{strip}}$ | $C_{\text{unit}} \times Q_{\text{tab}}$ |
| **Cash Profit ($\Pi$)** | $L - C_{\text{total}}$ | $L - C_{\text{total}}$ |
| **Profit Margin % ($M$)** | $( \Pi / L ) \times 100$ | $( \Pi / L ) \times 100$ |
| **Cost Markup % ($MU$)** | $( \Pi / C_{\text{total}} ) \times 100$ | $( \Pi / C_{\text{total}} ) \times 100$ |

#### GST Considerations (Tax-Inclusive Retail Mode)
Under standard Indian retail pharmacy practice, MRP and counter selling rates are **tax-inclusive**:
- $\text{TaxableAmount} = \text{round2}(L / (1 + \text{gstRate}/100))$
- $\text{TotalGST} = \text{round2}(L - \text{TaxableAmount})$
- Split: $\text{CGST} = \text{round2}(\text{TaxableAmount} \times \text{cgstRate}/100)$, $\text{SGST} = \text{round2}(\text{TaxableAmount} \times \text{sgstRate}/100)$
- **Pre-Tax Commercial Profit**: $\Pi_{\text{pre-tax}} = \text{TaxableAmount} - C_{\text{total}}$ (used when input tax credit is fully claimed).
- **Cash Gross Margin**: $\Pi_{\text{cash}} = L - C_{\text{total}}$ (used for counter cash drawer tracking).

---

### 3.2 Database Schema Blueprint (`prisma/schema.prisma`)

```prisma
// ─── 1. Product Model Additions ──────────────────────────────
model Product {
  // Existing fields...
  tabsPerStrip           Int?             @default(10)
  tabletRate             Decimal?         @db.Decimal(12, 2) // Explicit configured loose tablet rate
  tabletCost             Decimal?         @db.Decimal(12, 2) // Optional pre-calculated tablet cost
  looseMarkupPercent     Decimal?         @default(0.00) @db.Decimal(5, 2) // e.g. 15.00%
  minSellingRate         Decimal?         @db.Decimal(12, 2) // Floor price protection
  // ...
}

// ─── 2. SaleItem Model Additions ─────────────────────────────
model SaleItem {
  // Existing fields...
  pricingUnit            String           @default("STRIP") // 'STRIP' | 'TABLET'
  tabsPerStrip           Int?             @default(10)
  isTabletSale           Boolean          @default(false)
  tabsCut                Int?             // Exact loose tablet count if cut
  customRate             Decimal?         @db.Decimal(12, 2) // Custom rate entered at POS
  unitCost               Decimal?         @db.Decimal(12, 2) // Snapshot cost at time of sale
  lineCost               Decimal?         @db.Decimal(12, 2) // unitCost * quantity
  lineProfit             Decimal?         @db.Decimal(12, 2) // net total - lineCost
  lineProfitPercent      Decimal?         @db.Decimal(5, 2)  // margin %
  // ...
}

// ─── 3. Sale Model Additions ─────────────────────────────────
model Sale {
  // Existing fields...
  totalPurchaseCost      Decimal?         @default(0) @db.Decimal(12, 2)
  totalProfit            Decimal?         @default(0) @db.Decimal(12, 2)
  profitMarginPercent    Decimal?         @default(0) @db.Decimal(5, 2)
  // ...
}
```

---

### 3.3 Multi-Threaded Worker Engine Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             POS UI Client                                   │
│  - Pharmacist edits Quantity, Unit (Strip/Tablet), or Custom Selling Rate   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ (Debounced RPC / Web Worker Dispatch)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    src/lib/sales/pos-pricing-worker-bridge.ts               │
│  - Manages Node.js Worker pool or single worker instance                    │
│  - Formats IPC Message: { id, command, payload }                            │
│  - Monitors timeout (2000ms watchdog)                                       │
│  - Fallback: Pure synchronous math in src/lib/sales/pricing.ts              │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ (worker_threads IPC)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│             src/lib/sales/workers/pos-pricing.worker.js                     │
│                                                                             │
│  [Command: CALCULATE_LINE]                                                  │
│  ├─ Pro-rates cost: Strip Cost -> Tablet Cost (purchasePrice / tabs)        │
│  ├─ Computes designed tablet rate: base / markup / custom override          │
│  ├─ Computes GST back-out (CGST / SGST / IGST)                               │
│  ├─ Calculates Line Profit, Margin %, and Loss Warning (< 0)                │
│                                                                             │
│  [Command: CALCULATE_CART_TOTALS]                                           │
│  ├─ Aggregates all lines in parallel                                        │
│  ├─ Computes Subtotal, Total GST, Round-Off, Total Revenue                  │
│  ├─ Computes Total Cart Purchase Cost & Total Cart Profit                   │
│  └─ Generates Overall Profit Margin % & Warning Flags                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### IPC Message Protocol Definition:

1. **`Parent -> Worker` Request**:
   ```typescript
   export interface PosWorkerRequest {
     id: string
     command: 'CALCULATE_LINE' | 'CALCULATE_CART_TOTALS' | 'DESIGN_TABLET_RATE'
     payload: {
       items?: Array<{
         productId: string
         productName: string
         unit: 'STRIP' | 'TABLET'
         tabsPerStrip: number
         quantity: number
         stripCost: number
         stripMrp: number
         customRate?: number
         discountPercent?: number
         gstRate: number
         cgstRate: number
         sgstRate: number
         igstRate: number
         isGstExempt: boolean
       }>
       taxInclusive?: boolean
       roundOffTotal?: boolean
     }
   }
   ```

2. **`Worker -> Parent` Response**:
   ```typescript
   export interface PosWorkerResponse {
     id: string
     success: boolean
     data?: {
       lines: Array<{
         productId: string
         unit: 'STRIP' | 'TABLET'
         quantity: number
         effectiveRate: number
         unitCost: number
         lineCost: number
         grossAmount: number
         discountAmount: number
         netRevenue: number
         taxableAmount: number
         taxAmount: number
         profitAmount: number
         marginPercent: number
         isBelowCost: boolean
       }>
       cartTotals: {
         subtotal: number
         discountAmount: number
         taxAmount: number
         totalAmount: number
         totalCost: number
         totalProfit: number
         overallMarginPercent: number
         hasNegativeMarginItem: boolean
       }
       durationMs: number
     }
     error?: string
   }
   ```

---

### 3.4 Production Implementation of Worker & Bridge

#### 1. Worker Script: `src/lib/sales/workers/pos-pricing.worker.js`
```javascript
const { parentPort } = require('worker_threads')

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function calculateLine(item, taxInclusive = true) {
  const isTablet = item.unit === 'TABLET'
  const tabs = Math.max(1, item.tabsPerStrip || 10)

  // Cost calculation
  const stripCost = Number(item.stripCost) || 0
  const tabletCost = round2(stripCost / tabs)
  const unitCost = isTablet ? tabletCost : stripCost

  // Selling rate calculation
  const defaultStripRate = Number(item.stripMrp) || 0
  const defaultTabletRate = round2(defaultStripRate / tabs)
  const baselineRate = isTablet ? defaultTabletRate : defaultStripRate
  const effectiveRate = item.customRate != null && item.customRate > 0 ? Number(item.customRate) : baselineRate

  const quantity = Math.max(1, item.quantity || 1)
  const grossAmount = round2(effectiveRate * quantity)
  const discountPercent = Math.max(0, Math.min(100, Number(item.discountPercent) || 0))
  const discountAmount = round2((grossAmount * discountPercent) / 100)
  const netRevenue = round2(grossAmount - discountAmount)

  // Cost & Profit
  const lineCost = round2(unitCost * quantity)
  const profitAmount = round2(netRevenue - lineCost)
  const marginPercent = netRevenue > 0 ? round2((profitAmount / netRevenue) * 100) : 0
  const isBelowCost = profitAmount < 0

  // GST Math
  const gstRate = Number(item.gstRate) || 0
  const cgstRate = Number(item.cgstRate) || 0
  const sgstRate = Number(item.sgstRate) || 0
  const igstRate = Number(item.igstRate) || 0
  const isExempt = Boolean(item.isGstExempt) || gstRate === 0

  let taxableAmount = netRevenue
  let cgstAmount = 0
  let sgstAmount = 0
  let igstAmount = 0
  let taxAmount = 0

  if (!isExempt) {
    if (taxInclusive) {
      taxableAmount = round2(netRevenue / (1 + gstRate / 100))
      cgstAmount = round2((taxableAmount * cgstRate) / 100)
      sgstAmount = round2((taxableAmount * sgstRate) / 100)
      igstAmount = round2((taxableAmount * igstRate) / 100)
      taxAmount = round2(cgstAmount + sgstAmount + igstAmount)
    } else {
      taxableAmount = netRevenue
      cgstAmount = round2((taxableAmount * cgstRate) / 100)
      sgstAmount = round2((taxableAmount * sgstRate) / 100)
      igstAmount = round2((taxableAmount * igstRate) / 100)
      taxAmount = round2(cgstAmount + sgstAmount + igstAmount)
    }
  }

  return {
    productId: item.productId,
    unit: item.unit,
    tabsPerStrip: tabs,
    quantity,
    unitCost,
    effectiveRate,
    grossAmount,
    discountAmount,
    netRevenue,
    lineCost,
    profitAmount,
    marginPercent,
    isBelowCost,
    taxableAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    taxAmount,
    totalAmount: taxInclusive ? netRevenue : round2(taxableAmount + taxAmount),
  }
}

function calculateCartTotals(payload) {
  const { items = [], taxInclusive = true, roundOffTotal = false } = payload
  const lines = items.map((it) => calculateLine(it, taxInclusive))

  const subtotal = round2(lines.reduce((s, l) => s + l.grossAmount, 0))
  const discountAmount = round2(lines.reduce((s, l) => s + l.discountAmount, 0))
  const taxAmount = round2(lines.reduce((s, l) => s + l.taxAmount, 0))
  const rawTotal = round2(lines.reduce((s, l) => s + l.totalAmount, 0))
  const totalAmount = roundOffTotal ? Math.round(rawTotal) : rawTotal

  const totalCost = round2(lines.reduce((s, l) => s + l.lineCost, 0))
  const totalProfit = round2(totalAmount - totalCost)
  const overallMarginPercent = totalAmount > 0 ? round2((totalProfit / totalAmount) * 100) : 0
  const hasNegativeMarginItem = lines.some((l) => l.isBelowCost)

  return {
    lines,
    cartTotals: {
      subtotal,
      discountAmount,
      taxAmount,
      totalAmount,
      totalCost,
      totalProfit,
      overallMarginPercent,
      hasNegativeMarginItem,
    },
  }
}

if (parentPort) {
  parentPort.on('message', (msg) => {
    const start = Date.now()
    try {
      if (msg.command === 'CALCULATE_CART_TOTALS') {
        const result = calculateCartTotals(msg.payload)
        parentPort.postMessage({
          id: msg.id,
          success: true,
          data: { ...result, durationMs: Date.now() - start },
        })
      } else if (msg.command === 'CALCULATE_LINE') {
        const line = calculateLine(msg.payload.item, msg.payload.taxInclusive)
        parentPort.postMessage({
          id: msg.id,
          success: true,
          data: { line, durationMs: Date.now() - start },
        })
      } else {
        throw new Error(`Unknown command: ${msg.command}`)
      }
    } catch (err) {
      parentPort.postMessage({
        id: msg.id,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  })
}

module.exports = { calculateLine, calculateCartTotals }
```

#### 2. Worker Bridge: `src/lib/sales/pos-pricing-worker-bridge.ts`
```typescript
import path from 'path'
import { Worker } from 'worker_threads'
import { existsSync } from 'fs'

const { calculateCartTotals, calculateLine } = require('./workers/pos-pricing.worker.js')

function resolveWorkerPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'src/lib/sales/workers/pos-pricing.worker.js'),
    path.resolve(__dirname, 'workers/pos-pricing.worker.js'),
    path.resolve(__dirname, 'pos-pricing.worker.js'),
  ]
  for (const c of candidates) {
    if (existsSync(c)) return c
  }
  return candidates[0]
}

export function runPosPricingWorker<TInput, TOutput>(
  command: 'CALCULATE_CART_TOTALS' | 'CALCULATE_LINE',
  payload: TInput
): Promise<TOutput> {
  if (typeof Worker === 'undefined') {
    return Promise.resolve(runSynchronousFallback<TInput, TOutput>(command, payload))
  }

  return new Promise<TOutput>((resolve, reject) => {
    try {
      const workerPath = resolveWorkerPath()
      const worker = new Worker(workerPath)
      const taskId = `pos_price_${Date.now()}_${Math.random().toString(36).substring(7)}`

      const timeout = setTimeout(() => {
        void worker.terminate()
        resolve(runSynchronousFallback<TInput, TOutput>(command, payload))
      }, 2000)

      worker.on('message', (msg) => {
        if (msg.id === taskId) {
          clearTimeout(timeout)
          void worker.terminate()
          if (msg.success) resolve(msg.data)
          else reject(new Error(msg.error || 'Worker error'))
        }
      })

      worker.on('error', () => {
        clearTimeout(timeout)
        void worker.terminate()
        resolve(runSynchronousFallback<TInput, TOutput>(command, payload))
      })

      worker.postMessage({ id: taskId, command, payload })
    } catch {
      resolve(runSynchronousFallback<TInput, TOutput>(command, payload))
    }
  })
}

function runSynchronousFallback<TInput, TOutput>(command: string, payload: any): TOutput {
  if (command === 'CALCULATE_CART_TOTALS') {
    return calculateCartTotals(payload) as TOutput
  }
  if (command === 'CALCULATE_LINE') {
    return calculateLine(payload.item, payload.taxInclusive) as TOutput
  }
  throw new Error(`Unsupported fallback command: ${command}`)
}
```

---

### 3.5 UI Wireframe & Interaction Design for POS

#### A. Enhanced Cart Row Wireframe (`Format 1: Inline Grid`)
```
+----+--------------------------------+-------+--------+-----+------------------+-------+--------------------+
| #  | Item Name & Unit Mode          | Batch | Expiry | Qty | Selling Rate (₹) | Disc% | Net & Profit       |
+----+--------------------------------+-------+--------+-----+------------------+-------+--------------------+
| 01 | Dolo 650mg Tablet              | BAT01 | Dec-27 |  10 | [₹ 3.50] / tab   |   0%  | Net: ₹ 35.00       |
|    | [📦 Strip] [✂️ Tablet: 10 tabs] |       |        | tabs| (MRP: ₹30/strip) |       | Cost: ₹1.80/tab    |
|    |                                |       |        |     | [↺ Reset to MRP] |       | Profit: +₹17 (48%) |
+----+--------------------------------+-------+--------+-----+------------------+-------+--------------------+
```

#### Key UI Capabilities:
1. **Interactive Unit Toggle Pill**:
   - `[📦 Full Strip (10 Tabs)]` vs `[✂️ Cut Tablets]`
   - 1-click toggling instantly recalculates the default pro-rated rate and cost basis.
2. **Editable Selling Rate Input**:
   - Pharmacists can type any selling rate directly into the `Selling Rate (₹)` column cell.
   - If changed, a small badge `[Custom]` appears with a one-click `[↺ Reset]` button to revert to standard MRP.
3. **Live Profit Badge (Margin Intelligence)**:
   - Beneath the Net Total:
     - Shows unit cost: `Cost: ₹1.80/tab`
     - Shows line profit & margin %: `Profit: +₹17.00 (48.6%)` in emerald green.
     - If selling below cost: turns vivid red with warning badge `⚠️ Below Cost (-₹2.50)`.
4. **Footer Commercial Intelligence Bar**:
   - Alongside `Subtotal: ₹1,240.00` and `Net Payable: ₹1,350.00`:
   - `Est. Purchase Cost: ₹890.00`
   - `Gross Profit: +₹460.00`
   - `Margin: 34.1%`
   - A toggle eye icon `[👁️ Staff Privacy Mode]` to blur profit metrics when the screen faces patients.

#### B. Single Tablet Rate Designer Modal (`tablet-rate-designer-modal.tsx`)
A dedicated dialog accessible from:
1. The Product Catalog table (`⚡ Set Tablet Rate`)
2. Clicking on the rate cell in POS

```
┌────────────────────────────────────────────────────────────────────────┐
│ ✂️ Single Tablet Rate Designer — Dolo 650mg                            │
├────────────────────────────────────────────────────────────────────────┤
│ Pack Structure:                                                        │
│ • Tabs per Strip: [ 10 ] tablets                                       │
│ • Strip Purchase Cost: ₹ 18.00  ──►  Single Tablet Cost: ₹ 1.80        │
│ • Strip MRP:           ₹ 30.00  ──►  Pro-rated Tab MRP:  ₹ 3.00        │
├────────────────────────────────────────────────────────────────────────┤
│ Configure Loose Tablet Selling Rate:                                   │
│ [ (•) Exact Pro-Rata (₹3.00) ]  [ ( ) +10% Markup (₹3.30) ]            │
│ [ ( ) +20% Markup (₹3.60)    ]  [ ( ) Custom Rate: [ ₹ 3.50 ] ]        │
├────────────────────────────────────────────────────────────────────────┤
│ Profit Projection Comparison:                                          │
│                                                                        │
│ Unit Sold   Selling Rate   Unit Cost   Unit Profit   Margin %          │
│ 1 Strip     ₹ 30.00        ₹ 18.00     +₹ 12.00      40.0%             │
│ 1 Tablet    ₹  3.50        ₹  1.80     +₹  1.70      48.6%             │
│ 5 Tablets   ₹ 17.50        ₹  9.00     +₹  8.50      48.6%             │
├────────────────────────────────────────────────────────────────────────┤
│ [ Cancel ]                                [ Save & Apply to POS ]      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Caveats

1. **Fractional Stock Tracking in Inventory Model**:
   - Currently, `Inventory.availableQuantity` and `Batch.quantity` are integer columns (`Int`).
   - If a pharmacy sells 5 tablets from a 10-tablet strip:
     - *Approach A (Cleanest without DB migration)*: Track stock in **Base Units (Tablets)** across the entire system ($1\text{ strip} = 10\text{ units}$ in DB, with UI displaying "X strips + Y tabs").
     - *Approach B (Blister Cut Tracking)*: When the first tablet of a strip is cut, mark 1 full strip as "Opened/Cut Container" in a lightweight `CutStrip` cache, decrementing 1 strip from sealed inventory and incrementing loose unit counter.
2. **Staff Permission Masking**:
   - Profit and cost metrics must be protected under permission `PERMISSIONS.SALES_VIEW_PROFIT` or restricted to `['owner', 'admin', 'manager']`. Cashier-level staff should only see the rate and discount unless granted explicit override.
3. **Negative Profit Protection**:
   - If a cashier enters a custom selling rate lower than the purchase cost, the system should prompt for Manager PIN / Supervisor Authorization before finalizing the bill.

---

## 5. Conclusion

- **Feasibility**: High. The foundational pure math (`computeItemProfit` in `src/lib/sales/pricing.ts`) already implements pro-rated tablet cost division and margin calculation with passing unit tests.
- **Architectural Fit**: The multi-threaded worker bridge follows the established `worker_threads` pattern used by `inventory-analytics.worker.js` and `reporting-worker-bridge.ts`.
- **User Impact**: Fully delivers on the user requirement:
  1. Pharmacists can flexibly sell strips or loose tablets at any custom rate.
  2. Pharmacies can design loose tablet rates with automated markup or custom rupee pricing.
  3. Live strip/tablet cost, line profit, and overall bill margin are computed instantaneously off the main thread.

---

## 6. Verification Method

To verify the design once implemented:

1. **Unit Tests**:
   - Run existing and new pricing tests:
     ```powershell
     npm run test:unit -- src/lib/sales/pricing.test.ts
     ```
   - Add new worker verification test:
     ```powershell
     npm run test:unit -- src/lib/sales/__tests__/pos-pricing-worker.test.ts
     ```
2. **Formula Verification Table**:
   | Test Case | Unit | Qty | Cost | Rate | Disc% | Expected Revenue | Expected Cost | Expected Profit | Expected Margin % |
   |---|---|---|---|---|---|---|---|---|---|
   | Full Strip | STRIP | 2 | ₹50.00 | ₹80.00 | 10% | ₹144.00 | ₹100.00 | +₹44.00 | 30.56% |
   | Single Tab (Pro-rata) | TABLET (10T) | 1 | ₹5.00 | ₹8.00 | 0% | ₹8.00 | ₹5.00 | +₹3.00 | 37.50% |
   | Single Tab (Designed) | TABLET (10T) | 5 | ₹5.00 | ₹9.50 | 0% | ₹47.50 | ₹25.00 | +₹22.50 | 47.37% |
   | Below Cost Warning | STRIP | 1 | ₹50.00 | ₹40.00 | 0% | ₹40.00 | ₹50.00 | -₹10.00 | -25.00% (Flagged) |

3. **Multi-Thread Performance Benchmarking**:
   - Dispatch 1,000 cart lines simultaneously to `runPosPricingWorker('CALCULATE_CART_TOTALS', payload)`.
   - Invalidation condition: Duration > 50ms or main event loop blocking > 5ms.
