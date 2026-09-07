# Build Log

Format: `- HH:MM [agent] [task-id] what happened -> outcome` under a dated heading.
Times are Asia/Kolkata. Append only.

---

## 2026-08-24

- 14:10 [orchestrator] [—] System design drafted: 13 modules, 6 phases, 7 known traps -> `CAVEMAN_DESIGN.md` written, frozen as reference.
- 14:35 [orchestrator] [—] House rules and the eight cave laws fixed -> `CLAUDE.md` written. Read-first file for every session.
- 15:02 [db-architect] [—] Foundation brain docs -> `brain/00`–`03` written. 31 tables specified with types, FKs, uniques, ~60 CHECKs, index rationale, migration order. Two-phase FEFO lock protocol designed (discover by expiry, lock by `id ASC`).
- 15:02 [backend-engineer] [—] Engineering brain docs -> `brain/04`–`09` + `brain/README.md` written. Standards, full route table, POS keyboard contract, 10 non-negotiable tests, permission matrix, deploy and restore drill.
- 15:40 [orchestrator] [—] Agent team defined -> `agents/` roster (9 agents, disjoint write-scopes) and `.claude/agents/` executable subagent definitions written.
- 15:55 [orchestrator] [—] Process scaffold -> `workflow/` (pipeline, handoff, DoD, review checklist, task template), `brain/state/` (current phase, backlog, open questions), `brain/decisions/` (6 ADRs) written.
- 16:20 [orchestrator] [—] Phase 1 (Foundation) OPENED. No code written this session.

### Unresolved on close of 2026-08-24
- CONFLICT-001: `brain/01-architecture.md` specifies `database` queue + `file` cache; `brain/09-deployment.md` lists Redis. Needs an orchestrator ruling before Phase 1 `.env` is fixed. Raised by devops.
- CONFLICT-002: domain exception namespace — `app/Exceptions/` vs `app/Exceptions/Domain/`. `04-coding-standards.md` declares `Domain/` the standard; `01-architecture.md` to be corrected.
- CONFLICT-003: thermal print view name — `print-thermal.blade.php` vs `print-80mm.blade.php`. pos-specialist to pick one in Phase 4.
- 8 open questions logged in `brain/state/OPEN_QUESTIONS.md`, several blocking Phase 2+.

## 2026-08-24 (session 2)

- 17:05 [orchestrator] [—] Q-001 (loose units) resolved -> integer quantity confirmed, no fractional-quantity path. `brain/state/OPEN_QUESTIONS.md`, `brain/02-database-schema.md` updated.
- 17:05 [orchestrator] [—] Q-002 (intra-state only) resolved -> CGST+SGST only, no IGST path in v1. `brain/state/OPEN_QUESTIONS.md`, `brain/03-domain-rules.md` §5 updated.
- 17:05 [orchestrator] [—] Q-006 (concurrent POS terminals) resolved -> 4+ concurrent terminals confirmed. `brain/state/OPEN_QUESTIONS.md` updated; see ADR-0007.
- 17:10 [orchestrator] [—] CONFLICT-001 resolved -> no Redis; `QUEUE_CONNECTION=database`, `CACHE_STORE=file`. `brain/09-deployment.md` fixed to match `brain/01-architecture.md`.
- 17:10 [orchestrator] [—] CONFLICT-002 resolved -> `app/Exceptions/Domain/` wins. `brain/01-architecture.md` directory tree corrected.
- 17:10 [orchestrator] [—] CONFLICT-003 resolved -> `print-80mm.blade.php` wins. `brain/06-ui-conventions.md` corrected.
- 17:15 [orchestrator] [db-architect] ADR-0007 written -> concurrency and scale at 4+ terminals: invoice number allocated last, FEFO lock ordering by `id ASC`, explicit `lock_timeout`, Phase 3 concurrency test requirement. `brain/decisions/ADR-0007-concurrency-and-scale.md`, `brain/decisions/README.md`, `logs/decisions.log.md` updated.
