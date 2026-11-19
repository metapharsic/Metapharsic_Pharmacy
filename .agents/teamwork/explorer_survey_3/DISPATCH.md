## 2026-11-03T11:40:14Z
You are Explorer 3 (Document Parsing and OCR Pipeline Explorer).
Your working directory is: c:\metapharsic-pharmacy-complete\.agents\teamwork\explorer_survey_3\
You MUST read the authoritative user request at: c:\metapharsic-pharmacy-complete\.agents\teamwork\ORIGINAL_REQUEST.md

Scope and Boundaries:
- READ-ONLY exploration. Do NOT modify any application source code.
- Investigate document ingestion, OCR, and parsing options in the project:
  1. Inspect `package.json` to see existing dependencies (e.g. `pdf-parse`, `tesseract.js`, `sharp`, `canvas`, `jspdf`, `xlsx`, etc.).
  2. Evaluate optimal OCR & document parsing strategy for Indian pharmacy purchase bills (tax invoices / wholesale distributor invoices):
     - Support for PDF documents (digital/text PDFs as well as scanned image PDFs) and image formats (JPEG, PNG).
     - OCR engine options in Node.js / Next.js (e.g. `tesseract.js`, `pdf-parse`, or hybrid multi-strategy parser).
     - Performance, memory, worker thread offloading, cold-start latency, dependency footprints.
  3. Formulate the parsing pipeline architecture:
     - Document Ingestion: API endpoint (`POST /api/purchases/scan` or similar) accepting `multipart/form-data` with size/type validation.
     - Text Extraction Layer: Hybrid strategy (fast direct PDF text extraction when embedded text is present; OCR fallback for scanned images or rasterized PDFs).
     - Pattern Recognition & Regex/Heuristic Parser:
       * Header extraction: Supplier name, GSTIN, DL number, invoice number, invoice date, due date.
       * Table line item extraction: medicine name, pack size, batch number, expiry date (various formats: MM/YY, MM/YYYY, DD/MM/YY), quantity, free quantity, MRP, purchase rate, discount %, taxable value, CGST %, SGST %, IGST %, net amount.
       * Totals extraction: subtotal, total GST, discount, round-off, grand total.
     - Fuzzy Matching & Entity Resolution: matching extracted medicine names to existing inventory products in the database, and matching supplier names to existing suppliers.
     - Confidence Scoring & Fallback handling: flagging low-confidence fields for mandatory user verification.
  4. Testability and Verification Plan:
     - How to write comprehensive automated unit/integration tests with fixture documents (sample invoice PDFs and images).
     - Deterministic mock parsing engine for CI/test environments to ensure fast, reliable test execution without flaky external binary issues.

Deliverable:
- Write your comprehensive, detailed findings and pipeline architecture into `c:\metapharsic-pharmacy-complete\.agents\teamwork\explorer_survey_3\handoff.md`.
- Include recommended libraries, parsing algorithms/heuristics, endpoint signatures, data schemas, and test architecture.
- When finished, send a completion message with summary to your caller.

## 2026-11-03T11:57:45Z
**Context**: Survey exploration for Document OCR and Parsing Pipeline.
**Content**: Checking on your progress. How is the investigation into OCR engines, PDF text extraction, invoice heuristics, fuzzy matching, and test strategies proceeding?
**Action**: Please update your `progress.md` with current findings and let me know your estimated completion time or if you need any assistance.

