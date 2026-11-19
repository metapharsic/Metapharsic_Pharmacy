# BRIEFING — 2026-11-02T05:25:00Z

## Mission
Investigate codebase and design technical & architectural blueprint for POS unit & strip flexible pricing, unit/strip cost calculation, real-time profit tracking, and multi-threaded worker offloading.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: c:\metapharsic-pharmacy-complete\.agents\teamwork\teamwork_explorer_pos_unit_pricing\
- Original parent: d2cb76ec-dfca-453f-8674-9ed7bea91509
- Milestone: POS Unit Pricing, Cost/Profit & Multi-Threaded Engine Design

## 🔒 Key Constraints
- Read-only investigation — do NOT implement directly in source code
- Produce self-contained handoff.md report with 5 components
- Propose precise architecture, math formulas, schemas, worker pool IPC protocols, UI wireframes, and implementation roadmap

## Current Parent
- Conversation ID: d2cb76ec-dfca-453f-8674-9ed7bea91509
- Updated: 2026-11-02T05:25:00Z

## Investigation State
- **Explored paths**:
  - `prisma/schema.prisma` (Product, Batch, Inventory, Sale, SaleItem)
  - `src/lib/sales/pricing.ts` & `src/lib/sales/pricing.test.ts`
  - `src/lib/sales/sales-service.ts` & `src/lib/validations/sale.ts`
  - `src/lib/stores/pos-cart-store.ts` & `pos2-cart-store.ts`
  - `src/components/pos/formats/billing-types.ts` & `format-1-inline-grid.tsx`
  - `src/components/pos/pos-client.tsx`
  - `src/lib/db/db-worker-pool.ts`
  - `src/lib/inventory/workers/inventory-analytics.worker.js`
  - `src/lib/reports/reporting-worker-bridge.ts`
  - `scripts/multithreaded_wire_sales_profit_and_whatsapp_eod.ts`
- **Key findings**:
  - `pricing.ts` already has proven math functions `computeItemProfit` and `computeSaleProfit` that pro-rate tablet cost `purchasePrice / tabsPerStrip`.
  - In `format-1-inline-grid.tsx` and other POS formats, the MRP/Rate column is rendered as static text `<div>₹{line.mrp}</div>`, preventing pharmacists from editing selling rates directly.
  - Tablets are currently only calculated as `mrp / tabsPerStrip`; there is no option to "design" single tablet rate with a loose markup or set an independent single tablet rate.
  - Neither line profit/margin nor overall cart profit/margin are displayed in the POS cart interface.
  - In `sales-service.ts`, loose tablet stock deduction incorrectly subtracts `quantity` (in tablets) directly from `inventory.availableQuantity` (in strips).
  - Multiple established patterns for Node.js `worker_threads` exist with JSON IPC messages (`{ id, command, payload }`) and synchronous fallbacks.
- **Unexplored areas**: None for this investigation phase.

## Key Decisions Made
- Architecture blueprint formulated with a 4-tier design: Schema Enhancements, Mathematical Pricing & Profit Engine, Multi-Threaded Worker Pool IPC Bridge, and POS Frontend UI enhancements with interactive Rate Editing and Single Tablet Rate Designer.

## Artifact Index
- c:\metapharsic-pharmacy-complete\.agents\teamwork\teamwork_explorer_pos_unit_pricing\DISPATCH.md — Dispatch instructions
- c:\metapharsic-pharmacy-complete\.agents\teamwork\teamwork_explorer_pos_unit_pricing\BRIEFING.md — Situational awareness
- c:\metapharsic-pharmacy-complete\.agents\teamwork\teamwork_explorer_pos_unit_pricing\progress.md — Heartbeat and progress log
- c:\metapharsic-pharmacy-complete\.agents\teamwork\teamwork_explorer_pos_unit_pricing\handoff.md — Final deliverable report
