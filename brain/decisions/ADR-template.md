# ADR Template

Purpose: the required shape of every architecture decision record in this repository.

Copy everything below the rule into `ADR-NNNN-kebab-case-title.md`, take the next free number
from the index in `brain/decisions/README.md`, and delete the guidance in italics.

---

# ADR-NNNN — <decision stated as a noun phrase>

**Status:** Proposed | Accepted | Superseded by ADR-NNNN | Rejected
**Date:** YYYY-MM-DD
**Deciders:** orchestrator, <specialist agent>
**Supersedes:** ADR-NNNN, or none
**Related:** <brain docs, other ADRs, cave laws, task IDs>

## Context

*The forces, not the answer. What problem exists, what constraints bear on it (regulatory,
concurrency, scale, the shop's actual working day), and what will go wrong if the choice is made
badly. A reader must be able to reach the decision themselves from this section. Write it so it
stays true even if the decision is later reversed.*

## Decision

*One or two paragraphs, present tense, specific. Name the exact types, tables, commands, or
mechanisms. "We will consider" is not a decision.*

## Consequences

### Positive

| Consequence | Why it matters here |
|---|---|
| | |

### Negative

| Consequence | What it costs, and how we live with it |
|---|---|
| | |

*The negative table is mandatory and may not be empty. Every real decision costs something; an
ADR that lists no cost was not a decision.*

## Alternatives considered

### <Alternative A>

**The case for it.** *State it at full strength — the version its advocate would give.*

**Why rejected.** *The specific, concrete reason, tied to this system's constraints.*

### <Alternative B>

**The case for it.**

**Why rejected.**

## Cave laws created or reinforced

| # | Law | Where it is enforced |
|---|---|---|
| | | *migration, service, CHECK constraint, test, review checklist item* |

## Revisit conditions

*What would make this decision wrong. If none of these ever happens, the ADR stands and does
not need re-examination.*
