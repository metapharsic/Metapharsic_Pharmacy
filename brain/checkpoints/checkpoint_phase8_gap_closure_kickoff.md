# Checkpoint: Gap Closure Initiative — Kickoff & Sub-Phase Scoping
**Timestamp**: 2026-08-26T00:00:00+05:30  
**Phase**: Phase 8 — Gap Closure  
**Status**: PLANNED (scoping and architecture only — no implementation has landed yet)

---

## 1. Accomplishments

This checkpoint documents that Phase 8 has been **scoped and architected**, not that its
features are built. Nothing described below has shipped to `app/`, `database/migrations/`,
or `resources/views/` yet.

1. **Source doc written**: `brain/11-gap-closure-architecture.md` — the architecture
   document defining the five sub-phases below, their schema/service/UI shape, and their
   ownership under the existing agent roster (see `agents/README.md`).
2. **Gap list finalized**, drawn from competitive field-inventory research (vendor names
   withheld per project convention) and prioritized in the order below:
   - **Phase 8a — Scheme/Offer Engine**: discount/scheme rules engine for promotional
     pricing at the line-item and invoice level.
   - **Phase 8b — Prescription Image/Scan Attach**: allow a scanned or photographed
     prescription image to be attached to a sale/prescription record.
   - **Phase 8c — Doctor Master Table**: extract doctor identity out of free-text fields
     into a proper `doctors` master table with its own CRUD and relations.
   - **Phase 8d — Fast/Slow-Mover Report**: a reporting page ranking medicines by movement
     velocity to support reorder and clearance decisions.
   - **Phase 8e — Drug License Field + Renewal Reminder**: add a drug license number field
     (pharmacy/store level) plus a renewal-due reminder mechanism.
3. **Sub-phase sequencing set**: 8a → 8b → 8c → 8d → 8e, matching the priority order
   established during gap-closure scoping.
4. **Ownership confirmed**: no new agent role introduced for Phase 8. Each sub-phase is
   assigned to the existing roster (`db-architect`, `backend-engineer`, `pharmacy-domain`,
   `frontend-engineer`, `qa-tester`, `security-auditor`, etc.) per each agent's existing
   write-scope in `agents/README.md`.

### Not yet done (explicitly out of scope for this checkpoint)
- No migrations for `schemes`/`offers`, `doctors`, or license fields have been written.
- No prescription-image upload/storage mechanism exists.
- No fast/slow-mover report route, controller, or view exists.
- No renewal-reminder job/notification exists.
- `brain/state/CURRENT_PHASE.md` and `brain/state/BACKLOG.md` have **not** been updated as
  part of this checkpoint — those files are known to be stale/informal per an earlier
  session note, and their rewrite is tracked separately, out of scope here.

---

## 2. Invariant Checklist
- [ ] **Scheme/Offer Engine** implemented and reviewed by `pharmacy-domain` (discount ordering
  touches money math — escalation required per the cave-law rules).
- [ ] **Prescription attach** implemented with storage scoped correctly (no cost/PII leakage).
- [ ] **Doctor master table** implemented; existing free-text doctor references migrated.
- [ ] **Fast/slow-mover report** implemented and meets the dashboard performance budget.
- [ ] **Drug license + renewal reminder** implemented; reminder mechanism verified to fire.
- [ ] All five sub-phases pass `qa-tester`'s suite additions before Phase 8 is marked COMPLETE.
- [ ] No new agent role created; all writes stay inside existing roster path ownership.
