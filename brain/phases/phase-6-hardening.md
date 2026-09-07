# Phase 6 — Hardening and Deployment ("Make strong")

**Purpose:** get the shop actually running on the system in production, with a proven backup, and
let the owner sleep.
**Depends on:** Phase 5 exit gate signed (`workflow/phase-pipeline.md` §6) — reporting, GST
reconciliation, and the audit viewer must all be trustworthy before real production traffic and a
real restore drill are staked on the system.
**Exit gate:** the conditions in `workflow/phase-pipeline.md` §7 (G6.1–G6.8), summarised — the
shop runs production traffic on the system for N consecutive days with no unresolved P1; a
restore from a nightly dump into a scratch database matches source row counts and the day's sales
totals, and the drill has been executed and verified at least once; `stock:verify` reports zero
mismatching batches on 30 consecutive nightly runs; a permission re-audit shows no unused grant
and zero cashier cost exposure.
**Agents active:** devops (lead), security-auditor, pos-specialist, frontend-engineer,
orchestrator, qa-tester.

---

## Tasks

| ID | Title | Owning agent | Depends on | Acceptance check |
|---|---|---|---|---|
| T-0601 | Barcode scanning end to end, scanner as keyboard, no driver | pos-specialist | gate Phase 5 | headline — decomposed below |
| T-0601a | Physical scanner setup: Enter suffix, sentinel prefix per `brain/08-security-and-audit.md` §6 (USB scanner injection), US keyboard layout matching the terminal | devops | gate Phase 5 | Manual check: scanning into a text editor produces exactly the digits plus a newline, per `brain/09-deployment.md` §8 |
| T-0601b | POS-side barcode resolution validated against the real device, not just the T-0401e simulated burst | pos-specialist | T-0601a | Acceptance run on the shop's actual scanner: correct medicine added to cart, no mouse (G6.3) |
| T-0601c | Injection hardening confirmed: only digits accepted, length-validated, nothing scanned evaluated as HTML or SQL | security-auditor | T-0601a | Feature test: a crafted barcode payload containing control characters or a URL is ignored, not rendered or executed |
| T-0602 | Thermal 80mm printer tuning against the real device | frontend-engineer | gate Phase 5, Q-004 | headline — decomposed below |
| T-0602a | CUPS install with the correct ESC/POS or vendor PPD, paper width confirmed at 80mm not 58mm | devops | gate Phase 5, Q-004 | Manual check: driver paper-width setting inspected, not assumed; a full-width test print shows no clipped right edge |
| T-0602b | Terminal browser configured: thermal unit as default printer, no margins, headers/footers off | devops | T-0602a | Printed sample retained showing no browser-injected URL footer on the tax invoice |
| T-0602c | Full-width receipt print validated on the actual device: totals column not clipped, statutory footer intact | frontend-engineer | T-0602b | Printed sample retained and reviewed against `brain/06-ui-conventions.md` §7's 80mm content list (G6.4) |
| T-0603 | Nightly `pg_dump` backup, 30-day retention, off-machine copy, performed restore drill | devops | gate Phase 5 | headline — decomposed below |
| T-0603a | `backup:run` command: `pg_dump -Fc`, encrypted `.env` dump, `age` encryption to an off-machine key, per `brain/09-deployment.md` §6 | devops | gate Phase 5 | Feature/console test: dump file produced, non-zero, encrypted; failure at any step emails `ALERT_EMAIL` |
| T-0603b | Off-machine copy and verification by size and checksum, retention pruning (30 days rolling, monthly copy kept 12 months) | devops | T-0603a | Console test asserts prune leaves the correct row set; monthly-keep rows never pruned |
| T-0603c | `backup:report` at 08:45 states last successful backup age, size, off-machine status | devops | T-0603a | Manual check: dashboard ops panel shows a plausible, recent backup |
| T-0603d | **The restore drill, executed for real, at least once**, per `brain/09-deployment.md` §6 steps 1–9 | devops | T-0603b | Drill recorded in `logs/build-log.md`: date, dump used (picked at random, not the newest), time taken, row counts, `stock:verify` exit 0, day-total reconciliation against the printed day-end report, and a test sale rung and printed on the restored system (G6.1) |
| T-0604 | Deployment: nginx, php-fpm, supervisor, scheduler cron, UPS check | devops | gate Phase 5, Q-006 | headline — decomposed below |
| T-0604a | Server build per `brain/09-deployment.md` §2: Ubuntu 24.04, PHP 8.3-fpm, PostgreSQL 16 local-socket-only, nginx, supervisor, UFW LAN-only firewall | devops | gate Phase 5, Q-006 | Checklist walkthrough against §2; `listen_addresses = 'localhost'` confirmed; UFW rules confirmed LAN-scoped |
| T-0604b | php-fpm worker count and PostgreSQL `max_connections` sized to the resolved ADR-0007 terminal count | devops | T-0604a | Config values cross-checked against the answered Q-006/ADR-0007 terminal count, not the earlier 3–5 assumption |
| T-0604c | Full deploy procedure rehearsed per `brain/09-deployment.md` §4, including the smoke test at step 14 | devops | T-0604b | Deploy dry-run performed once on staging with the full smoke-test checklist recorded |
| T-0604d | Reboot drill: application, queue worker, and scheduler all recover with no manual step | devops | T-0604c | Server rebooted with the shop closed; recovery confirmed with no manual intervention (G6.5) |
| T-0604e | UPS installed and tested by pulling mains power with the shop closed | devops | T-0604a | Manual test recorded; machine survives a power interruption without corruption |
| T-0605 | Role and permission fine-tuning after real use, with a re-audit | security-auditor | gate Phase 5 | headline — decomposed below |
| T-0605a | Collect real-use friction: permissions requested but denied, permissions granted but never exercised, over a trial period on real staff | security-auditor | gate Phase 5 | Log review of denied-permission attempts and unused grants over the trial window |
| T-0605b | Adjust the permission matrix in `brain/08-security-and-audit.md` §2.1 to match actual role needs, every change audited | security-auditor | T-0605a | Each matrix change has a `role.permission_changed` audit row; the four hard-denied keys (`stock.adjust`, `report.profit`, `role.permission`, `user.create`) remain untouched |
| T-0605c | Full re-audit: no role holds a permission it does not use, cashier cost exposure re-confirmed zero | security-auditor | T-0605b | security-auditor report; `CashierCostExposureTest.php` re-run against the final production route list (G6.7) |
| T-0606 | Paper-fallback procedure, back-dated sale handling, staff training | orchestrator | gate Phase 5 | headline — decomposed below |
| T-0606a | Manual fallback procedure document, printed and kept in the counter drawer, per `brain/09-deployment.md` §9 | orchestrator | gate Phase 5 | Document exists, matches the duplicate-bill-book procedure, Schedule H handling, and credit-sale conservatism in §9 exactly; a physical copy confirmed in the drawer |
| T-0606b | Back-dated re-entry procedure: manual bills re-entered after closing, in written order, batch chosen by hand overriding FEFO, manual bill number recorded in the sale's notes field | orchestrator | T-0606a | Procedure walkthrough with a fixture manual bill: re-entered sale's notes field carries the manual bill number, `stock:verify` clean after |
| T-0606c | Staff training session on the fallback procedure, rehearsed once with counter staff | orchestrator | T-0606a | Training note in a session log naming attendees and date (G6.6) |
| T-0607 | Performance pass, monitoring and alerting, 30-night `stock:verify` watch | devops | T-0604 | headline — decomposed below |
| T-0607a | Monitoring wired per `brain/09-deployment.md` §7: dashboard ops panel plus the four narrow alert conditions (backup failure, `stock:verify` drift, disk under 15%, queue stalled 30+ minutes) | devops | T-0604c | Each of the four alert conditions tested by forcing it once and confirming the owner email fires |
| T-0607b | Log rotation and retention configured: nginx, application, PostgreSQL logs, per §7 | devops | T-0607a | `logrotate` config reviewed; 14-day daily rotation confirmed |
| T-0607c | 30 consecutive nightly `stock:verify` runs watched and logged clean | qa-tester | T-0607a | Nightly log review over 30 calendar nights, zero mismatching batches on every run (G6.2) |
| T-0607d | Drug-interaction / allergy warning: explicitly recorded as future, not in v1 | orchestrator | none | `brain/state/BACKLOG.md` carries a Phase 7+ backlog entry with a business case per `CAVEMAN_DESIGN.md` Part 12 and `workflow/phase-pipeline.md` §7's "forbidden to start early" note; no schema or UI stub for it exists anywhere in v1 |
| T-0608 | Phase 6 / production acceptance: N consecutive production days, no unresolved P1 | qa-tester | T-0601–T-0607 | Session note recording the production run window, day count, and a clean P1 log; gate summary reviewed against `workflow/phase-pipeline.md` §8 |

---

## Risks specific to this phase

> **Cave law:** an untested backup is not a backup — it is a file (`brain/09-deployment.md` §6).
> T-0603d is not satisfied by the existence of `backup:run`; it requires the drill to have
> actually been run, on a machine that is not production, with the result recorded.

> **Cave law:** never fix a failed migration by editing the migration file that already ran, and
> never run `migrate:fresh`, `migrate:reset`, or `db:wipe` against the shop database
> (`brain/09-deployment.md` §4). This applies with full force once production traffic exists —
> Phase 6 is where a rollback mistake first has a real customer's bill behind it.

> **Cave law:** `stock.adjust`, `report.profit`, `role.permission`, and `user.create` are hard-
> denied to non-admins regardless of the runtime permission grid (`brain/08-security-and-audit.md`
> §2). T-0605b's fine-tuning may adjust the soft grid; it must never touch these four.

- **Real-device risk replaces simulated risk.** T-0601 and T-0602 depend on Q-004 (printer/scanner
  model) being answered — building against an assumed device and discovering the real one differs
  at go-live is exactly the failure this phase exists to prevent. Do not schedule the acceptance
  run before the real hardware is on site.
- **UPS and power.** `brain/09-deployment.md` §2 states plainly: "a power cut mid-transaction on a
  machine with no battery is how a database gets corrupted." T-0604e's pull-test must happen
  before production traffic (T-0608), not after.
- **Restore drill discipline.** The drill in T-0603d must pick a dump at random from the last 30
  days, not the newest — the newest is the least informative test (`brain/09-deployment.md` §6).
  A drill that quietly always tests last night's dump has not actually tested the backup process.
- **Fine-tuning drift from the security baseline.** T-0605's real-use adjustments are the most
  likely place in the whole project for permission scope to creep upward under staff pressure
  ("just give the pharmacist stock.adjust too, it's easier") — T-0605c's re-audit exists
  specifically to catch that before go-live, not after an incident.

## Definition of done

Universal checklist plus per-layer sections in `workflow/definition-of-done.md` (particularly
§3.7, Deployment/configuration change), and specifically for this phase:

- [ ] Restore drill executed at least once on a non-production machine, with date, dump used, time
      taken, row counts, `stock:verify` result, and content-reconciliation result recorded in
      `logs/build-log.md` (G6.1).
- [ ] 30 consecutive nightly `stock:verify` runs logged clean (G6.2).
- [ ] Barcode scan-to-cart acceptance run performed on the shop's actual scanner (G6.3).
- [ ] Full-width 80mm receipt print sample retained from the shop's actual printer (G6.4).
- [ ] Reboot drill performed with the shop closed; application, worker, and scheduler recover with
      no manual step (G6.5).
- [ ] Paper-fallback procedure printed, present in the counter drawer, and rehearsed once with
      counter staff, recorded in a training note (G6.6).
- [ ] Permission re-audit report confirms no unused grant and zero cashier cost exposure (G6.7).
- [ ] Q-004 (printer/scanner model) and Q-006 (terminal count) both resolved before T-0602 and
      T-0604 respectively started, not discovered mid-task (G6.8).
- [ ] Drug-interaction/allergy warning explicitly recorded as a Phase 7+ backlog item with a
      business case, not built into v1 in any form.
- [ ] Production traffic run for N consecutive days with a clean P1 log before the gate is signed.
- [ ] Phase gate signed by the orchestrator on qa-tester's and security-auditor's recommendation,
      recorded in `logs/build-log.md`, per `workflow/phase-pipeline.md` §8 — this is the last gate
      in v1; anything beyond it is Phase 7+ backlog, not scope.
