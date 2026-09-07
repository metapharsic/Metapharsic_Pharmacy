# Phase 2 — Master data

**Purpose:** Get the shop's real catalogue and parties into the system, searchable fast enough
to bill from.

**Depends on:** Phase 1 exit gate signed.

**Exit gate:**

| # | Condition | How it is checked |
|---|---|---|
| G2.1 | The shop's real medicine list imports with zero silent row loss: `rows_in_file = imported + rejected`, and every rejection has a reason | Import report artefact attached to the session note |
| G2.2 | Re-running the same import changes nothing (idempotent) | Feature test |
| G2.3 | Medicine search 95th percentile under 150 ms over the real catalogue | `php artisan test --group=performance` |
| G2.4 | `medicines` has no `quantity`, no `expiry_date`, no batch column — verified against the live schema, not the migration file | Integrity test asserting absent columns |
| G2.5 | `gst_rate IN (0,5,12,18)` and `pack_size > 0` enforced by CHECK constraints in the database | Schema assertion test |
| G2.6 | Q-005 (source data format) resolved; Q-007 (opening credit balances) resolved or explicitly deferred with a named owner | `brain/state/OPEN_QUESTIONS.md` |
| G2.7 | Pint, PHPStan, full suite green; `brain/02-database-schema.md` matches reality | CI + orchestrator review |

**Agents active:** backend-engineer (lead), db-architect, pharmacy-domain, frontend-engineer, qa-tester.

## Tasks

| ID | Title | Owning agent | Depends on | Acceptance check |
|---|---|---|---|---|
| T-0201 | `categories`, `manufacturers`, `units` schema and CRUD | backend-engineer | gate Phase 1 | Migrations create all three tables with soft delete; CRUD screens create/edit/deactivate each, policy-enforced to admin/pharmacist |
| T-0201a | `units` reference data seed (strip/bottle/tablet/tube) | pharmacy-domain | T-0201 | Seeder inserts the Part 2 unit list; a medicine cannot be created referencing a non-seeded unit (FK) |
| T-0202 | `medicines` schema: HSN, GST rate, pack size, min stock, Rx flag, barcode, soft delete | db-architect | gate Phase 1 | Migration matches `brain/02-database-schema.md` §4.2 exactly: no quantity/expiry/batch column, `barcode` nullable-unique, soft delete present |
| T-0202a | CHECK constraints: `gst_rate IN (0,5,12,18)`, `pack_size > 0` | db-architect | T-0202 | Direct SQL insert violating either constraint is rejected by Postgres, not by application validation alone |
| T-0203 | Medicine CRUD with validation and the GST-slab and pack-size CHECK constraints | backend-engineer | T-0202 | Form Request rejects out-of-slab GST and non-positive pack size before hitting the database; feature test for both |
| T-0203a | `MedicinePolicy` — cashier read-only, no cost fields exposed | security-auditor | T-0203 | Cashier session's medicine index/show response contains no `default_purchase_price` |
| T-0204 | Medicine search: trigram/prefix indexing, name, generic name, barcode exact match | db-architect | T-0202 | `pg_trgm` GIN index created on `name`/`generic_name`; barcode lookup is an exact-match indexed query |
| T-0204a | Search performance test against the real (or realistic-volume) catalogue | qa-tester | T-0204 | `--group=performance` test asserts p95 < 150 ms over a seeded 3,000+ row catalogue |
| T-0205 | `suppliers` schema and CRUD, including `state_code` | backend-engineer | gate Phase 1, Q-002 | Migration includes `state_code`; CRUD screen validates it against the GST state-code list; Q-002 (intra-state only) already resolved so no IGST field is added |
| T-0206 | `customers` schema and CRUD: phone index, credit limit, outstanding balance | backend-engineer | gate Phase 1, Q-007 | Migration indexes `phone`; `credit_limit` and `outstanding_balance` are `numeric(12,2)`; Q-007 resolution (or explicit deferral) recorded before opening-balance fields are finalised |
| T-0207 | CSV medicine import: dry run, row-level error report, idempotent re-run | pharmacy-domain | T-0203, Q-005 | Import supports `--dry-run`; every rejected row carries a reason string; re-running an already-imported file changes zero rows |
| T-0207a | Import de-duplication strategy | pharmacy-domain | T-0207, Q-005 | Duplicate name+manufacturer+pack_size combinations are flagged, not silently created twice; behaviour documented in `brain/03-domain-rules.md` |
| T-0207b | Import job runs on the queue driver resolved in Phase 1 (T-0102a) | backend-engineer | T-0207 | Large-file import dispatches a queued job using `database` queue, not synchronous, and does not touch Redis |
| T-0208 | Master-data UI screens under the Phase 1 layout | frontend-engineer | T-0201, T-0203 | Category/manufacturer/medicine/supplier/customer list, create, edit screens use the Phase 1 sidebar shell; keyboard-reachable per `brain/06-ui-conventions.md` |

## Risks specific to this phase

Q-005 (source data format) is open and directly blocks T-0207's acceptance criteria: the
importer's validation and de-duplication design cannot be finalised against an assumed format.
Escalate rather than guess column mappings — a wrong guess produces confidently wrong medicine
records that Phase 3 batches and Phase 4 sales then build on.

> **Cave law:** medicine holds no quantity, no expiry, no price. Those live on
> `medicine_batches`, which does not exist until Phase 3. G2.4 exists specifically to catch a
> well-intentioned "just add a stock column for now" shortcut before it ships.

The 150 ms search budget (G2.3) is a hard budget, not a target: per `brain/06-ui-conventions.md`,
a feature that would push search past the budget changes, the budget does not. Do not solve a
slow search by loosening the test.

Q-007 (opening credit balances) touches both this phase (`customers` schema) and Phase 3
(opening stock/balance entries); an unresolved Q-007 at gate time must be explicitly deferred
with a named owner per G2.6, not silently left blank.

## Definition of done

Per `workflow/definition-of-done.md` universal checklist, plus:

- [ ] Migration checklist (§3.1): reversible, CHECK constraints for every invariant, indexes for
      every actually-searched column, `brain/02-database-schema.md` updated in the same change.
- [ ] Controller checklist (§3.3): Form Request validation, policy/`can:` enforcement,
      `permissions:check` green, happy-path and denial HTTP tests for each CRUD surface.
- [ ] View checklist (§3.4): no cost field on any cashier-reachable master-data page.
- [ ] Cost exposure re-verified: cashier session response bodies for medicine/supplier endpoints
      contain none of `default_purchase_price`, `effective_cost`.
- [ ] Import report artefact (G2.1) attached to the session note before the gate is signed.
- [ ] `stock:verify` not yet applicable (no ledger exists) — explicitly noted as N/A, not skipped.
- [ ] `PHASE GATE — Phase 2 (Master Data)` signoff written by the orchestrator on qa-tester's
      recommendation, before any Phase 3 task leaves `blocked`.
