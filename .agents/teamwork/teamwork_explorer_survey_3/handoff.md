# Architecture, Concurrency, and Test Suite Survey Handoff Report

## 1. Observation

### 1.1 Project Type, Framework, Language & Dependencies
- **Project Root**: `c:\metapharsic-pharmacy-complete`
- **Application**: Enterprise Pharmaceutical Management System ("PharmaCare" / "MPharm").
- **Language**: TypeScript `^5.5.4` on Node.js runtime (`package.json:139`).
- **Core Framework**: Next.js `14.2.5` using the App Router (`src/app/`) and React `^18.3.1` (`package.json:82, 89`).
- **Database & ORM**: PostgreSQL via Prisma `^5.17.0` (`@prisma/client` and `prisma` CLI in `package.json:41, 134`). Database configuration in `.env:13`:
  ```
  DATABASE_URL="postgresql://postgres:postgres@localhost:5432/pharmacare_dev?schema=public"
  SHADOW_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/pharmacare_shadow?schema=public"
  ```
- **Prisma Client Singleton**: `src/lib/db/prisma.ts` exports both `export const prisma` and `export default prisma` with global caching in development.
- **State Management**:
  - TanStack React Query `@tanstack/react-query` `^5.51.23` (`package.json:66`)
  - Zustand `^4.5.4` (`package.json:101`, e.g., `src/lib/stores/pos-cart-store.ts`)
  - React local component state (`useState`, `useCallback`, `useEffect`)
- **UI & Styling**: Tailwind CSS `^3.4.7`, Radix UI primitives (`@radix-ui/react-*`), Lucide React `^0.414.0`, Sonner `^1.5.0` (`package.json:42-65, 80, 96, 135`).
- **Build & Dev Scripts** (`package.json:5-37`):
  - Dev server: `npm run dev` (`next dev -p 5888`)
  - Production build: `npm run build` (`next build`)
  - Type checking: `npm run type-check` (`tsc --noEmit`)
  - Database schema push/migrate: `npm run db:push` / `npm run db:migrate`

### 1.2 Multi-Threading & Concurrency Architecture
The application employs a hybrid concurrency model across backend and frontend:

1. **Backend Offloaded Multi-Threading (Node.js `worker_threads`)**:
   - Heavy CPU analytical algorithms are offloaded to Node.js Worker Threads via `worker_threads` (`Worker`, `parentPort`).
   - Primary Worker for Inventory: `src/lib/inventory/workers/inventory-analytics.worker.js` (872 lines):
     - Line 8: `const { parentPort } = require('worker_threads')`
     - Implements commands: `ANALYZE_DEAD_STOCK`, `ANALYZE_VENDOR_STOCK`, `ANALYZE_LOCATION_MATRIX`, `ANALYZE_ADJUSTMENTS`, `ANALYZE_MOVEMENTS`, `ANALYZE_BATCHES`.
     - Lines 828-860: `parentPort.on('message', ...)` handles incoming task IDs, executes pure calculation functions (`computeDeadStock`, etc.), and posts `{ id, success, data }` back.
   - Dispatcher / Bridge Pattern: `src/lib/inventory/inventory-analytics-service.ts`:
     - Lines 192-268 (`runInWorker`): Checks `process.env.NODE_ENV === 'test'`. In test environments, runs pure algorithm synchronously. In production/development, launches `new Worker(workerPath)` with a 5000ms timeout watchdog, message/error listeners, termination on completion (`worker.terminate()`), and resilient synchronous fallback on worker failures.
   - Persistent Worker Pool Pattern: `src/lib/db/db-worker-pool.ts`:
     - `DbWorkerPool` manages a pool of 4 background worker threads executing parallel domain queries (`INVENTORY`, `COMMERCE`, `FINANCE`, `CLINICAL`, `EXPIRY`) with fallback to `executeInProcessFallback`.
   - Other workers:
     - `src/lib/reports/workers/reporting-analytics.worker.js` & `src/lib/reports/reporting-worker-bridge.ts`
     - `src/lib/scanner/workers/pharma-scanner.worker.ts` & `src/lib/scanner/worker-scanner-client.ts`
     - `src/lib/purchases/workers/purchase-analytics.worker.js`
     - `src/lib/settings/workers/settings-users-audit.worker.js`

2. **Database Concurrency & I/O Parallelism**:
   - Non-blocking I/O queries are executed concurrently using `Promise.all`:
     - `src/lib/inventory/inventory-analytics-service.ts:282`:
       ```ts
       const [inventories, sales, movements] = await Promise.all([
         prisma.inventory.findMany(...),
         prisma.saleItem.groupBy(...),
         prisma.inventoryMovement.groupBy(...)
       ])
       ```
     - `src/lib/inventory/inventory-service.ts:360-444`: 8 parallel queries (`invAgg`, `inventoriesForLowStock`, `outOfStockCount`, `activeBatches`, `nearExpiryBatchesCount`, `expiredBatchesCount`, `pendingAdjustmentsCount`, `deadStockCount`).

3. **Frontend / UI Concurrency**:
   - Next.js Server Components (`src/app/(dashboard)/inventory/page.tsx`) perform initial asynchronous data hydration via `Promise.all([can(...), getSession(), getInventory(...), getInventorySummary(...)])`.
   - Client Component `DeadStockView` (`src/components/inventory/dead-stock-view.tsx:65-85`) performs client-side data fetching via `useCallback` + `useEffect` with non-blocking UI rendering (`loading` state with skeleton loaders `Skeleton`, error handling via `useToast().error(...)`).

### 1.3 Dead Stock Radar & Capital Lockup & Aging Architecture
- **Tab Integration**: `src/components/inventory/inventory-lifecycle-tabs.tsx:61-67`:
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
- **Overview Container**: `src/components/inventory/inventory-overview.tsx:832-835`:
  ```tsx
  {/* ─── TAB 3: DEAD STOCK & CAPITAL LOCKUP RADAR ───────── */}
  <TabsContent value="dead_stock" className="focus-visible:outline-none">
    <DeadStockView branchId={branchId} />
  </TabsContent>
  ```
- **Client Component**: `src/components/inventory/dead-stock-view.tsx`:
  - Fetches `/api/inventory/dead-stock?branchId=...&thresholdDays=...` (lines 72-84).
  - Toast error triggers on failure:
    - Line 77: `toast.error('Failed to load dead stock report')`
    - Line 80: `toast.error('Network error loading dead stock')`
  - Displays 3 Executive KPI cards:
    1. *Locked Working Capital*: Total locked capital at cost (`formatCurrency(s.totalDeadCapitalAtCost)`), total SKUs, retail MRP value.
    2. *Aging Breakdown*: Dead stock count in 90-180d bracket, slow moving count (60-90d), obsolete dormant count (>180d).
    3. *Chemist Recommendation & Actions*: Export CSV return statement, 1-click POS clearance dispense (`handleDispenseToPos`).
- **API Route**: `src/app/api/inventory/dead-stock/route.ts`:
  - `GET(req: NextRequest)` enforces `PERMISSIONS.INVENTORY_READ`, resolves branch scope via `resolveBranchScope(user, rawBranchId)`, parses `thresholdDays`, calls `getDeadStockReport(...)`.
- **Worker Calculation Algorithm**: `src/lib/inventory/workers/inventory-analytics.worker.js:26-104` (`computeDeadStock`):
  - Formulas:
    - `lastActivityTime = Math.max(lastSaleTime, lastMovementTime, new Date(inv.updatedAt).getTime())`
    - `daysInactive = Math.max(0, Math.floor((now - lastActivityTime) / (1000 * 60 * 60 * 24)))`
    - `costPrice = Number(inv.product.costPrice) || (Number(inv.product.mrp) * 0.7) || 0`
    - `capitalLockedAtCost = Math.round(costPrice * inv.availableQuantity * 100) / 100`
    - `capitalLockedAtMrp = Math.round(mrp * inv.availableQuantity * 100) / 100`
    - Aging brackets: `daysInactive >= 180` -> `OBSOLETE`; `>= 90` -> `DEAD_STOCK`; `>= 60` -> `SLOW_MOVING`; `< 60` -> `HEALTHY`.
    - Filters items where `daysInactive >= thresholdDays`, calculates totals, and sorts descending by `capitalLockedAtCost`.

### 1.4 Existing Test Suites, Runners & Verification Commands
- **Test Runner**: Jest `29.7.0` configured via `jest.config.js`:
  - Splits tests into two distinct projects:
    1. `unit`:
       - `testMatch`: `['**/__tests__/**/*.test.(ts|tsx)', '**/*.test.(ts|tsx)']`
       - `testPathIgnorePatterns`: `['.*\\.integration\\.test\\.ts$']`
       - Default environment: `jsdom` (can be overridden via `/** @jest-environment node */`).
       - Setup file: `jest.setup.ts`.
    2. `integration`:
       - `testMatch`: `['**/*.integration.test.ts']`
       - Runs with `--runInBand`.
       - Connects to PostgreSQL at `localhost:5435` via `process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://pharmacy:pharmacy@localhost:5435/pharmacare?schema=pharma_test'`.
- **Current Test Execution Results Observed**:
  - `npm run test:unit`:
    - Total test suites: 96 total (92 passed, 4 failed).
    - Total tests: 721 total (716 passed, 5 failed). Total run time: ~14.7 seconds.
    - Specific passing unit test suites observed:
      - `src/app/api/inventory/dead-stock/__tests__/dead-stock-route.test.ts` (PASS, 2 tests passed)
      - `src/lib/inventory/__tests__/inventory-analytics-service.test.ts` (PASS, 3 tests passed)
      - `src/lib/db/db-worker-pool.test.ts` (PASS)
      - `src/lib/batches/expiry/expiry-spawner.test.ts` (PASS)
  - `npm run test:integration`:
    - 4 test suites (`expiry.integration.test.ts`, `purchase-service.integration.test.ts`, `report-service.integration.test.ts`, `sales-service.integration.test.ts`).
    - Exits with `PrismaClientInitializationError: Can't reach database server at localhost:5435` because integration tests require a live test database container.
  - Targeted unit test execution command:
    - `npx jest src/app/api/inventory/dead-stock/__tests__/dead-stock-route.test.ts` (PASS in 0.6s)
    - `npx jest src/lib/inventory/__tests__/inventory-analytics-service.test.ts` (PASS in 0.5s)

---

## 2. Logic Chain

1. **Step 1: Tracing the User Failure Mode ("failed to load the dead stock")**
   - User report: "loading fails with 'failed to load the dead stock'".
   - In `src/components/inventory/dead-stock-view.tsx:77`, `loadDeadStock` catches errors or unsuccessful responses from `/api/inventory/dead-stock` and triggers `toast.error('Failed to load dead stock report')` or `toast.error('Network error loading dead stock')`.
   - The route `/api/inventory/dead-stock/route.ts` forwards requests to `getDeadStockReport(...)` in `src/lib/inventory/inventory-analytics-service.ts`.

2. **Step 2: Inspecting Worker Path Resolution & Execution in Next.js Bundler**
   - In `src/lib/inventory/inventory-analytics-service.ts:207`:
     `const workerPath = path.resolve(__dirname, 'workers/inventory-analytics.worker.js')`
     `const worker = new Worker(workerPath)`
   - In Next.js App Router server runtime, API routes are bundled into chunks (e.g. `.next/server/app/api/...`), where `__dirname` resolves to the `.next/` directory instead of `src/lib/inventory/`.
   - Unlike `src/lib/db/db-worker-pool.ts` (which checks `process.cwd()` and multiple candidate locations in `resolveWorkerScriptPath`), `inventory-analytics-service.ts` uses only a naive `path.resolve(__dirname, ...)`.
   - When the worker file cannot be found by Node.js `Worker`, it raises `MODULE_NOT_FOUND` or unhandled worker errors. If the fallback also fails or times out (5000ms watchdog), the Promise rejects, `/api/inventory/dead-stock` returns HTTP 500 (`{ success: false, error: ... }`), and `DeadStockView` displays the error toast.

3. **Step 3: Inspecting Data Model Relations and Batch Supplier Attribution**
   - In `src/lib/inventory/inventory-analytics-service.ts:289-307`:
     ```ts
     batches: {
       where: { status: 'ACTIVE', quantity: { gt: 0 } },
       take: 1,
       orderBy: { createdAt: 'desc' },
       include: {
         purchase: { select: { supplier: { select: { id: true, name: true } } } },
       },
     }
     ```
   - In `prisma/schema.prisma:500-535`, model `Batch` does not have a direct `supplier` relation; `supplier` is attached to `Purchase` (`purchase.supplier`).
   - In `src/lib/inventory/workers/inventory-analytics.worker.js:82`:
     `supplierName: inv.product.batches?.[0]?.supplier?.name || inv.product.batches?.[0]?.supplierRef || 'Direct / Primary'`
     `supplierId: inv.product.batches?.[0]?.supplierId || null`
   - Notice `inv.product.batches[0].supplier` is undefined! The code ignores `batches[0].purchase?.supplier`, resulting in vendor attribution fallback to `'Direct / Primary'` and `supplierId = null`, degrading Capital Lockup vendor reporting.

4. **Step 4: Inspecting Physical Storage Location Formatting (Rack, Shelf, Box)**
   - In `prisma/schema.prisma:300-356`, model `Product` has `rackId String?` and `rack Rack?`. It does NOT have a direct `shelf` or `box` field.
   - `model Rack` has `code` and `shelfNumber`.
   - `computeDeadStock` relies on `getRackCode(inv.product.rack)` and `getShelfNumber(inv.product.rack, inv.product.shelf)`.
   - For `box`, `inv.product.box` is undefined unless parsed from `rack.description` (which contains `${code} › ${shelfNumber} › ${cleanBox}` per `updateProductLocation`) or correlated with `StorageLocation`.

5. **Step 5: Inspecting Test Suite Coverage and Gaps**
   - Existing unit test `src/app/api/inventory/dead-stock/__tests__/dead-stock-route.test.ts` mocks `getDeadStockReport` completely.
   - Existing worker test `src/lib/inventory/__tests__/inventory-analytics-service.test.ts` tests only `computeDeadStock` directly in-memory.
   - **Crucial Gap**: There are zero tests covering `getDeadStockReport()` in `inventory-analytics-service.ts` (neither unit tests with mocked Prisma nor integration tests), and zero component tests for `DeadStockView` (`dead-stock-view.test.tsx`).

---

## 3. Caveats

1. **Test Database Dependency for Integration Tests**:
   - `npm run test:integration` strictly requires a live Postgres instance on `localhost:5435/pharmacare?schema=pharma_test`. Running `npm run test:integration` without this service running fails at the Prisma connection layer.
   - Unit tests (`npm run test:unit`) do not require the Postgres service and execute in under 15 seconds.
2. **Read-Only Explorer Scope**:
   - As an explorer agent, no production or test source files were modified. The findings and test patterns documented below provide the actionable blueprint for the implementer agent.
3. **Branch Scoping**:
   - When `branchId === 'all'` or `undefined`, the API resolves the user's assigned branch or allows cross-branch access if the user has multi-branch privileges (`resolveBranchScope`).

---

## 4. Conclusion

1. **Stack & Tooling**:
   - Next.js 14.2.5 (App Router), React 18.3.1, TypeScript 5.5.4, Prisma 5.17.0, Jest 29.7.0 (`ts-jest`), Tailwind CSS 3.4.7.
   - Test suites split into `unit` (`npm run test:unit`) and `integration` (`npm run test:integration`).
2. **Concurrency Architecture**:
   - Asynchronous Prisma queries run concurrently via `Promise.all`.
   - Heavy analysis is dispatched to Node.js `worker_threads` via `runInWorker` (`inventory-analytics.worker.js`) with resilient synchronous in-process fallback.
   - React UI uses asynchronous `useCallback` + `useEffect` fetch with skeleton loading.
3. **Root Cause of Loading Failure in Dead Stock Radar**:
   - Worker script path resolution vulnerability in Next.js bundled runtime (`__dirname` resolving to `.next/` chunk paths instead of project root).
   - Missing resilient script path resolution like `DbWorkerPool` (`process.cwd()` candidate checks).
   - Inaccurate supplier relation navigation (`batches[0].purchase.supplier` vs `batches[0].supplier`).
   - Lack of error boundary / status inspection in client `dead-stock-view.tsx` when API errors occur.
4. **Actionable Implementation Blueprint**:
   - **Fix 1**: Implement robust worker path resolution in `src/lib/inventory/inventory-analytics-service.ts` checking candidate paths:
     - `resolve(__dirname, 'workers/inventory-analytics.worker.js')`
     - `resolve(process.cwd(), 'src/lib/inventory/workers/inventory-analytics.worker.js')`
     - `resolve(process.cwd(), '.next/server/chunks/inventory-analytics.worker.js')`
   - **Fix 2**: Fix batch supplier extraction in `inventory-analytics.worker.js` and `inventory-analytics-service.ts` to read `inv.product.batches?.[0]?.purchase?.supplier?.name`.
   - **Fix 3**: Add resilient error handling and status checks in `dead-stock-view.tsx` (`if (!res.ok) throw new Error(...)`).
   - **Fix 4**: Add comprehensive automated tests:
     - Unit tests for `getDeadStockReport` in `src/lib/inventory/__tests__/inventory-analytics-service.test.ts`.
     - React testing library component test for `DeadStockView` in `src/components/inventory/__tests__/dead-stock-view.test.tsx`.
     - API route tests in `src/app/api/inventory/dead-stock/__tests__/dead-stock-route.test.ts`.

---

## 5. Verification Method

### 5.1 Test Execution Commands
The implementer agent can independently verify the testing infrastructure and dead stock logic with these commands:

1. **Run Unit Tests for Inventory Dead Stock Route**:
   ```powershell
   npx jest src/app/api/inventory/dead-stock/__tests__/dead-stock-route.test.ts
   ```
   *Expected Result*: Exits 0, 2 passed.

2. **Run Unit Tests for Inventory Analytics Service & Worker**:
   ```powershell
   npx jest src/lib/inventory/__tests__/inventory-analytics-service.test.ts
   ```
   *Expected Result*: Exits 0, all calculation tests pass.

3. **Run All Unit Tests**:
   ```powershell
   npm run test:unit
   ```
   *Expected Result*: Executes the 96 unit test suites in ~15 seconds.

4. **Run Integration Tests (when local test DB container is active)**:
   ```powershell
   npm run test:integration
   ```

### 5.2 Test Templates & Patterns for Implementer

#### Pattern 1: Service Unit Test with Mocked Prisma (`src/lib/inventory/__tests__/inventory-analytics-service.test.ts`)
```ts
/** @jest-environment node */
import prisma from '@/lib/db/prisma'
import { getDeadStockReport } from '../inventory-analytics-service'

jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  default: {
    inventory: { findMany: jest.fn() },
    saleItem: { groupBy: jest.fn() },
    inventoryMovement: { groupBy: jest.fn() },
  },
}))

describe('getDeadStockReport service', () => {
  it('correctly fetches inventories, groups sales and movements, and returns dead stock metrics', async () => {
    const mockInventories = [
      {
        id: 'inv-1',
        productId: 'prod-1',
        availableQuantity: 20,
        updatedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
        product: {
          id: 'prod-1',
          name: 'Amoxicillin 500mg',
          sku: 'AMX-500',
          costPrice: 50,
          mrp: 80,
          unitOfMeasure: 'Strip',
          rack: { code: 'RACK-A', shelfNumber: 'S1', description: 'RACK-A › S1 › Box 01' },
          batches: [
            {
              batchNumber: 'B101',
              expiryDate: new Date('2027-01-01'),
              purchase: { supplier: { id: 'sup-1', name: 'Cipla Healthcare' } },
            },
          ],
        },
        branch: { id: 'br-1', name: 'Main Branch' },
      },
    ]

    ;(prisma.inventory.findMany as jest.Mock).mockResolvedValueOnce(mockInventories)
    ;(prisma.saleItem.groupBy as jest.Mock).mockResolvedValueOnce([])
    ;(prisma.inventoryMovement.groupBy as jest.Mock).mockResolvedValueOnce([])

    const result = await getDeadStockReport({ branchId: 'br-1', thresholdDays: 60 })

    expect(result.summary.totalDeadItemsCount).toBe(1)
    expect(result.summary.totalDeadCapitalAtCost).toBe(1000) // 20 * 50
    expect(result.summary.totalDeadCapitalAtMrp).toBe(1600)  // 20 * 80
    expect(result.deadItems[0].supplierName).toBe('Cipla Healthcare')
  })
})
```

#### Pattern 2: Component Test for `DeadStockView` (`src/components/inventory/__tests__/dead-stock-view.test.tsx`)
```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { DeadStockView } from '../dead-stock-view'

global.fetch = jest.fn()

describe('DeadStockView Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders dead stock KPI cards and table rows when data loads successfully', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          deadItems: [
            {
              inventoryId: 'inv-1',
              productId: 'p-1',
              productName: 'Cetirizine 10mg',
              sku: 'CET-10',
              rack: 'RACK-B',
              shelf: 'S2',
              box: 'Box 03',
              supplierName: 'Sun Pharma',
              daysInactive: 120,
              status: 'DEAD_STOCK',
              availableQuantity: 50,
              unitOfMeasure: 'Strip',
              costPrice: 20,
              mrp: 35,
              capitalLockedAtCost: 1000,
              capitalLockedAtMrp: 1750,
            },
          ],
          summary: {
            totalDeadItemsCount: 1,
            totalDeadCapitalAtCost: 1000,
            totalDeadCapitalAtMrp: 1750,
            slowMovingCount: 0,
            deadStockCount: 1,
            obsoleteCount: 0,
          },
        },
      }),
    })

    render(<DeadStockView branchId="br-1" />)

    await waitFor(() => {
      expect(screen.getByText('Cetirizine 10mg')).toBeInTheDocument()
      expect(screen.getByText('Locked Working Capital')).toBeInTheDocument()
      expect(screen.getByText('Sun Pharma')).toBeInTheDocument()
    })
  })
})
```
