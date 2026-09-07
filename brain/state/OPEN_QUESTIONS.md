# Open Questions

Purpose: hold every unresolved question that blocks work, who must answer it, and what stalls until it is answered.

---

## 1. Rules

| Rule | Detail |
|---|---|
| One row per question, IDs `Q-NNN`, never reused | Tasks and logs reference them by ID |
| Every question names what it blocks | A question that blocks nothing is a curiosity, not an open question; it belongs in a brain doc or nowhere |
| Only the orchestrator marks a question `resolved`, and only with the answer written in the Resolution column | "We discussed it" is not a resolution |
| A resolution that constrains future design becomes an ADR or a rule in `brain/` in the same change | The question row is a pointer, not the permanent home of the answer |
| Rows are never deleted | A resolved question stays, with its answer, because the next reader will ask it again |

**Status vocabulary:** `open` · `answered-pending-write-up` · `resolved` · `deferred` (explicitly
postponed, with a named owner and the phase it returns in).

> **Cave law:** an agent blocked by an open question stops and escalates. Guessing at a domain
> answer — a tax rule, a licence number, a unit of dispensing — produces software that is
> confidently wrong, which is worse than software that is visibly unfinished.

---

## 2. Open questions

| ID | Question | Raised by | Raised on | Blocking what | Status | Resolution |
|---|---|---|---|---|---|---|
| Q-001 | **Fractional units.** Does the shop ever sell loose tablets — half a strip, three tablets out of ten — or is every sale in whole units of the medicine's dispensing unit? The answer fixes the type of every quantity column in the system: `integer` if never, `numeric(10,3)` if ever. Retrofitting fractional quantity onto an integer schema means migrating every stock table, every ledger row, and every allocation and tax calculation. | orchestrator | 2026-08-24 | **Phase 1** — T-0105 (migration conventions baseline) and gate condition G1.9; then T-0301, T-0302 (batch and ledger schema) and T-0402 (allocation arithmetic) | resolved | Integer quantity confirmed; no loose tablets, no fractional-quantity path in v1. |
| Q-002 | **Intra-state only, or is inter-state supply possible?** Does the shop ever raise an invoice where the place of supply is outside its own state — a customer with an out-of-state GSTIN, a clinic across a state border? If yes, the tax engine must compute IGST as well as the CGST/SGST split, `customers.state_code` becomes decisive rather than informational, and the GST report needs an inter-state section. | pharmacy-domain | 2026-08-24 | **Phase 4** — T-0403 (tax engine); also **Phase 2** T-0205 and T-0206 (`state_code` on parties) and **Phase 5** T-0505 (GST report) | resolved | CGST+SGST only; no IGST path in v1. |
| Q-003 | **Statutory footer details.** What exactly must be printed on the invoice footer: the drug licence numbers (Form 20/21 retail licence numbers as issued), the GSTIN, the registered pharmacist's name and registration number, the shop's legal name and address as registered? We need the exact strings, not approximations — this is what an inspector reads. | pharmacy-domain | 2026-08-24 | **Phase 4** — T-0407 (A4 and 80mm print layouts) | open | — |
| Q-004 | **Thermal printer make and model, and is it ESC/POS?** Which 80mm printer does the shop use, and does it accept ESC/POS commands, or is it driven purely as a Windows printer through the browser's print dialogue? The answer decides whether receipt output is a CSS `@media print` layout at 80mm width or a raw command stream, and whether a cash-drawer kick and an auto-cut are available at all. | devops | 2026-08-24 | **Phase 6** — T-0602 (printer tuning); constrains **Phase 4** T-0407 | open | — |
| Q-005 | **Existing medicine master data — what format?** The shop has an existing medicine list. Is it an Excel workbook, a CSV export from the previous software, a printed register, or a mix? What columns does it actually have — does it carry HSN codes and GST rates, or only names and MRPs? How many rows, and how dirty (duplicate names, inconsistent pack sizes, blank manufacturers)? The importer's validation, dry-run report, and de-duplication strategy all depend on this. | pharmacy-domain | 2026-08-24 | **Phase 2** — T-0207 (CSV medicine import) and gate condition G2.1 | open | — |
| Q-006 | **How many concurrent POS terminals?** The design assumes three to five concurrent users — typically two POS terminals, one back-office machine, and the owner on reports. Is that right at peak, and is it expected to grow? The answer sizes php-fpm workers, the PostgreSQL `max_connections` setting, and the UPS, and it sets the concurrency level the race tests must actually simulate. | devops | 2026-08-24 | **Phase 6** — T-0604 (deployment sizing); sets the target for the **Phase 4** concurrency tests | resolved | 4+ concurrent terminals confirmed; see ADR-0007. |
| Q-007 | **Existing customer credit outstanding.** Do credit customers currently owe money that must be carried into the new system as opening balances? If so, per customer or per unpaid invoice, and with what dates — because aging buckets computed from a single lump "opening balance" row will report all old money as new money on day one. And is there matching supplier outstanding to bring across? | orchestrator | 2026-08-24 | **Phase 2** — T-0206 (customer schema); **Phase 3** — T-0305 (opening entries); **Phase 5** — T-0507 (aging) | open | — |
| Q-008 | **E-invoicing and e-way bill thresholds.** Does the shop's aggregate turnover cross the e-invoicing threshold, now or plausibly within the year, and does any supply it makes cross the e-way bill value threshold? E-invoicing would mean an IRN and a QR code on the invoice from an external portal — which is a network dependency in the billing path, and the architecture currently forbids one. This must be known before invoice numbering and print are finalised, not after. | pharmacy-domain | 2026-08-24 | **Phase 4** — T-0406 (invoice numbering) and T-0407 (print); **Phase 5** — T-0505 (GST report) | open | — |

## 3. Resolved questions

None yet. Resolved rows move here with their answer intact, and a link to the ADR or brain
section that now holds the answer permanently.

| ID | Question | Resolved on | Resolution | Recorded in |
|---|---|---|---|---|
| Q-001 | Fractional units | 2026-08-24 | Integer quantity confirmed; no loose tablets. | `brain/02-database-schema.md` §2 |
| Q-002 | Intra-state only, or inter-state possible | 2026-08-24 | CGST+SGST only; no IGST path in v1. | `brain/03-domain-rules.md` §5 |
| Q-006 | How many concurrent POS terminals | 2026-08-24 | 4+ concurrent terminals. | `brain/decisions/ADR-0007-concurrency-and-scale.md` |

**Last updated:** 2026-08-24
