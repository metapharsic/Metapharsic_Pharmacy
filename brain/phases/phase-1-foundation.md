# Phase 1 — Foundation

**Purpose:** Stand up a Laravel 12 / PostgreSQL 16 application with real auth, real roles and
permissions, and the migration/config conventions every later table and service inherits.

**Depends on:** none — project start, 2026-08-24.

**Exit gate:**

| # | Condition | How it is checked |
|---|---|---|
| G1.1 | An admin logs in and creates a cashier user | Acceptance run, recorded in the session note |
| G1.2 | The cashier logs in, reaches an empty dashboard, and receives HTTP 403 on the user-management route | `Feature/Http/Identity/CashierCannotManageUsersTest.php`, green |
| G1.3 | `vendor/bin/pint --test` exits 0 | CI |
| G1.4 | `vendor/bin/phpstan analyse` exits 0 at level 6+, no baseline entry for our own code | CI |
| G1.5 | `php artisan migrate:refresh --force` succeeds — every migration reversible | CI |
| G1.6 | `php artisan permissions:check` exits 0 — no orphan `can:` string, no unused seeded permission | CI |
| G1.7 | `config('app.timezone') === 'Asia/Kolkata'` asserted by a test; a `timestamptz` round-trips correctly | Unit + feature test |
| G1.8 | Pest suite green on PostgreSQL 16, not SQLite | CI |
| G1.9 | Q-001 (fractional units) resolved and recorded — already done: integer quantity confirmed | `brain/state/OPEN_QUESTIONS.md` |
| G1.10 | CONFLICT-001 (queue/cache driver) resolved in `brain/09-deployment.md`, matching `brain/01-architecture.md`'s `database` queue / `file` cache — no Redis anywhere in `.env.example` or the provisioning script | Doc diff + `grep -i redis .env.example` empty |
| G1.11 | `brain/` reflects what was built; `CURRENT_PHASE.md` shows all Phase 1 tasks `done` | Orchestrator review |

**Agents active:** devops (lead), db-architect, backend-engineer, security-auditor, frontend-engineer, qa-tester.

## Tasks

| ID | Title | Owning agent | Depends on | Acceptance check |
|---|---|---|---|---|
| T-0101 | Initialize the Laravel 12 project with a PostgreSQL 16 connection | devops | none | `php artisan --version` is 12.x; `DB::connection()->getDriverName()` is `pgsql`; no `database.sqlite`, no `sqlite` in `config/database.php`, `.env.example`, or `phpunit.xml` |
| T-0101a | Add the `pgsql_test_b` second connection for future concurrency tests | devops | T-0101 | `DB::connection('pgsql_test_b')->getPdo()` succeeds against a separate credential resolution |
| T-0101b | Lock `env()` usage to `config/**` only | devops | T-0101 | `grep -rn "env(" app/ resources/ routes/` returns nothing |
| T-0101c | Verify boot behaviour with the database down | devops | T-0101 | App fails loudly (500 with logged exception), not silently, when Postgres is unreachable — checked manually, recorded in handoff |
| T-0102 | Configure timezone `Asia/Kolkata`, INR locale, and app config baseline | devops | T-0101 | `config('app.timezone')` is `Asia/Kolkata`; a seeded `timestamptz` round-trips through a test without drift |
| T-0102a | Resolve CONFLICT-001: queue and cache driver | devops | T-0101 | `.env.example` sets `QUEUE_CONNECTION=database`, `CACHE_STORE=file`; `brain/09-deployment.md` rewritten to remove every Redis reference; `brain/01-architecture.md` unchanged as the source of truth |
| T-0102b | Money and INR display baseline | backend-engineer | T-0102 | A shared money value object formats `numeric(12,2)` as `₹1,23,456.00` (Indian digit grouping); no `float` cast anywhere in `config/**` |
| T-0103 | Set up Pint, PHPStan/Larastan level 6, and Pest 3 on real PostgreSQL | devops | T-0101 | `vendor/bin/pint --test`, `vendor/bin/phpstan analyse`, `php artisan test` all runnable and green on an empty skeleton; Pest's `phpunit.xml` points at Postgres |
| T-0104 | CI skeleton: pipeline steps 1–11, including migrate-refresh reversibility | devops | T-0103 | GitHub Actions workflow runs Pint, PHPStan, `migrate:refresh --force`, and Pest against a real Postgres 16 service container; all green |
| T-0105 | Migration conventions baseline: id, timestamptz, money, actor columns, index rules | db-architect | T-0101, Q-001 | A documented convention exists in `brain/02-database-schema.md` §1 and a scratch migration demonstrates `bigint id()`, `timestampTz`, `numeric(12,2)`, `created_by` |
| T-0106 | Identity schema: `users`, `roles`, `permissions`, pivots, `login_logs` | db-architect | T-0105 | Migrations create all six tables with FKs, unique constraints (`users.email`), and indexes; `migrate:refresh --force` reversible |
| T-0106a | `UserRole` enum and role seed data (admin/pharmacist/cashier) | db-architect | T-0106 | `RoleSeeder` creates exactly the three roles; enum values match seeded row names 1:1, asserted by test |
| T-0107 | Auth scaffolding, session and password configuration, `is_active` enforcement | backend-engineer | T-0106 | Breeze/Fortify login works; a login attempt for `is_active = false` is refused with a clear error; session driver is `database` |
| T-0108 | Roles, permissions, gates, policies, seeder, `permissions:check` command | security-auditor | T-0106 | `Gate::before` wires role→permission; `PermissionSeeder` and `PermissionRoleSeeder` create the Part 1 matrix; `php artisan permissions:check` exits 0 |
| T-0108a | Route-level `can:` middleware on every protected route | security-auditor | T-0108 | Every non-public route carries a `can:` middleware or explicit policy check; static grep confirms no bare route |
| T-0109 | User CRUD, admin only, policy-enforced | backend-engineer | T-0108 | `UserPolicy` refuses cashier and pharmacist on every CRUD action; feature test for happy path (admin) and denial (cashier) |
| T-0110 | Login and failed-login logging, audit hooks for permission changes | security-auditor | T-0107 | `login_logs` row written on every login attempt (success and failure) with IP and timestamp; a permission change writes to `audit_logs` |
| T-0111 | Base layout: sidebar shell, permission-filtered navigation, empty dashboard | frontend-engineer | T-0107 | Sidebar renders only the nav items the current user's permissions allow; topbar shows shop name, user, date; dashboard route returns 200 for authenticated users |
| T-0112 | Phase 1 acceptance suite and gate evidence | qa-tester | T-0109, T-0111 | `CashierCannotManageUsersTest` green; full Pest suite green; acceptance session recorded with G1.1–G1.11 evidence attached |

## Risks specific to this phase

CONFLICT-001 is unresolved in the docs today — `brain/01-architecture.md` specifies `database`
queue and `file` cache (no Redis in the shop), while `brain/09-deployment.md` still provisions
and configures Redis. This must be settled by the orchestrator before `.env.example` is written
in T-0102a, because every later phase's queue-dependent work (CSV import, print jobs, summary
rebuilds) inherits whichever driver is chosen here, and retrofitting a queue driver after jobs
are written is wasted work.

> **Cave law:** money is `decimal(12,2)`, never float. No money column exists yet in Phase 1,
> but the money value object and formatting baseline set here is what fifty later migrations and
> views inherit without re-examination — get the type and the display convention right now.

Getting the migration conventions wrong here (id type, timestamp type, actor columns, index
rules) is expensive precisely because Phase 2 and Phase 3 tables are designed against them
without re-derivation; a mistake surfaces as a Phase 3 migration correction on a table that has
already run, which is itself an escalation trigger per `agents/README.md` §4.

Auth and role scaffolding is the one piece of Phase 1 that security-auditor must sign off before
the gate closes — a permission gap here is invisible until Phase 4 exposes cost data to a
cashier.

## Definition of done

Per `workflow/definition-of-done.md` universal checklist, plus:

- [ ] Every acceptance criterion above actually run, not reasoned about.
- [ ] `vendor/bin/pint --test` and `vendor/bin/phpstan analyse` (level 6+) both exit 0.
- [ ] `php artisan migrate:refresh --force` succeeds; every `down()` is real.
- [ ] Full Pest suite green on PostgreSQL 16 — never SQLite.
- [ ] No `env()` call outside `config/**`.
- [ ] `.env.example` complete, secret-free, and Redis-free (CONFLICT-001 resolved).
- [ ] `permissions:check` exits 0; no orphan `can:` string.
- [ ] `brain/02-database-schema.md`, `brain/09-deployment.md`, `brain/01-architecture.md` all
      consistent with what was actually built.
- [ ] `logs/build-log.md` has one entry per task, on start and on completion.
- [ ] `PHASE GATE — Phase 1 (Foundation)` signoff written by the orchestrator, evidenced by
      qa-tester's acceptance run and security-auditor's confirmation of no permission gap, before
      any Phase 2 task leaves `blocked`.
