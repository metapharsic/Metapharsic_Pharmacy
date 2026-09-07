# workflow/ — How Work Moves

Purpose: describe the single loop by which a piece of work travels from the backlog to a signed-off change, and index the documents that govern each step of it.

---

## 1. The loop

Every unit of work in this repository follows the same seven steps. There is no second path,
no "small change" exemption, and no direct-to-code shortcut. A change that skips a step is
reverted, not retro-documented.

| # | Step | Who | Output | Governed by |
|---|---|---|---|---|
| 1 | **Pick** a task from the backlog that belongs to the open phase and whose blockers are cleared | orchestrator | A task selected in `brain/state/BACKLOG.md`, status moved `todo → in-progress` | `workflow/phase-pipeline.md` |
| 2 | **Write** the task file from the template — context, read-first list, acceptance criteria, out-of-scope, cave laws in play, escalation triggers | orchestrator | A filled task, given to the owning agent | `workflow/task-template.md` |
| 3 | **Assign** it to exactly one owning agent, who owns every path the task writes | orchestrator | Ownership recorded on the task and in the backlog row | `workflow/handoff-protocol.md` |
| 4 | **Work** — the agent reads first, then changes code and `brain/` docs together | owning agent | Files changed, brain docs updated, questions raised | `CLAUDE.md`, `brain/04-coding-standards.md` |
| 5 | **Done** — the agent checks itself against the universal and per-layer checklists before claiming completion | owning agent | A completed Definition of Done checklist on the task | `workflow/definition-of-done.md` |
| 6 | **Review** — a second agent (never the author) answers every reviewer question yes or no | reviewing agent | Approval, or a returned task with named defects | `workflow/review-checklist.md` |
| 7 | **Log** — the agent appends to `logs/build-log.md`; a real decision also gets an ADR and a line in `logs/decisions.log.md` | owning agent | Append-only log entries | `logs/README.md` |

Then the orchestrator closes the loop: it updates `brain/state/BACKLOG.md` (`review → done`),
updates `brain/state/CURRENT_PHASE.md` if the phase's task list moved, resolves or re-files
anything in `brain/state/OPEN_QUESTIONS.md` that the work answered, and picks the next task.

```
BACKLOG ──pick──▶ TASK FILE ──assign──▶ AGENT ──work──▶ DoD ──review──▶ LOG ──▶ STATE UPDATE
   ▲                                                        │                        │
   └──────────────── returned with named defects ───────────┘                        │
   └────────────────────── new tasks, new questions ─────────────────────────────────┘
```

> **Cave law:** the change to the code and the change to `brain/` land together, in one commit,
> or the work is not done. A stale brain is worse than no brain.

---

## 2. Who does what in the loop

| Actor | Owns | Never does |
|---|---|---|
| **orchestrator** | Backlog, phase state, open questions, task authoring, assignment, gate signoff | Writes application code; reviews its own gate signoff |
| **Owning agent** | The task's files, its brain-doc updates, its tests, its log entry | Writes outside its assigned paths without a handoff |
| **Reviewing agent** | The review verdict against `workflow/review-checklist.md` | Reviews work it authored |
| **qa-tester** | The non-negotiable test list in `brain/07-testing-strategy.md`, phase acceptance suites | Signs off a phase gate alone — the orchestrator records the signoff |

The nine agents are: `orchestrator`, `db-architect`, `backend-engineer`, `pharmacy-domain`,
`frontend-engineer`, `pos-specialist`, `qa-tester`, `security-auditor`, `devops`. Their
charters and boundaries live in `agents/`.

---

## 3. State lives in exactly three files

Everything about *what is happening right now* is in `brain/state/`, and nowhere else. Do not
record progress in a brain document, a code comment, or an ADR.

| File | Answers |
|---|---|
| `brain/state/CURRENT_PHASE.md` | What is in scope this week, and what closes the phase |
| `brain/state/BACKLOG.md` | What is queued, who owns it, what blocks it |
| `brain/state/OPEN_QUESTIONS.md` | What we do not yet know, and what it is holding up |

---

## 4. Index of this directory

| File | Purpose |
|---|---|
| `workflow/README.md` | This file: the loop, the actors, the index |
| `workflow/phase-pipeline.md` | The six phases as gates: goal, agents, deliverables, exit conditions, what may not start early |
| `workflow/handoff-protocol.md` | The contract between agents: what is received, what is returned, one owner per path, collisions, mid-task handback |
| `workflow/task-template.md` | The copy-paste task format, plus a worked example (T-0101) |
| `workflow/definition-of-done.md` | The universal DoD checklist and the per-layer additions |
| `workflow/review-checklist.md` | The reviewer's yes/no questions, grouped by risk area |

## 5. Where to read next

| You need | Read |
|---|---|
| The house rules and the eight cave laws | `CLAUDE.md` |
| What is in scope right now | `brain/state/CURRENT_PHASE.md` |
| Why a design choice was made | `brain/decisions/README.md` |
| What happened and when | `logs/build-log.md` |
