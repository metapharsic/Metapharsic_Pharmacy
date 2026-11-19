## 2026-11-02T05:09:48Z
You are teamwork_explorer_pos_unit_pricing.
Your working directory is: c:\metapharsic-pharmacy-complete\.agents\teamwork\teamwork_explorer_pos_unit_pricing\
Parent orchestrator conversation ID: d2cb76ec-dfca-453f-8674-9ed7bea91509

MANDATORY FIRST STEP:
Read the user request at:
c:\metapharsic-pharmacy-complete\.agents\teamwork\ORIGINAL_REQUEST.md
Specifically note the user's latest requirement:
"I want give an option for selling the medicine. at a rate. even desiginig the single tablet rate. so that i can calculate the cost of each tablet and strip and know the profit. when doing the point of sale. how can i achive it. use multi thread to wire the logic to the rest of the app."

MISSION:
Investigate the existing codebase and design a comprehensive technical and architectural blueprint to achieve:
1. Selling medicine at a flexible rate in POS (Point of Sale).
2. Designing single tablet (unit/loose) rate alongside strip (pack) rate.
3. Calculating the cost of each tablet and strip, and calculating real-time profit / profit margin at POS.
4. Using multi-threading (Node.js `worker_threads` / background worker pool) to offload the pricing, tax, cost, and profit computations from the main thread.

INVESTIGATION STEPS:
1. **Schema & Product Data Model**:
   - Inspect `prisma/schema.prisma` for `Product`, `Batch`, `Inventory`, `Sale`, and `SaleItem`.
   - How are `unitOfMeasure`, `packageSize`, `costPrice`, `mrp`, and conversion factors currently handled?
2. **POS Frontend & Cart State**:
   - Inspect `src/lib/stores/pos-cart-store.ts` and `src/components/pos/` (cart items, item addition, pricing, discount, quantity inputs).
   - How are cart lines priced, and how can unit selection (Strip vs Single Tablet) and custom selling rate be introduced into the cart interface?
3. **Multi-Threading / Worker Architecture**:
   - Inspect existing worker patterns in the codebase (`src/lib/db/db-worker-pool.ts`, `src/lib/inventory/workers/inventory-analytics.worker.js`, `src/lib/sales/` or `src/lib/reports/`).
   - How should a dedicated POS Pricing & Profit Worker (`pos-pricing.worker.js` / worker thread bridge) be designed to process line items, tablet/strip conversions, batch cost attributions, and real-time profit calculations asynchronously without blocking the UI thread?
4. **Concrete Blueprint & Recommendations**:
   - Detail the mathematical formulas:
     - Tablet Cost = Strip Cost / Tablets per Strip
     - Strip Profit = (Strip Selling Rate - Strip Cost) * Strip Qty
     - Tablet Profit = (Tablet Selling Rate - Tablet Cost) * Tablet Qty
     - Margin % = (Profit / Selling Revenue) * 100
   - Detail the multi-threaded IPC message protocol (parent <-> worker).
   - Provide concrete file modifications, UI wireframe concepts for POS, and sample code snippets.

Write your comprehensive, structured report to:
c:\metapharsic-pharmacy-complete\.agents\teamwork\teamwork_explorer_pos_unit_pricing\handoff.md
Send a completion message back to parent orchestrator (d2cb76ec-dfca-453f-8674-9ed7bea91509).
