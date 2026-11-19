# Dispatch for Survey Explorer 2: Invoicing, PDF Generation & WhatsApp Sharing

## Mission
Investigate the invoicing and billing generation system in the pharmacy application. Investigate current invoice layouts, formatting, and export methods. Determine how to fix invoice layout/alignment for items, totals, and metadata, and generate clean PDF exports. Investigate WhatsApp sharing options (client-side click-to-chat vs server-side API) for daily, weekly, and monthly reports and invoices. Investigate how invoice PDF processing can run asynchronously or offloaded to worker threads if needed.

## Input Files to Read
- `c:\metapharsic-pharmacy-complete\.agents\teamwork\ORIGINAL_REQUEST.md` (Read the full request, especially the latest follow-up)
- `c:\metapharsic-pharmacy-complete\package.json`
- `c:\metapharsic-pharmacy-complete\PROJECT.md`
- Inspect invoice and billing components and APIs (e.g. `src/components/pos/...`, `src/components/billing/...`, `src/app/api/sales/...`, `src/app/api/billing/...`, `src/lib/pdf/...`, etc.)

## Expected Deliverables
Write your comprehensive survey findings to `c:\metapharsic-pharmacy-complete\.agents\teamwork\survey_explorer_2\handoff.md`.
Include:
1. Current invoice generation and display mechanism in UI and backend (HTML, canvas, print window, PDF libraries installed like `jspdf`, `pdfkit`, `react-pdf`, etc.).
2. Issues with invoice layout/alignment (headers, itemized rows, batch, expiry, quantity, rate, tax/GST, totals, pharmacy metadata).
3. Exact strategy to generate clean, aligned PDF invoices both on the client and/or server.
4. WhatsApp sharing analysis: what options exist (e.g. `https://wa.me/?text=...` with formatted message summaries, document links, or direct API), how to handle both reports (daily/weekly/monthly) and invoices.
5. Asynchronous/background processing considerations for PDF rendering/generation.
6. Exact file paths, interfaces, and test strategies.


## 2026-11-02T13:57:22Z
You are Survey Explorer 2 (teamwork_explorer).
Your working directory is: c:\metapharsic-pharmacy-complete\.agents\teamwork\survey_explorer_2\
Your dispatch instructions are at: c:\metapharsic-pharmacy-complete\.agents\teamwork\survey_explorer_2\DISPATCH.md
MANDATORY: Read the full user request at: c:\metapharsic-pharmacy-complete\.agents\teamwork\ORIGINAL_REQUEST.md before starting work.

Your task:
Investigate the invoicing and billing generation system in the pharmacy application.
Investigate current invoice layouts, formatting, and export methods.
Determine how to fix invoice layout/alignment for items, totals, and metadata, and generate clean PDF exports.
Investigate WhatsApp sharing options (client-side click-to-chat vs server-side API) for daily, weekly, and monthly reports and invoices.
Investigate how invoice PDF processing can run asynchronously or offloaded to worker threads if needed.
Write your detailed findings and architectural recommendations to:
c:\metapharsic-pharmacy-complete\.agents\teamwork\survey_explorer_2\handoff.md
Follow the standard handoff protocol (Observation, Logic Chain, Caveats, Conclusion).
When finished, notify the orchestrator via send_message.


## 2026-11-02T14:09:59Z
**Context**: Invoicing, PDF and WhatsApp sharing survey
**Content**: Checking in on survey progress. Please provide an update on your findings or complete your handoff.md if ready.
**Action**: Update progress.md with your latest findings and send your handoff report when finished.
