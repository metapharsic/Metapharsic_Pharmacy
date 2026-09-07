# QA Agent Roadmap

## Phase 1 — Specs first [done]
`brain/10-screen-specs.md` documents each screen's fields, dropdowns, APIs,
and validation rules. This is the source of truth everything else derives
from.

## Phase 2 — Hand-written Playwright smoke tests [done]
`qa/playwright/` contains hand-authored tests covering key screens and
flows. Good scenario coverage, but each assertion is manually written and
can drift from the spec over time.

## Phase 3 — Machine-readable spec + wired-up agent skeleton
- Finalize `spec-schema.md` and translate `brain/10-screen-specs.md` into
  actual spec files under (e.g.) `qa/specs/*.yaml`.
- Fill in real `selector_hint` values against the live DOM.
- Wire `run-qa-agent.js`'s TODOs to the real login flow and real selectors
  so it runs end-to-end against a live/staging environment.
- Get the agent producing real bug reports for at least one screen as
  proof of concept.

## Phase 4 — MCP server wrapping the agent
- Expose `navigate`, `screenshot`, `read_dom` as MCP tools with the same
  shape as the `claude-in-chrome` tools already in use in this project.
- Let an AI (Claude) drive the exploration itself — reading the spec,
  calling the tools, deciding what's missing or wrong, and drafting the bug
  report — rather than running a fixed script.
- This turns the QA agent from "a script you run" into "an AI teammate you
  can ask to check a screen (or the whole app) right now."
