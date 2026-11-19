# Original User Request

## Initial Request — 2026-11-01T18:30:57Z

Fix the inventory issues in Dead Stock Radar and Capital Lockup & Aging where loading fails with "failed to load the dead stock". Wire the data loading accurately using multi-threading as per the application architecture and fix the issue permanently.

Integrity mode: development

## Requirements

### R1. Dead Stock Radar Loading Fix
Permanently resolve the loading failure in the Dead Stock Radar feature so that dead stock inventory loads and displays accurately without showing "failed to load the dead stock" or failing to fetch data.

### R2. Capital Lockup & Aging Loading Fix
Resolve any corresponding data loading and calculation issues in Capital Lockup & Aging so that inventory aging and lockup metrics load and display accurately.

### R3. Multi-Threaded Architecture Integration
Wire the loading operations using multi-threading / asynchronous execution accurately as per the application's architecture to prevent blocking the UI thread and ensure thread-safe state management.

### R4. Verification and Automated Testing
Verify the fixes by running the existing project test suite and adding automated unit/integration tests covering the Dead Stock Radar and Capital Lockup & Aging loading logic.

## Acceptance Criteria

### Functionality & Bug Resolution
- [ ] Dead Stock Radar loads dead stock data successfully without returning "failed to load the dead stock".
- [ ] Capital Lockup & Aging loads and renders inventory aging and capital lockup metrics without errors.
- [ ] All data fetching and processing runs off the main thread, maintaining UI responsiveness.

### Testing & Verification
- [ ] New automated unit or integration tests cover the Dead Stock Radar and Capital Lockup & Aging loading and data processing paths.
- [ ] All new and existing project test suites pass cleanly.


## Follow-up — 2026-11-02T04:32:16Z

7023-38f96106d50572d6.js:1 ChunkLoadError: Loading chunk 9194 failed.
(error: http://localhost:5888/_next/static/chunks/app/(dashboard)/inventory/audit/page-af7a5580052ef57e.js)
    at Object.j (webpack-fcd61f508aae644d.js:1:3261)
    at webpack-fcd61f508aae644d.js:1:1400
    at Array.reduce (<anonymous>)
    at d.e (webpack-fcd61f508aae644d.js:1:1366)
    at 7023-38f96106d50572d6.js:2:18878
    at 7023-38f96106d50572d6.js:2:19080
    at t (7023-38f96106d50572d6.js:2:19283)
push.10353.window.console.error @ 7023-38f96106d50572d6.js:1


## Follow-up — 2026-11-02T05:09:01Z

I want give an option for selling the medicine. at a rate. even desiginig the single tablet rate. so that i can calculate the cost of each tablet and strip and know the profit. when doing the point of sale. how can i achive it. use multi thread to wire the logic to the rest of the app.


## Follow-up — 2026-11-02T05:33:45Z

were can i update the tablet cost. and how much to sell. give an option to chemist to sell at what price he wants to sell. with pre-defined options aswell.


## Follow-up — 2026-11-02T13:54:13Z

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


## Follow-up — 2026-11-03T11:37:13Z

Introduce purchase bill scanning, automated data extraction, interactive confirmation, and inventory provisioning into the production pharmacy application, delivering an architectural and implementation plan first before implementation.

Working directory: c:\metapharsic-pharmacy-complete
Integrity mode: development

## Requirements

### R1. Implementation Plan
- Deliver a comprehensive architectural and implementation plan first, covering the bill scanning pipeline, OCR and document parsing strategy, data model integration with purchase bills and inventory, interactive review UI, and automated test plan.

### R2. Purchase Bill Document & Image Scanning
- Provide capability to upload bill photos/images (e.g., JPEG, PNG) and PDF documents.
- Automatically parse and extract bill data including supplier information, invoice number, invoice date, line items (product name, batch number, expiry date, quantities, unit cost / MRP, discount, taxes, and line totals).
- The team decides the optimal OCR and document parsing engine strategy to achieve accurate data extraction from uploaded documents and images.

### R3. Interactive Review and Data Auto-Filling
- Automatically populate purchase bill forms and line item tables with the extracted data.
- Present an interactive review interface allowing users to inspect, verify, and edit all extracted fields before committing changes.

### R4. Confirmation and Automatic Inventory Provisioning
- Require user confirmation before finalizing and saving the purchase bill.
- Upon user confirmation, save the purchase bill record and automatically provision items into inventory, updating batch records and stock levels accordingly.

## Acceptance Criteria

### Implementation Plan
- [ ] A written implementation plan is produced detailing the scanning architecture, data parsing pipeline, inventory provisioning flow, and verification plan.

### Bill Ingestion & Parsing
- [ ] Users can upload purchase bill photos/images (JPEG, PNG) and PDF documents.
- [ ] Uploaded bills are processed and parsed into structured purchase bill fields (supplier, invoice number, invoice date, items, batch numbers, expiry dates, quantities, rates, and taxes).
- [ ] Parsed data automatically populates the purchase bill interface.

### Review & Confirmation
- [ ] Extracted bill details are presented in an editable review interface before saving.
- [ ] The system does not save the purchase bill or alter inventory stock without explicit user confirmation.

### Inventory Provisioning & Storage
- [ ] Confirming the purchase bill saves the purchase record with all line items to the database.
- [ ] Confirming the purchase bill automatically provisions stock quantities and batch entries in the inventory.

### Verification
- [ ] Automated tests verify end-to-end processing: document/image ingestion and parsing, form data population, confirmation validation, purchase record persistence, and inventory stock increments.
- [ ] Test suites run and pass without errors.
