# ADR-0001 — PHP 8.3, Laravel 12 and PostgreSQL 16 as the platform

Purpose: record why the system is built on PHP 8.3 with Laravel 12 over PostgreSQL 16, and why the database choice in particular is load-bearing rather than incidental.

**Status:** Accepted
**Date:** 2026-08-24
**Deciders:** orchestrator, db-architect
**Supersedes:** none
**Related:** `brain/01-architecture.md`, `brain/02-database-schema.md`, ADR-0003, ADR-0004, ADR-0006, T-0101

## Context

Metapharsic Pharmacy is a single-shop retail system that must be correct about three things
that most small business software gets away with being approximately right about: stock
quantity under concurrent sale, money to the paisa, and an unbroken statutory invoice series.

The constraints that bear on the platform choice:

- **Concurrency is small but sharp.** Three to five concurrent users, but two cashiers reaching
  for the last strip of a medicine is a weekly event, not a theoretical race. Correctness under
  that race must be structural, not hopeful.
- **The money path must not use floating point anywhere**, from the column type through the
  driver to the PHP value.
- **The system is regulated and audited.** Old and new values of watched changes must be stored
  and queried later, potentially years later, by columns nobody has thought of yet.
- **It is LAN-hosted on a machine in a shop**, maintained by whoever the owner can find. It must
  be ordinary to install, ordinary to back up, and ordinary to hire for.
- **It will be built by a small agent team against a written design**, so a framework with
  strong conventions is worth more than a framework with strong flexibility.

The realistic candidates were a PHP framework on a relational database, a JavaScript stack, and
buying an existing Indian pharmacy package.

## Decision

The system is built on **PHP 8.3**, **Laravel 12**, and **PostgreSQL 16**, with Blade, Alpine.js
and Tailwind on the front end and Vite for asset building.

PostgreSQL is not an interchangeable detail of this decision. Four of its behaviours are relied
on by design, and code is written assuming them:

| PostgreSQL feature | What depends on it |
|---|---|
| `numeric(p,s)` as a true fixed-point decimal, returned by the driver as a string, never coerced to a float | Every money column, and the whole of ADR-0004. There is no silent widening to a binary float anywhere between the column and the PHP value |
| `SELECT … FOR UPDATE` with predictable row-level locking, and `SKIP LOCKED` available when we want it | FEFO allocation (ADR-0002) and the invoice counter increment (ADR-0006). The last-strip race is resolved by the database, not by application-level optimism |
| Real, enforced `CHECK` constraints and rich unique/partial indexes | `quantity_available >= 0`, `round_off BETWEEN -0.50 AND 0.50`, `gst_rate IN (0,5,12,18)`, `selling_price <= mrp`, unique `(medicine_id, batch_no, expiry_date)`. Invariants the database holds regardless of which code path writes the row |
| `jsonb` with indexing and containment operators | `audit_logs.old_values` / `new_values`. An inspection asks questions of the audit trail that were not anticipated when the row was written; `jsonb` answers them without a schema migration |

Additionally: transactional DDL (a failed migration leaves no half-applied schema), `timestamptz`
with correct `Asia/Kolkata` handling, and trigram indexing for the POS medicine search.

PHP 8.3 supplies typed properties, readonly promoted constructor properties, and backed enums —
the three features `brain/04-coding-standards.md` leans on to keep domain state closed and
immutable. Laravel 12 supplies the transaction API, the queue and scheduler for nightly work
(`stock:verify`, backups, summary rebuild), Eloquent with explicit casts, policies and gates for
the role matrix, and a testing story (Pest 3) that runs against real PostgreSQL.

## Consequences

### Positive

| Consequence | Why it matters here |
|---|---|
| Correctness primitives live in the database | Oversell, duplicate invoice numbers, and negative stock are prevented by locks and constraints, not by remembering to check. A bug in one service cannot corrupt the invariant |
| Money never touches a float | The single most common failure mode in retail software is structurally excluded |
| The audit trail is queryable | `jsonb` containment answers an inspector's question in minutes, without a migration |
| Conventional, hireable stack | A LAMP-shaped deployment on a shop machine; nginx, php-fpm, `pg_dump`. Any competent local developer can maintain it |
| Strong framework conventions suit an agent team | Nine agents writing to one written design need one obvious way to do each thing |
| Tests run on the production engine | `brain/07-testing-strategy.md` forbids SQLite precisely because locking semantics differ; PostgreSQL in CI tests the program we ship |

### Negative

| Consequence | What it costs, and how we live with it |
|---|---|
| PostgreSQL is less commonly deployed on small Indian shop machines than MySQL | The operator must learn `pg_dump`, `psql`, and role management. Mitigated by `brain/09-deployment.md` documenting the exact commands, and by the restore drill in T-0603 being a gate condition, not advice |
| We are tied to PostgreSQL-specific SQL | Locking hints, `jsonb`, partial indexes and trigram search are not portable. Accepted deliberately: portability was never a requirement, and pretending otherwise would cost us the features above |
| Pessimistic locking limits future scale | Row locks on batch allocation would become a bottleneck at hundreds of concurrent cashiers. Irrelevant at 3–5 users, and the correctness gain is total. Revisit only if this becomes multi-store |
| PHP is not the fastest option for report aggregation | Mitigated by pushing aggregation into SQL and into `daily_sales_summary`, not by rewriting in another language |
| Blade + Alpine is less capable than a full SPA for the POS | Accepted: the POS is a keyboard-driven grid, not an application shell. It also keeps the billing path free of an API round trip and a build-time framework dependency |

## Alternatives considered

### Laravel 12 on MySQL 8

**The case for it.** MySQL is the default assumption of the PHP ecosystem and of Indian shared
hosting. More local developers know it. InnoDB supports `SELECT … FOR UPDATE`. `DECIMAL` is a
true fixed-point type. Backups are trivially familiar. Every Laravel tutorial assumes it.

**Why rejected.** The gap is not in the headline features but in the edges this system lives on.
MySQL's `CHECK` constraint support arrived late and is easy to lose across engines and versions,
where our design leans on constraints as the last line of defence behind `InventoryService`.
Its JSON type lacks `jsonb`'s indexing and containment operators, which is exactly the shape of
query an audit investigation makes. DDL is not transactional, so a failed migration on the shop's
machine can leave a half-applied schema — a real risk when the person running the deploy is not
the person who wrote it. Locking behaviour around gap locks and next-key locks under
`REPEATABLE READ` is subtler to reason about than PostgreSQL's row locks, and the whole FEFO
design is an argument about exactly which rows are locked. None of these alone would decide it;
together they mean writing the same system with a thinner safety net for a benefit —
familiarity — that we can buy with documentation instead.

### Symfony 7 with Doctrine

**The case for it.** Stricter architecture, a mature ORM with a real unit of work and explicit
mapping, better suited to a domain-driven design, and a strong European track record in
regulated business software. Doctrine's identity map and transactional write-behind fit a
service-heavy design well.

**Why rejected.** The cost is time and team fit, not capability. Doctrine's mapping and lifecycle
add a layer of indirection over exactly the operations we most need to reason about precisely —
what row is locked, at what moment, in which transaction. Laravel's thinner query builder makes
`lockForUpdate()` and the exact SQL visible at the call site, which for this system is a feature.
Laravel also ships the scheduler, queue, and testing integration we need without assembly. Symfony
would be the better choice for a larger, longer-lived domain model; this is a single-shop system
with a written design and a fixed scope.

### Node.js with NestJS and Prisma or TypeORM

**The case for it.** One language across front and back end, excellent tooling, strong typing
through TypeScript, and a natural fit if the POS ever became a rich offline-capable client.

**Why rejected.** Three concrete problems. First, money: the JavaScript ecosystem's default
numeric type is a binary float, and every ORM boundary becomes a place where a `numeric` column
can silently arrive as a `number` — the failure this system most needs to structurally exclude,
now depending on developer vigilance at every boundary instead. Second, the deployment target: a
shop machine with a process manager and a cron is a worse fit for a Node process tree than for
nginx and php-fpm, and the local maintenance pool is smaller. Third, the write path is
transaction-heavy and locking-heavy, which is not where the asynchronous model pays off — it is
where it adds ways to get it wrong. The offline-capable client that would justify the choice is
explicitly out of v1 scope.

### Buying an off-the-shelf Indian pharmacy package

**The case for it.** Cheapest and fastest by a wide margin. GST invoicing, batch and expiry
tracking, and Schedule H handling already built and already used by thousands of shops. No build
risk, no maintenance burden, vendor-supplied compliance updates when tax rules change.

**Why rejected.** This was considered seriously and the rejection is deliberate, not reflexive.
The packages surveyed are opaque about exactly the things this design treats as non-negotiable:
whether stock has one write path, whether a saved sale can be edited by an administrator,
whether profit is computed from snapshot cost or from today's batch price, and what the audit
trail actually retains. Those are unanswerable from outside, and each of them is the difference
between books that reconcile and books that drift. Data is typically held in a proprietary schema
with export as an afterthought, which makes migrating away later a second, worse version of the
same problem. The shop's own workflow — free-goods schemes, its particular credit customers,
its expiry-return relationship with suppliers — is where the money is saved, and it is exactly
what a package will not bend to. The decision accepts a build cost in exchange for owning the
data and the invariants. It would be reversed if the shop's requirement were simply "issue a GST
bill".

## Cave laws created or reinforced

| # | Law | Where it is enforced |
|---|---|---|
| — | Money is `decimal(12,2)`. Never float. Ever. | `numeric(12,2)` columns; driver returns strings; ADR-0004 |
| 4 | FEFO with a row lock | `SELECT … FOR UPDATE` inside a transaction, PostgreSQL row locking |
| 7 | `batch.quantity_available` equals `SUM(stock_transactions.quantity_change)` | `CHECK` constraints plus `php artisan stock:verify` |
| — | Tests run on real PostgreSQL 16, never SQLite | `brain/07-testing-strategy.md`; CI step 1 |

## Revisit conditions

- The shop becomes multi-store or multi-state, and row-lock contention or a single-writer
  database becomes a measured bottleneck.
- A statutory e-invoicing obligation (Q-008) forces an external dependency into the billing path,
  changing the architecture's assumptions about network independence.
- PostgreSQL 16 becomes unavailable or unsupportable on the shop's hardware.
