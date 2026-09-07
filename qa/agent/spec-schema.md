# Machine-readable screen spec schema (proposal)

Goal: turn each screen's section in `brain/10-screen-specs.md` into a small
YAML (or JSON) file that both the hand-written Playwright suite and
`run-qa-agent.js` can load and consume, instead of each having its own
copy of "what this screen should contain" baked into code.

One file per screen (e.g. `qa/specs/patient-intake.yaml`), or one combined
file with a top-level `screens:` array — either works with the shape below.

## Shape

```yaml
screen: patient-intake
route: /patients/new
description: >
  Create a new patient record. Source: brain/10-screen-specs.md, section
  "Patient Intake".

fields:
  - name: first_name
    type: text
    required: true
    selector_hint: "[name='first_name']"
  - name: last_name
    type: text
    required: true
    selector_hint: "[name='last_name']"
  - name: date_of_birth
    type: date
    required: true
    selector_hint: "[name='date_of_birth']"
  - name: insurance_provider
    type: dropdown
    required: true
    selector_hint: "[name='insurance_provider']"

dropdowns:
  - name: insurance_provider
    source: /api/insurance-providers
  - name: state
    source: /api/states

validations:
  - field: first_name
    rule: required
  - field: date_of_birth
    rule: required
  - field: date_of_birth
    rule: not_future_date
  - field: insurance_provider
    rule: required
```

## Field reference

| Key | Meaning |
|---|---|
| `screen` | Slug identifying the screen; used for report filenames. |
| `route` | Path (relative to app base URL) the agent navigates to. |
| `fields[].name` | Logical field name, matched against the spec doc. |
| `fields[].type` | `text` \| `date` \| `dropdown` \| `checkbox` \| `number` \| ... |
| `fields[].required` | Whether the spec marks this field required. |
| `fields[].selector_hint` | Best-guess CSS selector to locate the field in the live DOM — a hint, not guaranteed correct; the agent/tests should tolerate it being wrong and log a clear failure rather than crash. |
| `dropdowns[].name` | Must match a `fields[]` entry of type `dropdown`. |
| `dropdowns[].source` | API endpoint (per `brain/10-screen-specs.md`) expected to populate this dropdown's options. |
| `validations[].field` | Field the rule applies to. |
| `validations[].rule` | Short rule id: `required`, `not_future_date`, `min_length:n`, `format:email`, etc. — free-form but consistent enough for the agent to know how to construct bad input. |

## Notes / open questions for phase 3

- `selector_hint` values will need to be filled in against the *real* DOM,
  screen by screen — this schema only reserves the field.
- Consider a `screens:` top-level array vs. one file per screen; one file
  per screen is easier to diff/review against spec doc changes.
- JSON is an equally valid encoding of the same shape if the tooling around
  this project prefers JSON over YAML — no semantic difference intended.
