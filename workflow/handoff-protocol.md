# Handoff Protocol

Purpose: define the contract between agents — what an agent is given, what it must give back, who owns which paths, and what to do when ownership or scope collides.

---

## 1. The contract in one paragraph

An agent receives a task file and a read-first list, and nothing else is assumed. It works only
inside its declared scope. It returns a completed handoff block: files changed, brain docs
updated, log entries appended, questions raised, and a recommendation for who should pick up
next. Anything the agent learned that is not in that block is lost, because the next agent
starts from the documents, not from the conversation.

> **Cave law:** context lives in files, never in an agent's head. If it is not in the task file,
> the brain, or the log, it does not exist for the next agent.

---

## 2. What an agent receives

The orchestrator hands over exactly these five things, in the task file.

| # | Given | Meaning | If it is missing |
|---|---|---|---|
| 1 | **Task file** | ID, title, phase, owner, acceptance criteria, out-of-scope, cave laws in play, escalation triggers | Refuse the task and ask for it. Do not infer a task from a conversation |
| 2 | **Read-first list** | The specific `brain/` files, ADRs, and prior task IDs that must be read before the first edit | Read `CLAUDE.md` and `brain/state/CURRENT_PHASE.md` at minimum, and raise it as a defect in the task |
| 3 | **Scope** | The exact paths the agent may create or modify, expressed as globs | Treat the scope as empty and ask. Never widen scope silently |
| 4 | **Blockers cleared** | The named tasks and open questions that had to be resolved first, and their state | If a blocker is still open, return the task as `blocked` immediately — do not start and hope |
| 5 | **Definition of Done** | A pointer to `workflow/definition-of-done.md` plus any task-specific additions | The universal checklist applies in full |

An agent must **read before writing**. The first action on a task is reading the read-first
list; the second is confirming that what it says still matches the repository. A contradiction
between a brain doc and the code is itself a finding and is reported, not quietly worked around.

---

## 3. What an agent must return

Every task ends with this block appended to the task file. All seven fields are mandatory; an
empty field is written as `none`, never omitted.

```markdown
## Handoff — T-XXXX — <agent> — YYYY-MM-DD HH:MM

**Status:** done | blocked | returned

**1. Files changed**
| Path | Change | Why |
|---|---|---|
| app/Services/InventoryService.php | added `apply()` | The single stock door, cave law 1 |

**2. Brain docs updated (in the same change)**
| Path | What changed |
|---|---|
| brain/02-database-schema.md | `stock_transactions` index list corrected |

**3. Log entries appended**
- logs/build-log.md — 1 entry, 2026-08-24 14:20
- logs/decisions.log.md — none (no ADR-worthy decision)

**4. Tests**
| Test | Status |
|---|---|
| Feature/Integrity/LedgerBalanceTest.php | green |
`stock:verify` — clean / not applicable

**5. Open questions raised**
| ID | Question | Blocks |
|---|---|---|
| Q-0NN | … | T-XXXX |

**6. Deviations from the task**
Anything done differently from the acceptance criteria, and why. `none` if none.

**7. Next-agent recommendation**
<agent> should take <task or new task>, because <reason>. Include what they must read first.
```

The orchestrator will not mark a task `done` in `brain/state/BACKLOG.md` without this block.

---

## 4. One owner per path

> **Cave law:** every path in the repository has exactly one owning agent at any moment. Two
> agents never hold write access to the same file in the same phase.

Ownership derives from the module boundaries in `brain/05-routes-and-modules.md` §4 and is
assigned per task, not per person-forever. The default mapping:

| Path pattern | Default owner | Notes |
|---|---|---|
| `database/migrations/**` | db-architect | Others propose a migration in the task; db-architect writes it |
| `app/Models/**` | db-architect | Relationships and casts follow the schema |
| `app/Services/InventoryService.php` | backend-engineer | The single stock door; changes here always get a second reviewer |
| `app/Services/{Sales,Invoice}Service.php` | backend-engineer | pos-specialist consumes, does not edit |
| `app/Services/{Purchase,Return}Service.php` | backend-engineer | pharmacy-domain owns the rules those services implement |
| `app/Actions/**`, `app/Data/**`, `app/Enums/**` | backend-engineer | pharmacy-domain owns tax and FEFO semantics inside them |
| `app/Policies/**`, `app/Http/Middleware/**`, permission seeders | security-auditor | Nobody else edits an authorisation boundary |
| `resources/views/pos/**`, POS JS | pos-specialist | The keyboard contract is theirs |
| `resources/views/**` (non-POS), Tailwind config, layouts | frontend-engineer | |
| `tests/**` | qa-tester | Any agent may add tests; qa-tester owns the non-negotiable ten and the suite structure |
| `.github/**`, `deploy/**`, `config/**`, server files | devops | |
| `brain/03-domain-rules.md` | pharmacy-domain | The rules, independent of implementation |
| `brain/02-database-schema.md` | db-architect | |
| `brain/07-testing-strategy.md` | qa-tester | |
| `brain/08-security-and-audit.md` | security-auditor | |
| `brain/09-deployment.md` | devops | |
| `brain/state/**`, `workflow/**`, `agents/**`, `brain/decisions/**` (index) | orchestrator | Individual ADR bodies are written by their deciders |
| `logs/**` | every agent, append-only | Appending is not ownership; nobody edits another agent's line |

Ownership means the right to write. **Any agent may read anything**, and reading widely is
encouraged — the cost of a wrong assumption is much higher than the cost of reading one more
brain file.

---

## 5. Scope collision

A scope collision is any of: two open tasks whose scopes overlap on one path; a task that
cannot be completed without editing a path owned by another agent; or a brain doc that must
change in two directions at once.

**Procedure — stop, do not resolve it yourself.**

| Step | Action |
|---|---|
| 1 | **Stop writing.** Do not edit the contested path, not even "just this one line". |
| 2 | Append a `Deviations` note to the task file naming the contested path and the other owner. |
| 3 | Return the task to the orchestrator with status `blocked` and reason `scope-collision`. |
| 4 | The orchestrator resolves it by one of the three routes below, and records the choice in `logs/build-log.md`. |

**The three resolutions**

| Route | When | What happens |
|---|---|---|
| **Split** | The task genuinely spans two owners | The orchestrator splits it into two tasks with disjoint scopes and an explicit dependency. Preferred. |
| **Delegate** | The contested change is small and mechanical | The owning agent takes a one-line sub-task, does it, and hands back. The requesting agent does not write the file. |
| **Transfer** | The contested path's ownership was wrong | The orchestrator reassigns ownership, updates the table in §4 of this file, and logs the transfer. Rare. |

**Never**: two agents editing one file "carefully"; an agent widening its own scope because the
change looked trivial; or a merge that silently keeps one side. All three produce a file whose
history nobody can explain, which is exactly the failure this protocol exists to prevent.

---

## 6. Handing work back mid-task without losing context

An agent hands back mid-task in four situations: it is blocked by an unresolved question, it
hits a scope collision, it discovers the task is wrong, or the work is genuinely bigger than
one task. In every case the rule is the same.

> **Cave law:** a mid-task handback writes down everything it learned before it stops. Work in
> progress is either documented or destroyed; there is no third state.

**The handback block** — appended to the task file, same seven fields as §3, with `Status:
blocked` or `returned` and these three additions:

```markdown
**8. Where I stopped**
The last completed step, the next intended step, and the exact file and line the next agent
should open first.

**9. What is already on disk**
| Path | State | Safe to keep? |
|---|---|---|
| app/Services/InventoryService.php | apply() written, untested | yes — compiles, no callers |
| database/migrations/2026_..._create_stock_transactions_table.php | draft, not run | no — supersede it |

**10. What I learned that is not yet written down**
Findings, dead ends, and the reason for each. A dead end recorded here saves the next agent a
day; a dead end not recorded here is repeated.
```

Three rules make the handback safe:

1. **Leave the repository green.** Partial work is either committed behind a flag, or reverted,
   or committed with its tests skipped *and* the skip named in the handback. Never leave a red
   suite for the next agent to inherit and mistake for their own breakage.
2. **Update the brain for what is already true.** If the half-done work established a fact — a
   constraint the database rejects, a rule GST actually requires — that fact goes into `brain/`
   now, not when the task eventually finishes.
3. **Raise the question that blocked you**, in `brain/state/OPEN_QUESTIONS.md`, with an ID, what
   it blocks, and who can answer it. A blocked task with no corresponding open question is an
   agent quietly giving up.

---

## 7. Escalation to the orchestrator

Escalate immediately, without finishing the task, when any of these is true:

| Trigger | Why it cannot wait |
|---|---|
| A cave law would have to be broken to satisfy the task | The task is wrong, not the law |
| The task requires a schema change to a table owned by another module | Cross-module schema changes are orchestrator decisions |
| An irreversible or expensive-to-reverse choice appears | It needs an ADR before the code, not after |
| An open question blocks the acceptance criteria | Guessing at a domain answer produces confidently wrong software |
| A security or permission boundary must be widened | security-auditor and the orchestrator decide together |
| The estimate doubles | A task that grew that much is two tasks |

Escalation is not failure. An agent that escalates on day one costs an hour; an agent that
guesses costs a phase.
