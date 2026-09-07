# Custom AI QA Agent — Concept

## What it is

A spec-driven QA agent for Metapharsic Pharmacy that automatically checks the
live build against `brain/10-screen-specs.md`, finds gaps (missing fields,
missing dropdowns, validations that don't fire), and drafts markdown bug
reports with screenshots — without a human hand-authoring assertions per
screen.

## What it does, step by step

1. **Load the spec.** Read a machine-readable version of
   `brain/10-screen-specs.md` (see `spec-schema.md`) — one entry per screen,
   with its route, fields, dropdowns, and validation rules.
2. **Navigate.** Drive a real browser (Playwright/Chromium) to each screen's
   route in the live app, authenticated as a real pharmacy user.
3. **Check presence.** For every field and dropdown the spec says should
   exist, look for it on the page (via a selector hint recorded in the
   spec). Flag anything missing.
4. **Check dropdown population.** For every dropdown, confirm it has more
   than zero options (catches "dropdown exists but API didn't populate it").
5. **Check validation.** For fields marked `required`, submit the form with
   that field empty (or with other known-bad input) and assert a validation
   message appears. Flag silent failures — the "hole" where the app should
   have blocked bad data but let it through.
6. **Diff against spec.** Every check result is compared against what the
   spec says should be true. Anything that disagrees becomes a finding.
7. **Report.** For each finding, take a screenshot at the moment of failure
   and write a markdown bug report (screen, route, what was expected, what
   was observed, screenshot, suggested severity) into
   `qa/agent/reports/<timestamp>/bug-report.md`.

## How this differs from the existing Playwright suite (`qa/playwright/`)

The existing suite is **hand-authored**: a human writes each `expect(...)`
assertion, one at a time, screen by screen. It's precise but it only checks
what someone remembered to write, and it silently goes stale when the spec
changes but nobody updates the test.

The QA agent is **spec-driven**: the checks are *generated* from
`brain/10-screen-specs.md` (via `spec-schema.md`), so:

- Every field/dropdown/validation rule documented in the spec is checked,
  automatically, with no hand-written assertion per item.
- When the spec changes (a field is added, a dropdown's source changes), the
  agent's checks change with it — the spec is the single source of truth.
- The output isn't just pass/fail — it's a **bug report** explaining the gap
  in spec-vs-build terms ("spec says `insurance_provider` is a required
  dropdown sourced from `/api/insurance-providers`; the live screen has no
  such field"), which is more actionable to triage than a red test name.

The two are complementary, not competing: hand-written Playwright tests are
still the right tool for behavior that isn't representable as a
field/dropdown/validation table (multi-step workflows, business logic,
regression tests for specific bugs). The agent covers the mechanical,
spec-coverage layer; Playwright covers the scenario layer.

## Future: plugging into an MCP server

Right now `run-qa-agent.js` is a standalone script that both drives the
browser *and* decides what to check. The natural next step is to split those
two responsibilities:

- An **MCP server** exposes a small, generic toolset over the live app:
  `navigate(url)`, `screenshot()`, `read_dom(selector?)` — deliberately the
  same shape as the `claude-in-chrome` tools already used in this project
  (`mcp__claude-in-chrome__navigate`, `mcp__claude-in-chrome__read_page`,
  etc.), so the same mental model and even similar tool names carry over.
- An **AI agent** (Claude) holds the spec and the reasoning: it calls
  `navigate` to the screen's route, calls `read_dom` to inspect what's
  actually on the page, compares that against the spec itself (rather than
  a hard-coded selector-presence check), and decides what's missing or
  wrong — including judgment calls a fixed script can't make (e.g. "this
  dropdown exists but its label doesn't match the spec's field name — is
  that a rename or a bug?").
- This turns the agent from "run a fixed script" into "an AI that explores
  the live screen the way a human QA tester would, using the spec as its
  checklist," while still producing the same markdown bug reports with
  screenshots.

See `ROADMAP.md` for the phased plan to get there.
