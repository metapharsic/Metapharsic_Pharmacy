# Dispatch for Worker M3: WhatsApp Sharing for Reports & Invoices

## Mission
Implement Milestone 3 (M3) per `PROJECT.md` to satisfy Requirement R3:
1. Create `src/components/sales/whatsapp-invoice-dialog.tsx`:
   - Props: `{ open: boolean; onOpenChange: (open: boolean) => void; sale: any }`.
   - Pre-fills recipient phone number from `sale.customer?.phone || sale.customerPhone || ''`.
   - Generates cleanly formatted WhatsApp Markdown invoice text:
     ```
     🏥 *METAPHARSIC PHARMACARE*
     🧾 *TAX INVOICE: ${invoiceNumber}*
     📅 Date: ${date}
     👤 Patient: ${customerName}
     ━━━━━━━━━━━━━━━━━━━━
     ${itemsSummary}
     ━━━━━━━━━━━━━━━━━━━━
     💰 *Net Payable: ₹${totalAmount}*
     💳 Payment: ${paymentMethod}
     📄 *Download Official Tax Invoice PDF:*
     ${pdfLink}
     ━━━━━━━━━━━━━━━━━━━━
     Thank you! Wishing you a speedy recovery!
     ```
   - 1-Click "Open WhatsApp Web / App" (`wa.me`) using `generateWaMeLink` from `@/lib/whatsapp/whatsapp-service`.
   - Optional "Send via WhatsApp API" button using server-side endpoint or `WhatsAppService`.
2. Connect WhatsApp invoice sharing into UI:
   - `src/components/sales/sale-invoice-dialog.tsx`: Add "Share on WhatsApp" button triggering `WhatsAppInvoiceDialog`.
   - `src/app/(dashboard)/sales/[id]/sale-action-buttons.tsx`: Add "Share on WhatsApp" button.
3. Create `src/lib/reports/executive-digest-service.ts`:
   - Formats Daily, Weekly, and Monthly WhatsApp summaries with financial metrics (Revenue, Gross Profit, Bill Count, Average Bill Value, Top 5 Medicines).
   - Functions: `generateDailyDigestText(branchId, date)`, `generateWeeklyDigestText(branchId, date)`, `generateMonthlyDigestText(branchId, date)`.
   - Extend `src/app/api/reports/daily-closing/whatsapp/route.ts` to support `?period=daily|weekly|monthly`.
4. Connect WhatsApp report sharing into UI:
   - In `src/components/reports/reports-hub-client.tsx`: Add "Share via WhatsApp" button on Daily, Weekly, and Monthly report tabs, opening a modal or launching `wa.me` with the formatted executive report summary.
5. Write automated unit tests:
   - `src/lib/reports/__tests__/executive-digest-service.test.ts`: Verify daily, weekly, monthly report summaries, phone normalization, and wa.me deep links.
   Run tests using Jest and ensure all pass cleanly.

## Exclusive Write Ownership
You own:
- `src/components/sales/whatsapp-invoice-dialog.tsx`
- `src/lib/reports/executive-digest-service.ts`
- `src/app/api/reports/daily-closing/whatsapp/route.ts`
- `src/components/reports/reports-hub-client.tsx`
- `src/components/sales/sale-invoice-dialog.tsx`
- `src/app/(dashboard)/sales/[id]/sale-action-buttons.tsx`
- `src/lib/reports/__tests__/executive-digest-service.test.ts`

## Context & Input Files
- Read `c:\metapharsic-pharmacy-complete\.agents\teamwork\ORIGINAL_REQUEST.md`
- Read `c:\metapharsic-pharmacy-complete\PROJECT.md`
- Read `c:\metapharsic-pharmacy-complete\.agents\teamwork\survey_explorer_2\handoff.md`
- Check `src/lib/whatsapp/whatsapp-service.ts` and `src/lib/reports/daily-closing-digest-service.ts`

## MANDATORY INTEGRITY WARNING
> DO NOT CHEAT. All implementations must be genuine. DO NOT
> hardcode test results, create dummy/facade implementations, or
> circumvent the intended task. A teamwork_auditor will independently
> verify your work. Integrity violations WILL be detected and your
> work WILL be rejected.

## Deliverables & Handoff
Write your completion report to `c:\metapharsic-pharmacy-complete\.agents\teamwork\teamwork_worker_m3_whatsapp\handoff.md` following standard handoff protocol with exact test execution commands and results.
When finished, notify the orchestrator via send_message.


## 2026-11-02T14:40:06Z
Received dispatch message:
You are Worker M3 (teamwork_worker).
Your working directory is: c:\metapharsic-pharmacy-complete\.agents\teamwork\teamwork_worker_m3_whatsapp\
Your dispatch instructions are at: c:\metapharsic-pharmacy-complete\.agents\teamwork\teamwork_worker_m3_whatsapp\DISPATCH.md
MANDATORY: Read the full user request at: c:\metapharsic-pharmacy-complete\.agents\teamwork\ORIGINAL_REQUEST.md before starting work.
Read PROJECT.md at: c:\metapharsic-pharmacy-complete\PROJECT.md
Read Explorer 2's survey at: c:\metapharsic-pharmacy-complete\.agents\teamwork\survey_explorer_2\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT
hardcode test results, create dummy/facade implementations, or
circumvent the intended task. A teamwork_auditor will independently
verify your work. Integrity violations WILL be detected and your
work WILL be rejected.

Your task:
Implement Milestone 3: WhatsApp Sharing for Reports & Invoices (Requirement R3):
1. Create src/components/sales/whatsapp-invoice-dialog.tsx: pre-fill phone, format Markdown invoice summary with direct PDF link, 1-click wa.me chat and optional API dispatch.
2. Hook WhatsApp invoice sharing into sale-invoice-dialog.tsx and sale-action-buttons.tsx.
3. Create src/lib/reports/executive-digest-service.ts: Daily, Weekly, and Monthly WhatsApp summaries with financial metrics and top medicines.
4. Update src/app/api/reports/daily-closing/whatsapp/route.ts to support period query (daily|weekly|monthly).
5. Add WhatsApp report share action buttons in reports-hub-client.tsx on Daily, Weekly, and Monthly tabs.
6. Write unit tests in src/lib/reports/__tests__/executive-digest-service.test.ts, run them with Jest and ensure all pass.

Write your completion report to:
c:\metapharsic-pharmacy-complete\.agents\teamwork\teamwork_worker_m3_whatsapp\handoff.md
Follow the standard handoff protocol with exact test execution commands and results.
When finished, notify the orchestrator via send_message.


## 2026-11-02T15:02:17Z
[Message] sender=187f8d67-d727-46bd-b8d9-ecaeff8b88d3 priority=MESSAGE_PRIORITY_HIGH
**Context**: Milestone 3 WhatsApp Sharing Implementation
**Content**: Checking in on final handoff report. All tests are passing and the other milestones are ready. Please finalize your handoff.md and send completion message.
**Action**: Write handoff.md and send completion message.
