# Dispatch Record

## 2026-11-02T13:55:21Z
Enhance the pharmacy application in production by adding Excel exports for daily, weekly, and monthly reports, fixing invoice formatting with PDF export, enabling WhatsApp report and invoice sharing, adding administrative bill modification and deletion with inventory reversal, and optimizing heavy background operations.

Working directory: c:\metapharsic-pharmacy-complete
Integrity mode: development

## Requirements

### R1. Excel Report Exports
- Export daily, weekly, and monthly reports in Excel format (.xlsx) with clean alignment and structure.
- No reports must be generated or exported in XML format; all report downloads must be Excel files.

### R2. Invoicing Layout and PDF Generation
- Fix invoice layout and formatting to ensure proper alignment of all items, totals, and metadata.
- Generate and export all invoices in PDF format.

### R3. WhatsApp Sharing
- Provide functionality to share or send daily, weekly, and monthly reports as well as invoices via WhatsApp.
- Implementation approach (direct WhatsApp API integration or client-side click-to-chat sharing) is determined based on available configuration and dependencies.

### R4. Admin Bill Modification and Deletion
- Provide administrators with options to modify and delete bills.
- Bill deletion or modification must use soft deletion / cancellation, revert inventory stock levels accordingly, and record audit log entries.

### R5. Asynchronous / Background Processing
- Ensure heavy report generation and invoice processing run asynchronously or in background worker threads to keep the system responsive.

## Acceptance Criteria

### Report Formatting & Export
- [ ] Daily, weekly, and monthly reports export in Excel (.xlsx) format with clean layout and column alignment.
- [ ] No reports export in XML format.

### Invoicing
- [ ] Invoices generate and export cleanly in PDF format with proper alignment.

### Admin Bill Management
- [ ] Admin users can edit existing bills.
- [ ] Admin users can delete / cancel bills.
- [ ] Deleting or modifying a bill adjusts inventory stock quantities accordingly and records audit logs.
- [ ] Non-admin users cannot modify or delete finalized bills.

### WhatsApp Integration
- [ ] Daily, weekly, and monthly reports and invoices can be shared or sent via WhatsApp with cleanly formatted summaries or links.

### Verification
- [ ] Automated tests (Jest / integration tests) verify Excel report generation, PDF invoice generation, and admin bill modification/deletion with stock adjustment.
- [ ] Generated Excel files validate as valid spreadsheets.
- [ ] Generated invoice PDFs validate as valid PDF documents.
