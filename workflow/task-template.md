# Task Template

Purpose: give every task the same shape, so an agent can start work from the task file alone and a reviewer can tell whether it was finished.

---

## 1. Rules for writing a task

| Rule | Reason |
|---|---|
| One owning agent, one phase, one coherent outcome | Two owners means no owner; two phases means it starts early |
| Acceptance criteria are checkable by a machine or by a named observation | "Works well" cannot be reviewed |
| Out-of-scope is written explicitly, not left to inference | Scope creep is the main way a phase gate slips |
| Cave laws in play are named by number | The reviewer checks exactly those, plus the universal set |
| Escalation triggers are written before work starts | An agent under pressure will not invent the right moment to stop |
| Task IDs are `T-PPNN` — phase, then sequence | `T-0403` is the third task of Phase 4. IDs are never reused |

The task file lives with the backlog row it corresponds to. The orchestrator writes it; the
owning agent appends the handoff block from `workflow/handoff-protocol.md` §3 when finished.

---

## 2. The template

Copy everything between the fences.

````markdown
# T-XXXX — <short imperative title>

**Phase:** <N — Name>
**Owning agent:** <agent>
**Reviewer:** <a different agent>
**Status:** todo | in-progress | blocked | review | done
**Blocked by:** <task IDs, question IDs, or none>
**Created:** YYYY-MM-DD

## Context
Two to five sentences: what exists now, what this task changes, and why it is needed in this
phase rather than a later one.

## Read first
| Document | Why |
|---|---|
| CLAUDE.md | House rules and the eight cave laws |
| brain/state/CURRENT_PHASE.md | What is in scope right now |
| <brain doc> | <the specific reason> |
| <ADR> | <the decision this task must obey> |

## Scope — paths this task may create or modify
- `<glob>`
- `<glob>`

Everything else is read-only for this task.

## Acceptance criteria
| # | Criterion | How it is checked |
|---|---|---|
| A1 | <observable statement> | <command, test file, or named observation> |
| A2 | | |

## Out of scope
- <thing that looks adjacent and is deliberately not done here, and where it belongs instead>

## Cave laws in play
| # | Law | How this task satisfies it |
|---|---|---|
| <n> | <law text, short> | <the concrete mechanism> |

## Escalation triggers
Stop and return to the orchestrator if:
- <condition>
- <condition>

## Log entries required
- `logs/build-log.md` — one entry on start, one on completion
- `logs/decisions.log.md` + an ADR — only if an irreversible choice is made
- `logs/changelog.md` — <yes/no, and under which heading>

## Definition of Done
`workflow/definition-of-done.md`, universal section plus: <named per-layer sections>.

## Handoff
<appended by the owning agent — see workflow/handoff-protocol.md §3>
````

---

## 3. Worked example

The following is a real, ready-to-issue task: the first task of the project.

---

# T-0101 — Initialize the Laravel 12 project with a PostgreSQL 16 connection

**Phase:** 1 — Foundation
**Owning agent:** devops
**Reviewer:** db-architect
**Status:** todo
**Blocked by:** none
**Created:** 2026-08-24

## Context

The repository currently contains documentation only — no application code exists. This task
creates the Laravel 12 skeleton on PHP 8.3 and connects it to PostgreSQL 16, and nothing more.
It is first because every other Phase 1 task needs a bootable application and a working
database connection, and because the choice of database driver is load-bearing for the whole
design: `SELECT … FOR UPDATE`, `jsonb`, CHECK constraints, and `numeric` all come from
PostgreSQL specifically (ADR-0001). SQLite must not appear anywhere, including in the test
configuration, because a suite that runs on different locking semantics tests a different
program.

## Read first

| Document | Why |
|---|---|
| `CLAUDE.md` | House rules, the eight cave laws, how to work here |
| `brain/state/CURRENT_PHASE.md` | Phase 1 scope and exit gate |
| `brain/decisions/ADR-0001-laravel-postgres.md` | Why PostgreSQL, and which of its features the design depends on |
| `brain/01-architecture.md` §1–2 | Directory layout and layer boundaries the skeleton must match |
| `brain/02-database-schema.md` §1 | Column conventions every later migration inherits |
| `brain/04-coding-standards.md` §1–2 | `declare(strict_types=1)`, Pint and PHPStan expectations |
| `brain/09-deployment.md` | Environment variables this task must place in `.env.example` |

## Scope — paths this task may create or modify

- `composer.json`, `composer.lock`, `package.json`, `package-lock.json`
- `.env.example`, `.gitignore`, `README.md` (project root only)
- `config/**`
- `app/Providers/**`
- `bootstrap/**`, `public/**`, `artisan`
- `database/database.sqlite` — **must not exist**; delete it if the installer creates it

Out of these paths, this task writes nothing.

## Acceptance criteria

| # | Criterion | How it is checked |
|---|---|---|
| A1 | Laravel 12 installed and boots on PHP 8.3 | `php artisan --version` prints a 12.x version; `php -v` reports 8.3 |
| A2 | Default connection is `pgsql` against PostgreSQL 16 | `php artisan tinker --execute="echo DB::connection()->getDriverName();"` prints `pgsql`; `SELECT version()` reports 16.x |
| A3 | The framework's default migrations run and roll back cleanly | `php artisan migrate --force` then `php artisan migrate:rollback --force`, both exit 0 |
| A4 | No SQLite anywhere | `database/database.sqlite` absent; no `sqlite` value in `config/database.php` defaults, `.env.example`, or `phpunit.xml` |
| A5 | A second connection `pgsql_test_b` exists, pointing at the test database with separate credentials resolution | Present in `config/database.php`; `DB::connection('pgsql_test_b')->getPdo()` succeeds. Required by the Phase 4 concurrency tests |
| A6 | `.env.example` is complete and secret-free | Every key read by `config/**` has an entry; no real password, host, or key is committed |
| A7 | `env()` is called only inside `config/**` | `grep -rn "env(" app/ resources/ routes/` returns nothing |
| A8 | The application responds on the welcome route with the database up, and fails loudly — not silently — with the database down | Manual check, both states, recorded in the handoff |

## Out of scope

- Timezone, locale, and INR formatting — **T-0102**.
- Pint, PHPStan, and Pest configuration — **T-0103**. This task must not add a linter config.
- The CI workflow file — **T-0104**.
- Any domain migration or model. `users` and friends belong to **T-0106**; the framework's own
  default migrations are acceptable only because A3 needs something to run.
- Authentication scaffolding — **T-0107**.
- Any Tailwind or layout work — **T-0111**.

## Cave laws in play

| # | Law | How this task satisfies it |
|---|---|---|
| — | Money is `decimal(12,2)`, never float | No money column is created here, but `config/database.php` must not enable any float-coercing option, and the reviewer confirms the driver returns `numeric` as string, not float |
| 1 | One door for stock | Not yet applicable — but no seeder, no fake stock data, and no convenience helper that writes quantities may be introduced |

The task's real obligation is the one behind the laws: everything it configures becomes the
default that fifty later migrations inherit without re-examination.

## Escalation triggers

Stop and return to the orchestrator if:

- PostgreSQL 16 is not available in the target environment and only an older major version is,
  because ADR-0001's assumptions about `numeric` and locking behaviour must then be re-checked.
- Laravel 12 requires a PHP version other than 8.3 for a dependency in the intended stack.
- The install pulls a package that writes to `database/` or defaults to SQLite in a way that
  cannot be removed by configuration.
- Any decision arises about connection pooling, transaction isolation level, or statement
  timeouts — those are ADR-worthy and are not settled inside a setup task.

## Log entries required

- `logs/build-log.md` — one entry when work starts, one on completion, both `[devops] [T-0101]`.
- `logs/decisions.log.md` — none expected; ADR-0001 already records the platform choice. Any
  new irreversible choice triggers an escalation first (see above).
- `logs/changelog.md` — yes, under `## [Unreleased]` → `### Added`: "Laravel 12 application
  skeleton on PHP 8.3 with a PostgreSQL 16 connection."

## Definition of Done

`workflow/definition-of-done.md`, universal section plus the **Deployment / configuration
change** section. The migration, service, controller, view, POS, and test sections do not apply
to this task.

## Handoff

*(appended by devops on completion — see `workflow/handoff-protocol.md` §3)*
