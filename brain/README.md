# brain/ — Durable Truth

Purpose: explain what lives in `brain/`, what must never live here, and how to add to it.

## What `brain/` is

`brain/` is the project's long-memory. It holds the reasoning and the rules that a reader
cannot recover by opening the codebase: why PostgreSQL and not MySQL, why stock may only
move through one table, why a cashier's query must never select a cost column.

> **Cave law:** if a fact is derivable from code, it does not go in `brain/`. `brain/` holds
> *why* and *must*, never *what the code currently says*.

Column lists, method signatures, route URIs as-implemented, and config values are derivable.
They belong in code, in migrations, or in `php artisan route:list` output. What belongs here
is the constraint behind them — "invoice numbers come from a locked counter row, never
`count() + 1`" — which survives every refactor.

Read `CLAUDE.md` first, then `brain/state/CURRENT_PHASE.md`, then the `brain/` files your
task touches and any ADR they reference.

## The numbered-file convention

Files are numbered `NN-kebab-case-topic.md`, read in order by a newcomer. The number encodes
reading order, not importance and not phase. Numbers are never reused and never renumbered:
a retired document is marked superseded in its own body and left in place, because commit
messages, ADRs, and the build log reference it by filename.

Every brain file opens with an H1 title and a one-line `Purpose:` statement. `> **Cave law:**`
blockquotes mark rules that must not be broken — that callout is reserved for
non-negotiables, so they stay greppable.

## How to add a new brain doc

1. Check it is not derivable from code. If it is, write a docblock instead.
2. Check it does not belong in an existing file. Prefer growing a file over adding one.
3. Take the next free number. Add an H1, a `Purpose:` line, and the content.
4. Add a row to the index table below in the same commit.
5. If the document records a choice that was genuinely reversible-once — a choice a future
   reader will want to re-litigate — write an ADR in `brain/decisions/` and link it from the
   document rather than arguing the case inline.
6. If your change makes another brain file wrong, fix that file in the same commit. A stale
   brain is worse than no brain.

## Index

| Path | Holds |
|---|---|
| `brain/README.md` | This file: what `brain/` is and how to extend it |
| `brain/00-project-overview.md` | The product, its users, scope boundaries, phase plan |
| `brain/01-architecture.md` | Layers, module map, request lifecycle, key runtime decisions |
| `brain/02-database-schema.md` | Tables, relationships, indexes, and the reasoning behind them |
| `brain/03-domain-rules.md` | The eight cave laws expanded: FEFO, ledger, GST, credit, returns |
| `brain/04-coding-standards.md` | PHP/Laravel conventions, enums, money, exceptions, git rules |
| `brain/05-routes-and-modules.md` | Route inventory, permission keys, module ownership boundaries |
| `brain/06-ui-conventions.md` | Layout shells, POS keyboard contract, colour semantics, print layouts |
| `brain/07-testing-strategy.md` | Pest strategy, the non-negotiable test list, CI pipeline |
| `brain/08-security-and-audit.md` | Auth, permission matrix, audit log design, regulatory duties |
| `brain/09-deployment.md` | Server build, deploy and rollback, backup and restore drill, monitoring |
| `brain/decisions/` | ADRs — one file per irreversible choice, never edited after Accepted |
| `brain/state/` | `CURRENT_PHASE.md`, backlog, open questions — the only files that churn |

## Accepted ADRs

| ADR | Subject |
|---|---|
| ADR-0001 | Laravel 12 + PostgreSQL 16 as the platform |
| ADR-0002 | Batch model and FEFO allocation |
| ADR-0003 | Single-door stock ledger (`stock_transactions`) |
| ADR-0004 | Money representation |
| ADR-0005 | Immutable sales |
| ADR-0006 | Invoice numbering |
