# Progress Log - Worker M1

Last visited: 2026-11-03T12:31:00Z
Status: Milestone M1 Complete - 100% Tests Passing & Lint Clean.
Current Step: Step 12 - Handoff Report and Coordination Message

## Completed Objectives
1. Multi-Tier Hybrid Extraction Engine (`src/lib/scanner/purchase-bill-parser.ts`):
   - Tier 1: Digital vector PDF text stream extractor with both `pdf-parse` support and pure-JS FlateDecode/uncompressed stream parser (~15ms).
   - Tier 2: Cloud AI Vision tier via `gemini-2.5-flash` with structured JSON schema when `GEMINI_API_KEY` is present.
   - Tier 3: Local offline OCR fallback with Sharp image normalization and cached Tesseract.js worker with PSM 6.
   - Tier 4: Zero-network deterministic mock fixture engine.
2. Domain Pattern & Tabular Parser (`src/lib/scanner/pharma-invoice-heuristics.ts`):
   - Statutory 15-character GSTIN regex (`\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b`).
   - Drug License Form 20B/21B regex.
   - Invoice number and date parsing.
   - `parsePharmaDate` expiry normalizer handling MM/YY, MM/YYYY, MMM-YY, MMM YYYY, full dates, and leap year days (e.g. Feb 29 for 2028 vs Feb 28 for 2026).
   - Tabular line items extraction (description, pack size, batch number, expiry date, billed quantity, free quantity, PTR, MRP, discount %, GST slabs 0/5/12/18/28).
   - Mathematical cross-reconciliation (Taxable + Tax - Discount ± RoundOff == Grand Total).
3. Entity Resolution Service (`src/lib/scanner/entity-matcher.ts`):
   - Supplier matching: GSTIN (100%) -> DL (95%) -> Trigram name similarity (>=85%).
   - Product matching: Clean dosage/pack abbreviations -> Barcode/SKU match -> Trigram brand similarity (>=85%).
4. Mock Bill Fixtures (`src/lib/scanner/mock-bill-fixtures.ts`):
   - Realistic Indian wholesale pharma invoices (Mahaveer Pharma Agencies, Vardhaman Medisales, Discrepant).
   - Vector PDF buffer generator for digital stream parsing tests.
5. Next.js Scan API Route (`src/app/api/purchases/scan/route.ts`):
   - Multipart form-data validation (presence, allowed MIME types: PDF, JPEG, PNG, WEBP, <=15MB limit).
   - Permission enforcement (`PURCHASES_CREATE`).
   - Coordinated pipeline execution returning standard `ScanBillResponse`.
6. Automated Tests:
   - `src/lib/scanner/__tests__/purchase-bill-parser.test.ts`: 25 passed tests.
   - `src/app/api/purchases/scan/__tests__/scan-routes.test.ts`: 8 passed tests.
   - Total: 33 passed tests, 0 failed, 100% pass rate.
   - ESLint: 0 errors, 0 warnings.
