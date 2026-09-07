# Logs

**Purpose:** append-only history of what happened, so a future session can reconstruct why.

> **Cave law:** Logs are append-only. Never rewrite or delete an entry. A wrong entry is
> corrected by a new entry below it.

| File | Holds | Who appends |
|---|---|---|
| `build-log.md` | Every unit of work done, dated, with outcome. Phase-gate signoffs. | Every agent |
| `decisions.log.md` | One line per decision, pointing at its ADR. | orchestrator |
| `changelog.md` | User-visible changes, Keep a Changelog format. | orchestrator |
| `sessions/` | One file per working session: what was asked, produced, decided. | orchestrator |

**build-log entry format:** `- HH:MM [agent] [task-id] what happened -> outcome`
**Phase gate format:** `### GATE: Phase N -> Phase N+1 — SIGNED YYYY-MM-DD by <agent>` followed by the checked exit conditions.
