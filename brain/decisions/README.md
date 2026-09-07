# Architecture Decision Records

Purpose: explain what an ADR is here, when one is mandatory, how they are numbered, how their lifecycle works, and index the decisions already accepted.

---

## 1. What an ADR is

An ADR records one choice: the situation that forced it, what was chosen, what that costs, and
what was rejected and why. It is written for the reader who arrives in a year and asks "why is
it like this?" — and who, without the ADR, will assume the answer is "nobody thought about it"
and change it.

An ADR is **not** documentation of how the system works. That lives in `brain/`. The ADR is the
argument; the brain doc is the rule that resulted. Where the two meet, the brain doc links to
the ADR and does not restate the argument.

## 2. When an ADR is required

> **Cave law:** any choice that is irreversible, or expensive to reverse, gets an ADR **before**
> the code that depends on it is written. Not after, not "when it settles down". An undocumented
> irreversible choice is a trap set for a future maintainer.

Required for:

| Trigger | Examples |
|---|---|
| A choice baked into the schema | Money type, quantity precision, where quantity lives, ledger design, invoice-number storage |
| A choice baked into data that will exist | Immutability of sales, audit retention, the shape of stored history |
| A platform or dependency that would be costly to swap | Database engine, framework, a library that touches every money calculation |
| A concurrency or transaction strategy | Pessimistic row locking for allocation, lock ordering, isolation level |
| A regulatory interpretation | Invoice series structure, what the tax invoice must carry, what may never be deleted |
| A deliberate exclusion from v1 | No `store_id`, no offline client — because the cost is paid later and must be visible |

Not required for: naming, formatting, directory layout, a library that could be swapped in an
afternoon, or anything already settled by a cave law. Those belong in `brain/04-coding-standards.md`.

If you are unsure, ask: *if we change our mind in six months, does it cost a day or a migration
of live money data?* A migration of live money data means write the ADR.

## 3. Numbering

- `ADR-NNNN-kebab-case-title.md`, four digits, allocated in strict order from 0001.
- Numbers are never reused, never renumbered, and never skipped to leave room.
- A rejected proposal keeps its number, with status `Rejected` and the reason. The number is
  spent whether or not the decision was taken.
- `ADR-template.md` is not a number and is not an ADR.

## 4. Lifecycle

```
Proposed ──accepted──▶ Accepted ──replaced by ADR-NNNN──▶ Superseded
    │
    └──rejected──▶ Rejected (kept, with the reason)
```

| Status | Meaning | Who may set it |
|---|---|---|
| **Proposed** | Written and under discussion. It may be edited freely while in this state | Any agent |
| **Accepted** | The decision is in force. Code and brain docs must obey it | orchestrator, with the named specialist decider |
| **Superseded** | A later ADR replaced it. The body is untouched; only the status line and a "Superseded by ADR-NNNN" pointer are added | orchestrator |
| **Rejected** | Considered and not taken. Kept so it is not re-proposed | orchestrator |

> **Cave law:** an Accepted ADR is never edited. Not to fix its reasoning, not to add a
> consequence discovered later, not to "bring it up to date". If the decision changes, write a
> new ADR that supersedes it. The record of what we believed, and when, is the point of the file;
> editing it destroys exactly the thing it exists to preserve.

The two permitted modifications to an Accepted ADR are mechanical: changing `Status: Accepted`
to `Status: Superseded by ADR-NNNN`, and fixing a typo that changes no meaning.

## 5. How to write one

1. Copy `ADR-template.md` to the next free number.
2. Write the context as the problem, not as the solution with the reasoning removed.
3. State the decision in the present tense: "Money is stored as `numeric(12,2)`", not "we will use".
4. Write the negative consequences honestly. An ADR with only positive consequences was not a
   decision, it was a preference.
5. List the alternatives that were genuinely considered, and give each one the strongest version
   of its case before saying why it lost. A straw man in an alternatives section means the
   decision gets re-litigated by the next reader, who will notice.
6. Name the cave laws the decision creates or depends on.
7. Set status `Accepted`, add a row to the index below, and append a line to
   `logs/decisions.log.md` — all in the same change.

## 6. Index

| ADR | Title | Status | Date | Deciders |
|---|---|---|---|---|
| [ADR-0001](ADR-0001-laravel-postgres.md) | PHP 8.3, Laravel 12 and PostgreSQL 16 as the platform | Accepted | 2026-08-24 | orchestrator, db-architect |
| [ADR-0002](ADR-0002-batch-model-and-fefo.md) | Quantity, expiry and price live on batches; allocation is FEFO | Accepted | 2026-08-24 | orchestrator, pharmacy-domain |
| [ADR-0003](ADR-0003-single-door-stock-ledger.md) | One door for stock: `stock_transactions` via `InventoryService` | Accepted | 2026-08-24 | orchestrator, backend-engineer |
| [ADR-0004](ADR-0004-money-representation.md) | Money is `numeric(12,2)` with a money value object in PHP | Accepted | 2026-08-24 | orchestrator, pharmacy-domain |
| [ADR-0005](ADR-0005-immutable-sales.md) | Sales are immutable; corrections are reversing transactions | Accepted | 2026-08-24 | orchestrator, security-auditor |
| [ADR-0006](ADR-0006-invoice-numbering.md) | Invoice numbers from a locked `invoice_counters` row per financial year | Accepted | 2026-08-24 | orchestrator, pos-specialist |
| [ADR-0007](ADR-0007-concurrency-and-scale.md) | Concurrency and scale at 4+ POS terminals: counter and FEFO lock discipline | Accepted | 2026-08-24 | orchestrator, db-architect |

No ADR is currently Proposed, Superseded, or Rejected.

Every line above is mirrored in `logs/decisions.log.md`, which is the append-only chronological
record. This table is the navigable index; that log is the history.
