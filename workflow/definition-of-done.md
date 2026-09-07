# Definition of Done

Purpose: state the checks that must pass before any agent claims a task is finished — the universal set, and the additional set for each layer a change can touch.

---

## 1. How to use this file

"Done" is not "the code works on my machine". It is: the change is correct, proven, documented,
logged, and safe for the next agent to build on without re-reading the diff.

The owning agent completes the universal checklist plus every per-layer section its change
touched, and pastes the completed checklist into the task file before requesting review. A
reviewer then works from `workflow/review-checklist.md`, which is a different document with a
different job: this file is self-assessment, that one is verification.

> **Cave law:** an unchecked box is a `no`. There is no "mostly", no "will do after merge", and
> no verbal assurance. A task with an unchecked box is `in-progress`, not `review`.

---

## 2. Universal checklist — every task, no exceptions

### Correctness and tests

- [ ] The acceptance criteria in the task file are each satisfied, and each one was actually
      run — not reasoned about.
- [ ] Tests are written for the behaviour this change introduces or alters, at the layer
      `brain/07-testing-strategy.md` §1 assigns it to.
- [ ] The full suite passes: `php artisan test --parallel` green, zero skipped tests that were
      not skipped before this change.
- [ ] The concurrency group passes where the change can touch it: `php artisan test --group=concurrency`.
- [ ] No test from the non-negotiable ten (`brain/07-testing-strategy.md` §2) was weakened,
      skipped, or deleted to make the build green.

### Stock integrity

- [ ] Where this change touches stock in any way — a migration on a stock table, a service that
      moves quantity, a seeder, a command — `php artisan stock:verify` runs **clean**, after the
      suite, with the change applied.
- [ ] Every quantity change in the diff goes through `InventoryService`. There is no direct
      write to `medicine_batches.quantity_available` anywhere in the change. *(Cave law 1)*

### Quality gates

- [ ] `vendor/bin/pint --test` exits 0.
- [ ] `vendor/bin/phpstan analyse` exits 0 at the configured level, with no new baseline entry
      for our own code and no unexplained `@phpstan-ignore`.
- [ ] Every new PHP file starts with `declare(strict_types=1)`.
- [ ] No `env()` call outside `config/`.

### Money and role safety

- [ ] No `float`, `real`, `double precision`, or PHP float arithmetic appears anywhere in a
      money path in this change. Money is `numeric(12,2)` in the database and a money value
      object in PHP. *(ADR-0004)*
- [ ] No cost data is exposed to the cashier role: `purchase_price`, `effective_cost`, and
      `cost_price_at_sale` are excluded **at the query layer** for cashier sessions, not hidden
      in a Blade template. If this change adds any cashier-reachable route, that route is
      covered by the cost-exposure test. *(Cave law 2)*

### Cave laws

- [ ] Re-read the eight cave laws in `CLAUDE.md` against this diff. None is violated, and each
      one named in the task's "cave laws in play" section is satisfied by a concrete mechanism
      the reviewer can point at.

### Documentation

- [ ] Every `brain/` document made wrong by this change is corrected **in the same change**.
- [ ] Anything new that belongs in `brain/` — a rule, a constraint, a *why* — is written there,
      and nothing derivable from code was copied into it.
- [ ] If an irreversible or expensive-to-reverse choice was made, an ADR exists in
      `brain/decisions/`, is referenced from the code or the brain doc that depends on it, and
      has a line in `logs/decisions.log.md`.
- [ ] `brain/state/OPEN_QUESTIONS.md` is updated: questions this work answered are marked
      resolved with their resolution; questions it raised are added with an ID and what they block.

### Logging

- [ ] `logs/build-log.md` has an appended entry in the required format for this task's work.
- [ ] `logs/changelog.md` has an entry under `## [Unreleased]` if the change is user-visible.
- [ ] Nothing already in a log file was edited or removed. Logs are append-only.

### Handoff

- [ ] The handoff block from `workflow/handoff-protocol.md` §3 is appended to the task file,
      with all seven fields filled, including a next-agent recommendation.
- [ ] The change stays inside the task's declared scope. Any path outside it was either not
      touched, or was escalated as a scope collision.

---

## 3. Per-layer additions

### 3.1 Migration

- [ ] Reversible: `php artisan migrate:refresh --force` succeeds; `down()` is real, not empty.
- [ ] One concept per migration file, named `create_x_table` or `add_y_to_x_table`.
- [ ] Money columns are `numeric(12,2)`; quantity columns match the type resolved in Q-001;
      timestamps are `timestampTz`; the primary key is `id()`.
- [ ] Actor column (`created_by`, and `confirmed_by` / `cancelled_by` / `approved_by` where the
      action is separately authorised) present on every table that records money or stock.
- [ ] CHECK constraints written for every invariant the database can hold — non-negative
      quantities, bounded round-off, enumerated status values, rate slabs.
- [ ] Indexes exist for the columns this table is actually searched by (`medicine_id`,
      `expiry_date`, `batch_no`, phone, invoice number), and each unique constraint is deliberate.
- [ ] Foreign keys have an explicit `onDelete` behaviour, and no transactional table permits a
      cascading delete of history.
- [ ] `brain/02-database-schema.md` updated in the same change, including the index and CHECK
      tables.
- [ ] The migration does not seed business data.

### 3.2 Service

- [ ] The method owns an explicit `DB::transaction`; a service that mutates stock or money never
      relies on an implicit one.
- [ ] Every row it will mutate is locked with `SELECT … FOR UPDATE` before it is read for a
      decision, and the lock order is consistent with the rest of the codebase to avoid deadlock.
- [ ] The state read from the screen is re-validated inside the transaction — quantity, expiry,
      credit limit, prescription requirement — because screen data is old and the database is truth.
- [ ] Ledger writes go through `InventoryService::apply()` with the correct
      `StockTransactionType` and a real polymorphic reference. `balance_after` is written.
- [ ] Failure paths throw a domain exception from `app/Exceptions/Domain`, and every throwing
      branch has a test.
- [ ] Nothing is written outside the module's owned tables (`brain/05-routes-and-modules.md` §4).
- [ ] Audit rows for watched actions are written inside the same transaction; notification-only
      concerns are dispatched after commit.
- [ ] Return type is a value the caller can assert on, not `void`.

### 3.3 Controller

- [ ] It resolves a Form Request, calls exactly one service method, and returns a
      view/redirect/JSON. No loops over line items, no Eloquent writes, no transaction, no
      total computed here.
- [ ] Authorisation is enforced by policy or `can:` middleware, and the permission key exists in
      the seeder — `php artisan permissions:check` passes.
- [ ] Validation lives in the Form Request, including the rules a malicious client would target
      (quantity bounds, discount cap, batch ownership).
- [ ] Two HTTP tests exist: one happy path, one authorisation denial for the role that must be
      refused.
- [ ] `brain/05-routes-and-modules.md` updated if a route or permission key was added.

### 3.4 View

- [ ] Money is rendered through the shared money component; no `number_format` on a raw value
      and no arithmetic in a Blade template.
- [ ] No cost field is present in the markup on any cashier-reachable page — and it is absent
      from the payload, not merely hidden with CSS or a role check in the template. *(Cave law 2)*
- [ ] Colour semantics follow `brain/06-ui-conventions.md`: expiry warnings, prescription
      marking, and destructive actions use the established meanings.
- [ ] Keyboard reachable: every action has a focus state and a keyboard path; tab order is sane.
- [ ] No N+1 query introduced — verified by a query count assertion or by inspecting the debug
      output on a page with realistic data.
- [ ] Renders correctly at the shop's actual screen size, and prints correctly if it is a
      printable document.

### 3.5 POS screen

- [ ] The keyboard contract in `brain/06-ui-conventions.md` is honoured exactly: the documented
      function keys do the documented things, and a complete five-line cash bill is possible
      with no mouse.
- [ ] Search-to-cart works from both typed text and a scanned barcode (a scanner is a keyboard
      that types digits and Enter).
- [ ] Prescription-required items are marked and hard-blocked until a prescription number is
      entered or an authorised override is given — and the override is written to `audit_logs`
      with the authoriser.
- [ ] Expiry handling: a batch expiring within 90 days warns; an expired batch is blocked and
      cannot be forced from the UI.
- [ ] The save path is: lock → re-check → write → commit → **then** print. A print failure never
      rolls back a committed sale, and a committed sale is never left half-written.
- [ ] Multi-batch splits are invisible to the customer on the invoice and explicit in the
      database. *(Cave law 4)*
- [ ] No edit or delete affordance for a saved sale exists anywhere on the screen. *(Cave law 8)*
- [ ] Measured: save completes under 500 ms at p95 with five concurrent users.
- [ ] Held bills survive a page reload and cannot be recalled twice.

### 3.6 Test

- [ ] It runs against real PostgreSQL 16, never SQLite.
- [ ] It asserts on behaviour and data, not on markup or on SQL strings.
- [ ] Concurrency tests use two genuine connections and `DatabaseTruncation`, not
      `RefreshDatabase`, and are tagged `->group('concurrency')`.
- [ ] Randomised tests print their seed on failure and run from a fixed seed in CI.
- [ ] Any test defending a cave law or an ADR carries a comment naming it, so it is not
      "simplified" later by someone who does not know why it exists.
- [ ] It fails when the behaviour is broken — verified by breaking it once, deliberately, and
      watching the test go red.
- [ ] Coverage targets in `brain/07-testing-strategy.md` §6 still hold for the touched layer.

### 3.7 Deployment / configuration change

- [ ] `.env.example` lists every new key, with a safe placeholder and no real secret.
- [ ] The change is reflected in `brain/09-deployment.md`, including any new service, cron
      entry, or supervisor program.
- [ ] Rollback is written down and has been performed at least once, not merely described.
- [ ] Backup remains valid: if the change alters the schema or the data directory, a `pg_dump`
      taken after the change restores into a scratch database and reconciles on row counts.
- [ ] The scheduler still runs `stock:verify` nightly, and its failure path still reaches a human.
- [ ] The application starts clean after a full server reboot, with the queue worker and
      scheduler running, and no manual step.
- [ ] CI reflects the change — a new check is added to the pipeline, not run only on a laptop.
