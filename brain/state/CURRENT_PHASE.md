# Current Phase

Purpose: state exactly what is in scope right now, what closes this phase, and nothing else.

---

**Phase:** 6 — Hardening ("Watch the fire")
**Status:** all 6 phases built (real Laravel code in `app/`); this file was never updated as build
  progressed — treat rows below as historical, not current. Real remaining gaps are tracked in
  `qa/agent/` TODOs and Playwright test TODOs, not here, until this file gets a full rewrite pass.
**Opened:** 2026-08-24
**Gate signed:** informal — no formal gate signoff was recorded in `logs/build-log.md` per phase;
  build proceeded fast via multi-agent scaffolding instead of the gated pipeline this file describes.
**Last updated:** 2026-08-26 — status line patched to match reality; full task-row rewrite still owed.

> **Cave law:** this is the only file in `brain/` expected to change frequently. Everything else
> in `brain/` is durable truth and changes only when the truth changes. Progress, status, and
> "what we are doing this week" live here, in `brain/state/BACKLOG.md`, and in
> `brain/state/OPEN_QUESTIONS.md` — never in a brain document, a code comment, or an ADR.

---

## 1. Goal

Stand up a running Laravel 12 application on PHP 8.3 and PostgreSQL 16 with real
authentication, real roles and permissions, and a layout shell — built to the money, quantity,
timezone, and migration conventions that every later table in the system will inherit without
re-examination.

Phase 1 produces no domain feature. Its value is that the fifty migrations written in Phases 2
through 6 inherit a correct baseline instead of a convenient one.

## 2. Exit gate

Phase 2 does not open until every condition below is true and the orchestrator has recorded a
phase-gate signoff entry in `logs/build-log.md`. Full conditions and their evidence are in
`workflow/phase-pipeline.md` §2.

| # | Condition |
|---|---|
| G1.1 | An admin logs in and creates a cashier user |
| G1.2 | The cashier logs in, reaches an empty dashboard, and gets HTTP 403 on the user-management route |
| G1.3 | `vendor/bin/pint --test` exits 0 |
| G1.4 | `vendor/bin/phpstan analyse` exits 0 at level 6 or higher, no baseline entry for our own code |
| G1.5 | `php artisan migrate:refresh --force` succeeds — every migration is reversible |
| G1.6 | `php artisan permissions:check` exits 0 |
| G1.7 | Timezone is `Asia/Kolkata`, asserted by a test, with a `timestamptz` round-trip |
| G1.8 | Pest suite green on PostgreSQL 16, never SQLite |
| G1.9 | Q-001 (fractional units) resolved — it fixes the quantity column type for every later migration |
| G1.10 | `brain/` matches what was built; every Phase 1 task below is checked |

## 3. Active agents

| Agent | Role in Phase 1 |
|---|---|
| **devops** | Lead. Project skeleton, database connection, configuration, tooling, CI |
| **db-architect** | Migration conventions baseline, identity tables, models |
| **backend-engineer** | Auth scaffolding, user CRUD |
| **security-auditor** | Roles, permissions, gates, policies, seeder, login logging |
| **frontend-engineer** | Base layout, permission-filtered navigation, empty dashboard |
| **qa-tester** | Test harness, Phase 1 acceptance suite, gate evidence |
| **orchestrator** | Task authoring, assignment, state, gate signoff |

Not active this phase: `pharmacy-domain`, `pos-specialist`. Their first tasks open in Phase 2
and Phase 4 respectively.

## 4. Phase 1 task list

Backlog rows and owners are in `brain/state/BACKLOG.md`.

- [ ] **Laravel 12 install** — Laravel 12 skeleton on PHP 8.3, boots, no SQLite anywhere *(T-0101, devops)*
- [ ] **PostgreSQL connection** — `pgsql` default against PostgreSQL 16, plus the `pgsql_test_b` second connection the Phase 4 concurrency tests need *(T-0101, devops)*
- [ ] **Timezone and locale config** — `Asia/Kolkata`, INR formatting, financial-year helper conventions *(T-0102, devops)*
- [ ] **Pint / PHPStan / Pest setup** — Pint with `declare_strict_types`, Larastan at level 6 (level 8 for `app/Services`), Pest 3 on real PostgreSQL *(T-0103, devops)*
- [ ] **CI skeleton** — pipeline steps 1–11 of `brain/07-testing-strategy.md` §7, including the forwards-and-backwards migration step *(T-0104, devops)*
- [ ] **Migration conventions baseline** — `id()`, `timestampTz`, `numeric(12,2)` money, actor columns, index and CHECK conventions from `brain/02-database-schema.md` §1 *(T-0105, db-architect)*
- [ ] **Identity schema** — `users`, `roles`, `permissions`, `role_user`, `permission_role`, `login_logs` migrations and models *(T-0106, db-architect)*
- [ ] **Auth scaffolding** — Blade auth stack, session and password configuration, `last_login_at`, `is_active` enforcement *(T-0107, backend-engineer)*
- [ ] **Roles, permissions and gates** — gate and policy wiring, role/permission seeder, `permissions:check` command *(T-0108, security-auditor)*
- [ ] **User CRUD** — admin-only, policy-enforced, with the deny path tested for pharmacist and cashier *(T-0109, backend-engineer)*
- [ ] **Login logging** — successful and failed login rows, IP and user agent, audit hooks for permission changes *(T-0110, security-auditor)*
- [ ] **Base layout** — sidebar shell, permission-filtered navigation, empty dashboard *(T-0111, frontend-engineer)*
- [ ] **Phase 1 acceptance suite** — admin creates cashier; cashier logs in, sees the dashboard, is refused the user page; timezone and reversibility assertions *(T-0112, qa-tester)*

## 5. Explicitly not in Phase 1

Starting any of these early breaks the gate (see `workflow/phase-pipeline.md` §2).

- No `medicines`, `medicine_batches`, `stock_transactions`, `sales`, or `purchases` migration.
  Later schema is designed on paper in `brain/02-database-schema.md`, not created.
- No POS route, controller, or Blade view — not even a placeholder.
- No `InventoryService`, `SalesService`, or any service that needs a table that does not exist.
- No seeded demo medicines. Reference data in Phase 1 means roles and permissions only.

## 6. Blocking open questions

| ID | Question | Why it blocks Phase 1 |
|---|---|---|
| Q-001 | Do we ever sell loose tablets (fractional units)? | Decides `integer` versus `numeric(10,3)` for every quantity column. It must be answered before T-0105 sets the migration baseline, and it is gate condition G1.9 |

All other open questions block later phases. See `brain/state/OPEN_QUESTIONS.md`.
