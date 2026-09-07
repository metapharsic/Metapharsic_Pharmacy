# Metapharsic Pharmacy E2E Tests (Playwright)

Playwright test skeleton for the Metapharsic pharmacy Laravel 12 app,
covering POS, medicines, purchases, inventory, customers, suppliers,
sales, returns, reports, stock adjustments, categories, manufacturers,
users, and the dashboard.

## Important: these are skeleton tests, not fully verified tests

Most selectors in this suite were authored from route/controller
inspection (naming conventions, typical Laravel resource-controller and
Blade patterns), **not from a live screenshot or DOM inspection of the
running app**. Every selector or flow that is inferred rather than
confirmed is marked with a `TODO` comment in the relevant spec file.

Before relying on this suite:

1. Start the app locally and open each page in a real browser (or use
   `npx playwright codegen http://127.0.0.1:5656`) to confirm actual
   field names, IDs, classes, and routes.
2. Update the `TODO`-marked selectors and route paths to match.
3. Un-skip (`test.skip` -> `test`) the stubbed deeper-flow tests once
   their selectors are confirmed.

## Prerequisites

- Node.js installed.
- The pharmacy app running locally on **http://127.0.0.1:5656**
  (via `start.bat` or however the app is normally started). This suite
  does not start the app itself — start it first, then run the tests.
- An admin login that works against the running app:
  - email: `admin@metapharsic.local`
  - password: `ChangeMe123!`

## Page Object Model

Pattern adopted from [UKHO/playwright-template](https://github.com/UKHO/playwright-template):
every screen this suite touches gets a class under `tests/page-object-model/pages/`
(one file per screen, `BasePage` for shared helpers) — specs describe
behaviour, page objects own the real selectors. Not every spec has been
migrated yet; `dashboard.spec.ts`, `medicines.spec.ts`, `pos.spec.ts`,
`purchases.spec.ts`, `inventory.spec.ts`, `returns.spec.ts`, and
`reports.spec.ts` still use inline selectors and are natural next
candidates to migrate following the same pattern as `racks.spec.ts` /
`doctors.spec.ts`.

## Accessibility checks

`a11y.spec.ts` runs [axe-core](https://github.com/dequelabs/axe-core) via
`axe-playwright` against a representative sample of screens (also adopted
from the UKHO template). Add a page to `PAGES_TO_CHECK` in that file
whenever a new screen ships.

## Install

```bash
npm install
npx playwright install
```

This suite now runs against Chromium, Firefox, and WebKit (`npx playwright
install` with no browser name installs all three) — matching the
multi-browser project setup in `playwright.config.ts`.

## Run

Make sure the app is running on port 5656 first, then:

```bash
npm test
```

Or with the interactive UI runner:

```bash
npm run test:ui
```

## How auth works

`tests/auth.setup.ts` runs as a Playwright "setup" project before the
`chromium` project. It logs in through the `/login` form and saves the
authenticated session to `tests/.auth/admin.json`, which the `chromium`
project reuses via `storageState` so individual specs don't need to log
in themselves. If login selectors don't match the real login form,
fix `auth.setup.ts` first — every other spec depends on it.

## Structure

```
tests/
  auth.setup.ts             - logs in, saves storage state
  page-object-model/pages/  - one class per screen (Page Object Model)
    base-page.ts
    racks-page.ts
    doctors-page.ts
    drug-licenses-page.ts
    discount-schemes-page.ts
    sale-show-page.ts
    movers-page.ts
  dashboard.spec.ts         - dashboard smoke test
  pos.spec.ts               - POS smoke test + search (add-to-cart stubbed)
  medicines.spec.ts         - medicines CRUD smoke test
  purchases.spec.ts         - purchases smoke test
  inventory.spec.ts         - inventory smoke test
  returns.spec.ts           - returns smoke test
  reports.spec.ts           - reports smoke test
  racks.spec.ts             - racks CRUD + occupancy + assignment (POM)
  doctors.spec.ts           - doctor master + customer linkage (POM)
  drug-licenses.spec.ts     - drug license CRUD + dashboard banner (POM)
  discount-schemes.spec.ts  - discount scheme CRUD (POM)
  prescription-image.spec.ts- prescription image attach (POM)
  movers.spec.ts            - fast/slow mover report (POM)
  a11y.spec.ts               - axe accessibility checks across key screens
  .auth/admin.json          - saved session (generated, gitignored recommended)
```

Modules not yet covered by a dedicated spec (customers, suppliers,
sales, stock-adjustments, categories, manufacturers, users) are natural
next files to add following the same pattern as `medicines.spec.ts` /
`purchases.spec.ts`.
