# Handoff Report: Capital Lockup & Aging & Dead Stock Radar Investigation

## 1. Observation

### 1.1 Architecture & Component Mapping
- **UI Navigation & Lifecycle Tabs**:
  - `src/components/inventory/inventory-lifecycle-tabs.tsx` (Lines 60–67):
    Tab identifier `'dead_stock'` pairs the label `"Dead Stock Radar"` directly with the sublabel `"Capital Lockup & Aging"`:
    ```tsx
    {
      id: 'dead_stock',
      label: 'Dead Stock Radar',
      sublabel: 'Capital Lockup & Aging',
      icon: TrendingDown,
      badge: counts.deadStockCount,
      badgeColor: 'bg-destructive/15 text-destructive border-destructive/30',
    }
    ```
  - `src/components/inventory/inventory-overview.tsx` (Lines 833–835):
    Tab content renders `<DeadStockView branchId={branchId} />`.
  - `src/components/inventory/dead-stock-view.tsx` (Lines 200–270):
    Renders executive KPI metrics:
    - `"Locked Working Capital"` (`s.totalDeadCapitalAtCost`, `s.totalDeadCapitalAtMrp`).
    - `"Aging Breakdown"` (`s.deadStockCount` [90–180d], `s.slowMovingCount` [60–90d], `s.obsoleteCount` [>180d]).
    - Filters toolbar with threshold selector (`60`, `90`, `180` days) and search query input.
    - Data table showing items, location (Rack > Shelf > Box), supplier, days inactive, status badge (`SLOW_MOVING`, `DEAD_STOCK`, `OBSOLETE`), units on hand, capital locked at cost/MRP.

### 1.2 Data Loading Pipeline
- **Client Fetch Execution**:
  - In `src/components/inventory/dead-stock-view.tsx` (Lines 65–84):
    ```tsx
    const res = await fetch(`/api/inventory/dead-stock?${params.toString()}`)
    const json = await res.json()
    if (json.success && json.data) {
      setData(json.data as DeadStockResult)
    } else {
      toast.error('Failed to load dead stock report')
    }
    ```
- **API Endpoint**:
  - In `src/app/api/inventory/dead-stock/route.ts` (Lines 10–35):
    GET handler requires `PERMISSIONS.INVENTORY_READ`, resolves branch scope via `resolveBranchScope(user, rawBranchId)`, parses `thresholdDays`, and delegates to `getDeadStockReport({ branchId, thresholdDays })`.
- **Database Query Aggregation**:
  - In `src/lib/inventory/inventory-analytics-service.ts` (Lines 272–344):
    ```typescript
    const [inventories, sales, movements] = await Promise.all([
      prisma.inventory.findMany({
        where: { ...where, availableQuantity: { gt: 0 } },
        include: {
          product: {
            select: {
              id: true, name: true, sku: true, barcode: true,
              rack: true, unitOfMeasure: true, costPrice: true, mrp: true,
              batches: {
                where: { status: 'ACTIVE', quantity: { gt: 0 } },
                take: 1, orderBy: { createdAt: 'desc' },
                include: { purchase: { select: { supplier: { select: { id: true, name: true } } } } }
              }
            }
          },
          branch: { select: { id: true, name: true } }
        }
      }),
      prisma.saleItem.groupBy({
        by: ['productId'],
        _max: { createdAt: true },
      }),
      prisma.inventoryMovement.groupBy({
        by: ['inventoryId'],
        where: { type: 'OUT' },
        _max: { createdAt: true },
      })
    ])
    ```

### 1.3 Multi-Threading / Worker Execution
- **Worker Invocation**:
  - In `src/lib/inventory/inventory-analytics-service.ts` (Lines 192–268):
    `runInWorker` checks `process.env.NODE_ENV === 'test'`. If in test mode, it calls `computeDeadStock(payload)` synchronously.
    In non-test mode (dev/production):
    ```typescript
    const workerPath = path.resolve(__dirname, 'workers/inventory-analytics.worker.js')
    const worker = new Worker(workerPath)
    ...
    worker.postMessage({ id: taskId, command, payload })
    ```
- **Worker Script**:
  - Located at `src/lib/inventory/workers/inventory-analytics.worker.js`.
  - Computes `daysInactive`, `status` (`SLOW_MOVING`, `DEAD_STOCK`, `OBSOLETE`), `capitalLockedAtCost`, `capitalLockedAtMrp`, and summary rollups.

### 1.4 Observed Defects & Failures
1. **Worker Script Path Resolution Failure in Next.js Server Runtime**:
   `workerPath = path.resolve(__dirname, 'workers/inventory-analytics.worker.js')`.
   In Next.js bundled server environments, `__dirname` resolves to `.next/server/app/api/inventory/dead-stock` or similar. The directory `.next/server/app/api/inventory/dead-stock/workers/` does NOT exist.
   Verbatim Node.js worker error:
   `Error: Cannot find module '...workers\\inventory-analytics.worker.js'`
2. **Prisma `Decimal` Objects Fail Serialization in `worker.postMessage`**:
   `payload.inventories` contains Prisma model objects where `product.costPrice`, `product.mrp`, and batch prices are `Decimal` instances.
   Verbatim error reproduced via `v8.serialize(new Decimal('45.50'))`:
   `Error: function i(o){...} could not be cloned` (`DataCloneError`).
   This triggers an unhandled synchronous throw inside `new Promise`, leaving the spawned worker thread un-terminated and leaking.
3. **Flawed Inactivity Anchor (`Math.max(..., inv.updatedAt)`)**:
   In `src/lib/inventory/workers/inventory-analytics.worker.js` (Line 39):
   ```javascript
   const lastActivityTime = Math.max(lastSaleTime, lastMovementTime, new Date(inv.updatedAt).getTime())
   ```
   When items have no sales (`lastSaleTime === 0`) and no movements (`lastMovementTime === 0`), `lastActivityTime` collapses to `inv.updatedAt`. Because `updatedAt` is updated whenever inventory is seeded, migrated, or edited, `daysInactive` is calculated as 0, wiping out true aging.
4. **Summary Breakdown Truncated by Filter Window**:
   In `src/lib/inventory/workers/inventory-analytics.worker.js` (Lines 58–103):
   Items are only added to `deadItems` and counted towards `summary` if `daysInactive >= thresholdDays`.
   If the user selects `thresholdDays = 90`, `slowMovingCount` (60–90d) is computed as 0 on the executive card even if there are dozens of slow-moving items.
5. **Cross-Branch Sales Scope Bleed**:
   In `src/lib/inventory/inventory-analytics-service.ts` (Lines 312–315):
   `prisma.saleItem.groupBy` is called without any branch constraint. A sale of Product X in Branch B causes Product X in Branch A to appear actively moving, masking dead stock at Branch A.
6. **Summary Badge Discrepancy**:
   `src/lib/inventory/inventory-service.ts` calculates `deadStockCount` for the header badge using `updatedAt: { lte: sixtyDaysAgo }`, which conflicts with the true sales-and-movement analytics logic.

---

## 2. Logic Chain

1. **User Request Context**: The user reported that "Dead Stock Radar and Capital Lockup & Aging" fails with "failed to load the dead stock" and requested thread-safe multi-threaded data loading and accurate calculation.
2. **Path Tracing**:
   - `dead-stock-view.tsx` handles "Dead Stock & Capital Lockup Radar".
   - It performs an async `fetch('/api/inventory/dead-stock?thresholdDays=...')`.
   - On error or non-200 / `success: false` response, it fires `toast.error('Failed to load dead stock report')`.
3. **Root Cause 1 (Worker Path Failure)**:
   - In `runInWorker` (`inventory-analytics-service.ts`), `path.resolve(__dirname, 'workers/inventory-analytics.worker.js')` assumes standard CommonJS directory layout.
   - Next.js Webpack / SWC compiler compiles API routes into `.next/server/app/api/...`. At runtime, `__dirname` points to the `.next/server/` output tree, where worker JS files are omitted.
   - Node's `new Worker(workerPath)` fails with `ERR_MODULE_NOT_FOUND` / `Cannot find module`.
4. **Root Cause 2 (DataCloneError on Worker Message)**:
   - `prisma.inventory.findMany` returns Prisma records with fields of type `Decimal` (e.g. `costPrice`, `mrp`, `ptr`).
   - Node's `worker.postMessage()` uses the HTML structured clone algorithm (`v8.serialize`).
   - Custom class instances with non-cloneable functions/closures (`Decimal`) cannot be cloned and throw `DataCloneError: function could not be cloned`.
   - In `runInWorker`, when `worker.postMessage()` throws, `worker` was already constructed but `worker.terminate()` is never invoked in the outer catch block. The thread is orphaned and memory leaks.
5. **Root Cause 3 (Inactivity Skew)**:
   - In `inventory-analytics.worker.js`, `lastActivityTime` is computed as `Math.max(lastSaleTime, lastMovementTime, new Date(inv.updatedAt).getTime())`.
   - If a medicine was stocked 180 days ago and never sold, its `lastSaleTime` is 0 and `lastMovementTime` is 0.
   - If an automated script, stock count adjustment, or seed ran yesterday, `inv.updatedAt` becomes yesterday.
   - `Math.max(0, 0, yesterday) = yesterday`.
   - `daysInactive = Math.floor((now - yesterday) / 1 day) = 1`.
   - The medicine is classified as `HEALTHY` instead of `OBSOLETE`, masking capital lockup.
6. **Root Cause 4 (Aging Breakdown Metric Corruption)**:
   - The worker only aggregates `summary.slowMovingCount` and `summary.deadStockCount` from the filtered `deadItems` array (`daysInactive >= thresholdDays`).
   - When the user selects `thresholdDays = 90`, `slowMovingCount` becomes 0 in the UI KPI card because items with 60–90 days inactivity were filtered out before summary accumulation.

---

## 3. Caveats

1. **Worker Threads vs. Next.js Route Handlers**:
   In Next.js serverless/edge environments, `node:worker_threads` is unsupported. While the current application is running on Node.js (`Node.js v25.6.1`), any worker spawning inside Next.js routes must include a synchronous fallback or worker pool pattern with robust error boundaries.
2. **Database Sizing**:
   `prisma.saleItem.groupBy` without a time window or index can become slow if the sales table grows to millions of rows. Scoping to `sale: { branchId }` and looking back within relevant windows (e.g., within the last 365 days or batch acquisition date) is required for long-term scalability.

---

## 4. Conclusion

The failures and inaccuracies in Capital Lockup & Aging (Dead Stock Radar) stem from three interconnected flaws:
1. **Worker Thread Serialization & Path Resolution**: `runInWorker` fails under Next.js runtime because of `__dirname` divergence and throws `DataCloneError` when attempting to pass Prisma `Decimal` instances across the thread boundary without sanitization.
2. **Aging Calculation Distortion**: Anchoring inactive stock to `inv.updatedAt` erroneously resets aging whenever an inventory row is updated, reporting 0 dead stock.
3. **Metric Accumulation Coupling**: Filtering `deadItems` by `thresholdDays` improperly zeros out the executive KPI aging distribution breakdown.

### Concrete Recommendations for Implementation

#### 1. Resilient Worker Script Path Resolution
Implement multi-path candidate resolution matching `expiry-orchestrator.ts`:
```typescript
function getAnalyticsWorkerPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'src/lib/inventory/workers/inventory-analytics.worker.js'),
    path.resolve(__dirname, 'workers/inventory-analytics.worker.js'),
    path.resolve(__dirname, 'inventory-analytics.worker.js'),
    path.resolve(process.cwd(), '.next/server/inventory-analytics.worker.js'),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return path.resolve(process.cwd(), 'src/lib/inventory/workers/inventory-analytics.worker.js')
}
```

#### 2. Payload Sanitization Before Thread Transfer
Convert all Prisma `Decimal` instances and `Date` objects to primitives (numbers and ISO strings/timestamps) before `worker.postMessage()`:
```typescript
const sanitizedInventories = inventories.map((inv) => ({
  id: inv.id,
  productId: inv.productId,
  branchId: inv.branchId,
  branchName: inv.branch?.name,
  availableQuantity: inv.availableQuantity,
  createdAt: inv.createdAt ? new Date(inv.createdAt).getTime() : undefined,
  updatedAt: new Date(inv.updatedAt).getTime(),
  product: {
    id: inv.product.id,
    name: inv.product.name,
    sku: inv.product.sku,
    barcode: inv.product.barcode,
    costPrice: inv.product.costPrice ? Number(inv.product.costPrice) : null,
    mrp: inv.product.mrp ? Number(inv.product.mrp) : 0,
    unitOfMeasure: inv.product.unitOfMeasure,
    rack: inv.product.rack,
    batches: inv.product.batches?.map((b) => ({
      batchNumber: b.batchNumber,
      expiryDate: b.expiryDate ? new Date(b.expiryDate).toISOString() : null,
      createdAt: b.createdAt ? new Date(b.createdAt).getTime() : null,
      purchasePrice: b.purchasePrice ? Number(b.purchasePrice) : null,
      supplierName: b.purchase?.supplier?.name,
      supplierId: b.purchase?.supplier?.id,
      supplierRef: b.supplierRef,
    })),
  },
}))
```

#### 3. Corrected Inactivity Time Calculation
In `computeDeadStock`:
```javascript
// Determine true anchor: last sale, last outward movement, or earliest stock acquisition
let lastActivityTime = Math.max(lastSaleTime, lastMovementTime)
if (lastActivityTime === 0) {
  // If never sold or moved, age begins from batch arrival or inventory creation
  const batchArrival = inv.product?.batches?.[0]?.createdAt
  lastActivityTime = batchArrival ? Number(batchArrival) : (inv.createdAt ? Number(inv.createdAt) : Number(inv.updatedAt))
}
```

#### 4. Decoupled Summary Aggregation
In `computeDeadStock`:
Accumulate `slowMovingCount`, `deadStockCount`, `obsoleteCount`, `totalDeadCapitalAtCost`, and `totalDeadCapitalAtMrp` across ALL items with `daysInactive >= 60`, and apply `daysInactive >= thresholdDays` solely to the items pushed into the returned `deadItems` array.

#### 5. Safe Worker Pool or Singleton Execution
Use an in-flight execution guard or persistent worker thread with strict `try/finally` termination:
```typescript
try {
  // execute in worker
} catch (err) {
  if (worker) void worker.terminate()
  // fallback to synchronous computeDeadStock(sanitizedPayload)
}
```

---

## 5. Verification Method

1. **Unit Tests**:
   - Run the inventory analytics unit test suite:
     ```powershell
     npm test -- src/lib/inventory/__tests__/inventory-analytics-service.test.ts
     npm test -- src/app/api/inventory/dead-stock/__tests__/dead-stock-route.test.ts
     ```
   - Add new tests in `inventory-analytics-service.test.ts` verifying:
     - Worker thread execution with payload containing Prisma Decimal instances (verifying serialization).
     - Items with zero sales and zero movements retain correct inactivity days based on batch arrival.
     - Changing `thresholdDays` to 90 does not zero out `slowMovingCount` in the summary object.
2. **Full Project Test Suite**:
   ```powershell
   npm run test:unit
   ```
3. **Invalidation Conditions**:
   - The conclusion is invalidated if `worker.postMessage` natively clones Prisma `Decimal` without conversion on Node.js (proven false by our direct Node test).
   - The conclusion is invalidated if `dead-stock-view.tsx` is completely decoupled from `inventory-analytics.worker.js` (proven false by imports and call graphs).
