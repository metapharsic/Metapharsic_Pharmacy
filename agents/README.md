# Agents — Roster and Boundaries

Purpose: name every agent that builds Metapharsic Pharmacy, state exactly which file paths each
one may write, and define what an agent does when it reaches the edge of its authority.

Read `CLAUDE.md` first, then `brain/state/CURRENT_PHASE.md`, then this file. An agent that has
not read its charter is not qualified to write in this repository.

---

## 1. The model

One orchestrator, eight specialists, one shared brain.

- **One orchestrator.** It plans, sequences, gates phases, numbers ADRs, arbitrates conflicts,
  and maintains `brain/state/`. It writes no application code — not a controller, not a
  migration, not a Blade file. Its output is decisions, task briefs, and state.
- **Specialists with narrow write-scopes.** Each specialist owns a small, explicit set of paths.
  Outside that set it may read anything and write nothing. A specialist that "just quickly
  fixes" a file it does not own has created a merge conflict, a silent overwrite, or a rule
  broken by someone who never read the rule.
- **One shared brain.** Every agent reads the same `brain/`. `brain/` is the contract between
  agents: if two agents disagree, the disagreement is settled in `brain/` (or in an ADR) and
  only then in code. Nothing is "understood between us" — it is written down or it does not
  exist.

Agents do not talk to each other directly. Work moves through the orchestrator: brief in,
handoff out. That keeps a single ordered history in `logs/build-log.md` and means no agent has
to hold another agent's state in its head.

---

## 2. Roster

| Agent | Mission | May write | Must read first | Phases |
|---|---|---|---|---|
| [`orchestrator`](orchestrator.md) | Plan, sequence, gate phases, arbitrate ownership conflicts, own ADR numbering | `brain/state/**`, `brain/decisions/**`, `brain/README.md`, `brain/00`, `brain/01`, `brain/04`, `brain/05`, `workflow/**`, `agents/**`, `logs/**` | `CLAUDE.md`, `CAVEMAN_DESIGN.md`, all of `brain/` | 1–6 |
| [`db-architect`](db-architect.md) | Design and evolve the PostgreSQL schema; keep the schema document true | `database/migrations/**`, `database/seeders/**` (except the role/permission and demo seeders), `brain/02-database-schema.md` | `CLAUDE.md`, `brain/02`, `brain/01` §4, `brain/03`, `brain/09` §4 | 1–6 (peak 1, 3, 4) |
| [`backend-engineer`](backend-engineer.md) | Build the service layer, controllers, requests, models, enums and domain exceptions | `app/**` (except `app/Policies/`, `app/Http/Middleware/`, `app/Providers/AuthServiceProvider.php`, `StockVerifyCommand.php`, `BackupRunCommand.php`), `routes/**`, `config/**` | `CLAUDE.md`, `brain/01`, `brain/03`, `brain/04`, `brain/05` | 1–6 |
| [`pharmacy-domain`](pharmacy-domain.md) | Own the domain rules and review every FEFO, expiry, GST, prescription, credit and profit change | `brain/03-domain-rules.md` only | `CLAUDE.md`, `CAVEMAN_DESIGN.md`, `brain/03`, `brain/02` §4, `brain/08` §5 | 1–6 (authoring 1, 3; review continuous) |
| [`frontend-engineer`](frontend-engineer.md) | Build the non-POS UI: layouts, components, forms, lists, dashboards | `resources/views/**` (except `pos/` and the two print layouts), `resources/js/**` (except `pos/`), `resources/css/**`, `brain/06-ui-conventions.md` | `CLAUDE.md`, `brain/06`, `brain/05`, `brain/08` §2 | 1–6 |
| [`pos-specialist`](pos-specialist.md) | Build and hold the POS screen, its keyboard contract, cart state and print layouts | `resources/views/pos/**`, `resources/views/layouts/print-a4.blade.php`, `resources/views/layouts/print-thermal.blade.php`, `resources/js/pos/**`, `resources/js/alpine/posCart.js` | `CLAUDE.md`, `brain/06` §2, §5, §7, `brain/03` §2–§6, `brain/01` §7 | 4–6 |
| [`qa-tester`](qa-tester.md) | Own the test suite, the ten non-negotiable tests, factories, demo data and `stock:verify` | `tests/**`, `brain/07-testing-strategy.md`, `database/factories/**`, `database/seeders/DemoDataSeeder.php`, `app/Console/Commands/StockVerifyCommand.php` | `CLAUDE.md`, `brain/07`, `brain/03`, `brain/02` §9 | 1–6 |
| [`security-auditor`](security-auditor.md) | Own authorization, the permission matrix, audit logging and cost-visibility | `app/Policies/**`, `app/Http/Middleware/**`, `app/Providers/AuthServiceProvider.php`, `database/seeders/{Role,Permission,PermissionRole}Seeder.php`, `brain/08-security-and-audit.md` | `CLAUDE.md`, `brain/08`, `brain/05` §3, `brain/02` §9 | 1–6 (peak 1, 4, 5) |
| [`devops`](devops.md) | Own the server build, deploy, CI, backup and the tested restore drill | `deploy/**`, `.github/workflows/**`, `.env.example`, `app/Console/Commands/BackupRunCommand.php`, `brain/09-deployment.md` | `CLAUDE.md`, `brain/09`, `brain/07` §7, `brain/02` §12 | 1 (CI), 3, 6 (server, backup, restore) |

Models: `opus` for `orchestrator`, `db-architect` and `pharmacy-domain` — the roles whose
mistakes are expensive and hard to reverse (schema, sequencing, domain rules). `sonnet` for the
rest, whose work is bounded by a specification someone else already reasoned through.

---

## 2a. Phase 8 — Gap Closure (roster reuse, no new role)

Phase 8 closes five feature gaps identified via competitive field-inventory research
(vendor names withheld per project convention): 8a scheme/offer engine, 8b prescription
image/scan attach, 8c a separate doctor master table, 8d a fast/slow-mover report page,
and 8e a drug license number field with renewal reminder.

All five sub-phases are owned by the existing nine-agent roster in the table above —
`orchestrator`, `db-architect`, `backend-engineer`, `pharmacy-domain`, `frontend-engineer`,
`pos-specialist`, `qa-tester`, `security-auditor`, `devops` — each within its existing
write-scope (e.g. `db-architect` for the `schemes`/`doctors`/license migrations,
`backend-engineer` for the service/controller layer, `frontend-engineer` for the
mover-report view and doctor CRUD screens, `pharmacy-domain` for discount-ordering review
under the money-math escalation rule, `qa-tester` for the five sub-phases' test coverage).
**No new agent role is introduced for Phase 8.** See `brain/11-gap-closure-architecture.md`
for the full technical scoping and `brain/checkpoints/checkpoint_phase8_gap_closure_kickoff.md`
for kickoff status.

---

## 3. The ownership rule

> **Cave law:** exactly one agent owns a file path. Two agents never write the same file. If a
> change spans two owners, it goes through the orchestrator, not around it.

Consequences, stated so nobody has to infer them:

- **Ownership is by path, not by topic.** `app/Models/Sale.php` has one owner
  (`backend-engineer`) even though `db-architect` cares about its casts and `security-auditor`
  cares about its `$hidden` array.
- **Interest without ownership is exercised as review, not as an edit.** `db-architect`
  specifies schema-facing model concerns — casts, relations, `$hidden` cost columns, scopes that
  name a column — in `brain/02-database-schema.md`, and reviews those hunks.
  `backend-engineer` types them. A reviewer who disagrees blocks; it does not patch.
- **A shared document has a named owner and a patch path.** `brain/06-ui-conventions.md` is
  owned by `frontend-engineer`, but §2 (the POS keyboard contract) is `pos-specialist`'s
  subject matter. `pos-specialist` submits the proposed wording in its handoff; the owner
  applies it verbatim or escalates the disagreement. The same pattern covers §7 print layouts.
- **Leases exist and are always written down.** The orchestrator may lease a path to a second
  agent for one task — most commonly `tests/**` to `backend-engineer` when implementation and
  tests are delivered together. The lease names the exact files, the task, and its expiry, and
  it lives in the task file. An unwritten lease is not a lease; assume you do not have one.
- **Nobody owns `logs/build-log.md` exclusively.** It is append-only and every agent appends to
  it. Appending is not editing: never rewrite or delete another agent's entry.

Path carve-outs are deliberate and each is listed in the owning agent's charter. When a new path
appears that no charter names, the orchestrator assigns it before anyone writes there.

---

## 4. Escalation

An agent stops and raises an open question in `brain/state/OPEN_QUESTIONS.md` — via the
orchestrator — instead of choosing for itself, whenever any of the following is true.

**Always escalate:**

1. **Schema change to a table whose migration has already run** anywhere other than a local
   scratch database. Forward-only, expand-then-contract, new migration — and the orchestrator
   decides whether the release needs a pre-deploy dump. Never edit a migration that has run.
2. **A conflict with one of the eight cave laws**, or a proposed rule that would need a ninth.
   Cave laws are not renegotiated inside a task.
3. **An irreversible choice** — anything that would be expensive to undo once real data exists:
   an identifier format, a rounding convention, a retention period, a numbering series, a
   dependency added to the billing path. These become ADRs, and only the orchestrator numbers
   ADRs.
4. **Money math.** Rounding placement, the CGST/SGST split, discount ordering, `round_off`,
   `effective_cost`, `cost_price_at_sale`, credit-limit arithmetic. `pharmacy-domain` rules on
   the semantics; the orchestrator records the outcome.
5. **Stock ledger semantics.** A new `StockTransactionType`, a change to `balance_after`, a
   reversal that is not a mirrored row, anything that would let `quantity_available` move
   outside `InventoryService::apply()`, or any proposal to "correct" a `stock:verify` mismatch
   by writing a number.
6. **A write outside your own paths.** Including "it is one line" and "the owner is idle".
7. **A new or renamed permission key**, or a change to who may see cost. `security-auditor`
   holds a veto here that no other agent may overrule in-task.
8. **Contradiction between two brain documents.** Do not pick the one that suits your task.
   Report both locations and stop.
9. **A performance budget breach** — POS search over 150 ms at p95, a dashboard tile over
   200 ms — that cannot be fixed inside your own scope.
10. **A change to any of the ten non-negotiable tests** in `brain/07-testing-strategy.md`,
    including "temporarily" skipping one to get a build green.

**Do not escalate** an ordinary choice inside your own scope that no document constrains and no
future reader will need explained. Naming a private method, ordering two validation rules,
choosing a Tailwind utility — decide, do the work, and note it if it is interesting. Escalation
is for choices that bind other people; using it for everything is its own failure mode.

An escalation is written as: what you were doing, the two or more options, what each costs,
which documents bear on it, and your recommendation. "What should I do?" is not an escalation.

---

## 5. Invoking an agent, and what it must return

The orchestrator writes a task brief from `workflow/task-template.md` and dispatches exactly one
agent. The brief states: the phase, the goal in one sentence, the paths the agent may write for
this task, the brain sections it must read, the acceptance criteria, and any lease.

Every agent returns a handoff, per `workflow/handoff-protocol.md`:

1. **The change itself**, confined to the paths named in the brief.
2. **Brain updates in the same commit** for any document its change made wrong. A stale brain is
   worse than no brain.
3. **An append to `logs/build-log.md`**: date, agent, phase, what changed, and why.
4. **An ADR plus a line in `logs/decisions.log.md`** if a real decision was made — drafted by the
   agent, numbered and accepted by the orchestrator.
5. **A test specification** for `qa-tester` when behaviour changed: the assertions required, not
   the test code, unless the agent held a lease on `tests/**`.
6. **A review request** naming each agent whose review is mandatory for this change
   (`pharmacy-domain` for domain rules, `security-auditor` for authorization or cost exposure,
   `db-architect` for schema-facing model concerns).
7. **Open questions raised**, each in the escalation format above.

`workflow/handoff-protocol.md`, `workflow/task-template.md` and `workflow/definition-of-done.md`
are owned by the orchestrator and are the authority on the mechanics. This section is the summary
those files expand.

---

## 6. Reading order for a new agent

1. `CLAUDE.md` — the house rules and the eight cave laws.
2. `brain/state/CURRENT_PHASE.md` — what is in scope right now.
3. This file — who owns what.
4. `agents/<your-slug>.md` — your charter, in full, including the prohibitions.
5. The `brain/` documents your charter names, plus any ADR they reference.

Then, and only then, the code.
