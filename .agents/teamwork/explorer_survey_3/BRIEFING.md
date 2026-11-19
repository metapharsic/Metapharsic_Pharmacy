# BRIEFING — 2026-11-03T11:59:30Z

## Mission
Investigate and design the document ingestion, OCR, and parsing architecture for Indian pharmacy purchase bills (tax invoices/wholesale distributor invoices) with hybrid text extraction, pattern recognition, fuzzy entity matching, and deterministic testability.

## 🔒 My Identity
- Archetype: Teamwork explorer
- Roles: Document Parsing and OCR Pipeline Explorer
- Working directory: c:\metapharsic-pharmacy-complete\.agents\teamwork\explorer_survey_3
- Original parent: 056deacb-bfc4-49c9-95d1-5d0d88085f22
- Milestone: Explorer Survey

## 🔒 Key Constraints
- Read-only investigation — do NOT implement / do NOT modify application source code
- High architectural precision tailored for Indian pharmacy wholesale invoices (GSTIN, DL, HSN, Batch, Expiry, Pack, Free Qty, Tax rates)
- Address performance, memory, cold-start latency, and Next.js / Node.js runtime environments
- Deterministic test fixtures and CI compatibility

## Current Parent
- Conversation ID: 056deacb-bfc4-49c9-95d1-5d0d88085f22
- Updated: 2026-11-03T11:59:30Z

## Investigation State
- **Explored paths**:
  - `package.json` (sharp 0.33.4, tesseract.js 7.0.0, zod 3.23.8, etc.)
  - `prisma/schema.prisma` (Purchase, PurchaseItem, Supplier, Product, Batch, Inventory, InventoryMovement)
  - `src/lib/purchases/` (`purchase-service.ts`, `purchase-lifecycle-service.ts`, `agency-purchase-service.ts`)
  - `src/lib/validations/purchase.ts` (Zod schemas for purchase, GRN, items)
  - `src/lib/scanner/` (`camera-ocr-service.ts`, `pharma-ocr-engine.ts`, `workers/pharma-scanner.worker.ts`)
  - `src/app/api/inventory/scan/camera-frame/route.ts` (existing Gemini vision + sharp + tesseract pipeline)
  - `src/app/(dashboard)/purchases/new/page.tsx` (purchase order creation UI)
- **Key findings**:
  - `sharp` and `tesseract.js` are already installed; `pdf-parse` should be added for pure-JS digital vector PDF parsing (~30ms vs 15s OCR).
  - Indian wholesale pharma bills (Marg, Busy, Tally) have unique characteristics: 15-char GSTIN, Form 20B/21B DL numbers, multi-format expiry (MM/YY, MM/YYYY, DD/MM/YY, MMM-YY), Billed + Free goods scheme, PTR, MRP, and 0/5/12/18% GST slabs.
  - Formulated a 4-Tier Hybrid Pipeline: Fast Digital PDF (`pdf-parse`) -> Cloud AI Vision (`gemini-2.5-flash`) -> Offline Sharp + Tesseract.js Worker -> Deterministic Mock for CI.
  - Tabular layout parser reconciles line item math against invoice totals.
  - Entity resolution resolves suppliers by GSTIN/DL/Levenshtein and products by SKU/barcode/trigram similarity.
  - Test architecture includes deterministic fixture mocking for 0ms CI execution.
- **Unexplored areas**: None remaining for Explorer 3 survey scope.

## Key Decisions Made
- Multi-tier extraction prioritizes fast digital PDF parsing first before invoking heavy OCR or Vision AI.
- Free quantity must be included in batch creation (`totalQuantity = billedQty + freeQty`) while financial line totals only multiply billed quantity by rate.
- Deterministic mock parser ensures tests do not require external binaries or network calls in CI.

## Artifact Index
- DISPATCH.md — record of incoming dispatch messages
- BRIEFING.md — persistent state and identity
- progress.md — liveness heartbeat
- handoff.md — detailed 5-component deliverable report
