import { Page, APIRequestContext, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

/**
 * Generic, reusable validation helpers — shared across every spec in this
 * suite rather than duplicated per screen. Each function takes the raw
 * locators/config it needs (no hidden global state) so any page object
 * (tests/page-object-model/pages/*.ts) can compose them.
 *
 * Two of these — validateDatabase() and validateAPI() — are honest about
 * what a browser-driven Playwright suite can and can't verify. See their
 * doc comments before reaching for them.
 */

// ---------------------------------------------------------------------------
// 1. validatePage — landed on the right screen, real heading/breadcrumb.
// ---------------------------------------------------------------------------
export async function validatePage(
  page: Page,
  opts: { path?: string; heading?: string; breadcrumbText?: string }
): Promise<void> {
  if (opts.path) {
    await expect(page).toHaveURL(new RegExp(opts.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  if (opts.heading) {
    await expect(page.getByRole('heading', { name: opts.heading })).toBeVisible();
  }
  if (opts.breadcrumbText) {
    await expect(page.getByText(opts.breadcrumbText).first()).toBeVisible();
  }
}

// ---------------------------------------------------------------------------
// 2. validateRequiredFields — clear each required field one at a time,
//    submit, confirm a real @error() block renders for that field.
// ---------------------------------------------------------------------------
export async function validateRequiredFields(
  page: Page,
  opts: { fieldNames: string[]; saveButtonName?: string }
): Promise<void> {
  const saveButton = page.getByRole('button', { name: opts.saveButtonName ?? 'Save' });

  for (const name of opts.fieldNames) {
    const field = page.locator(`[name="${name}"]`);
    const tag = await field.evaluate((el) => el.tagName.toLowerCase());

    if (tag === 'select') {
      await field.selectOption('');
    } else {
      await field.fill('');
    }

    await saveButton.click();

    const error = page
      .locator(`[name="${name}"]`)
      .locator('xpath=following-sibling::p[contains(@class, "text-red-600")]');
    await expect(error.first()).toBeVisible();
  }
}

// ---------------------------------------------------------------------------
// 3. validateDropdown — confirm a <select> is populated from real data, not
//    a hardcoded fixed list (unless expectedOptions is explicitly given for
//    a genuinely fixed enum, e.g. license_type).
// ---------------------------------------------------------------------------
export async function validateDropdown(
  page: Page,
  opts: { selector: string; expectedOptions?: string[]; minRealOptions?: number; placeholderText?: string }
): Promise<void> {
  const select = page.locator(opts.selector);
  await expect(select).toBeVisible();

  if (opts.expectedOptions) {
    const actual = await select.locator('option').allTextContents();
    expect(actual.map((t) => t.trim())).toEqual(opts.expectedOptions);
    return;
  }

  if (opts.placeholderText) {
    await expect(select.locator('option').first()).toHaveText(opts.placeholderText);
  }

  if (opts.minRealOptions !== undefined) {
    const count = await select.locator('option').count();
    // -1 for the placeholder option, when one is expected.
    const realCount = opts.placeholderText ? count - 1 : count;
    expect(realCount).toBeGreaterThanOrEqual(opts.minRealOptions);
  }
}

// ---------------------------------------------------------------------------
// 4. validateCreate — fill a create form, submit, confirm the new row shows
//    up on the index (the only reliable proof the DB write actually landed,
//    short of a DB check — see validateDatabase below).
// ---------------------------------------------------------------------------
export async function validateCreate(
  page: Page,
  opts: {
    createPath: string;
    indexPath: string;
    fill: () => Promise<void>;
    saveButtonName?: string;
    uniqueRowText: string;
    expectRowContains?: string[];
  }
): Promise<void> {
  await page.goto(opts.createPath);
  await opts.fill();
  await page.getByRole('button', { name: opts.saveButtonName ?? 'Save' }).click();

  await page.goto(opts.indexPath);
  const row = page.locator('table tr', { hasText: opts.uniqueRowText });
  await expect(row.first()).toBeVisible();

  for (const text of opts.expectRowContains ?? []) {
    await expect(row.first()).toContainText(text);
  }
}

// ---------------------------------------------------------------------------
// 5. validateEdit — open a row's Edit link, change one field, save, confirm
//    the index reflects the change (proves the update round-tripped).
// ---------------------------------------------------------------------------
export async function validateEdit(
  page: Page,
  opts: {
    indexPath: string;
    rowText: string;
    editLinkText?: string;
    fieldName: string;
    newValue: string;
    saveButtonName?: string;
    expectRowContains: string;
  }
): Promise<void> {
  await page.goto(opts.indexPath);
  const row = page.locator('table tr', { hasText: opts.rowText });
  await row.first().getByRole('link', { name: opts.editLinkText ?? 'Edit' }).click();

  const field = page.locator(`[name="${opts.fieldName}"]`);
  const tag = await field.evaluate((el) => el.tagName.toLowerCase());
  if (tag === 'select') {
    await field.selectOption(opts.newValue);
  } else {
    await field.fill(opts.newValue);
  }

  await page.getByRole('button', { name: opts.saveButtonName ?? 'Save' }).click();
  await page.goto(opts.indexPath);

  const updatedRow = page.locator('table tr', { hasText: opts.expectRowContains });
  await expect(updatedRow.first()).toBeVisible();
}

// ---------------------------------------------------------------------------
// 6. validateDelete — delete a row (handling the confirm() dialog every
//    destroy button in this app wraps itself in), confirm it's gone from
//    the index or correctly blocked with a reason.
// ---------------------------------------------------------------------------
export async function validateDelete(
  page: Page,
  opts: {
    indexPath: string;
    rowText: string;
    deleteButtonText?: string;
    expectBlockedMessage?: string; // e.g. rack destroy blocks when occupied
  }
): Promise<void> {
  await page.goto(opts.indexPath);
  const row = page.locator('table tr', { hasText: opts.rowText });

  page.once('dialog', (dialog) => dialog.accept());
  await row.first().getByRole('button', { name: opts.deleteButtonText ?? 'Delete' }).click();

  if (opts.expectBlockedMessage) {
    await expect(page.getByText(opts.expectBlockedMessage)).toBeVisible();
    await expect(page.locator('table tr', { hasText: opts.rowText }).first()).toBeVisible();
  } else {
    await expect(page.locator('table tr', { hasText: opts.rowText })).toHaveCount(0);
  }
}

// ---------------------------------------------------------------------------
// 7. validateSearch — a filter/search input or select narrows visible rows,
//    and (where the app round-trips filters via GET) the choice survives in
//    the URL query string.
// ---------------------------------------------------------------------------
export async function validateSearch(
  page: Page,
  opts: { indexPath: string; filterSelector: string; value: string; expectUrlParam?: string; expectRowText?: string }
): Promise<void> {
  await page.goto(opts.indexPath);
  const filter = page.locator(opts.filterSelector);

  const tag = await filter.evaluate((el) => el.tagName.toLowerCase());
  if (tag === 'select') {
    await filter.selectOption(opts.value);
  } else if (tag === 'input') {
    const type = await filter.getAttribute('type');
    if (type === 'checkbox') {
      await filter.check();
    } else {
      await filter.fill(opts.value);
      await filter.press('Enter');
    }
  }

  if (opts.expectUrlParam) {
    await expect(page).toHaveURL(new RegExp(opts.expectUrlParam));
  }
  if (opts.expectRowText) {
    await expect(page.locator('table tr', { hasText: opts.expectRowText }).first()).toBeVisible();
  }
}

// ---------------------------------------------------------------------------
// 8. validateAPI — hits a JSON endpoint directly via Playwright's
//    APIRequestContext (page.request or the `request` fixture), bypassing
//    the browser. Use this for routes that return JSON (CSV/export links,
//    a future REST API) — NOT for Blade HTML pages, which validatePage /
//    validateCreate already cover more meaningfully than a raw status check
//    would.
// ---------------------------------------------------------------------------
export async function validateAPI(
  request: APIRequestContext,
  opts: { url: string; method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; expectedStatus?: number; expectContentType?: string }
): Promise<void> {
  const method = (opts.method ?? 'GET').toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
  const response = await request[method](opts.url);

  expect(response.status()).toBe(opts.expectedStatus ?? 200);

  if (opts.expectContentType) {
    const contentType = response.headers()['content-type'] ?? '';
    expect(contentType).toContain(opts.expectContentType);
  }
}

// ---------------------------------------------------------------------------
// 9. validateDatabase — HONEST LIMITATION: a browser-driven Playwright test
// has no direct line to PostgreSQL, and this suite deliberately does not add
// one (no test-only "peek the DB" route, no shelling out to `psql`/`artisan
// tinker` from a test file — that's a Laravel-side Pest/PHPUnit feature
// test's job, not an E2E suite's). What this DOES give you is the strongest
// proxy available from the browser: the same data re-fetched from a second,
// independent page load (not just optimistic client-side state), which is
// enough to catch "looked like it saved but didn't persist" bugs.
//
// If true row-level DB assertions become necessary, add a narrow, auth-gated
// debug endpoint (e.g. `/  __test__/racks/{id}` behind `app()->environment('testing')`)
// and extend this function to call it via validateAPI — do not query
// PostgreSQL directly from a Node test process against a real app's DB.
// ---------------------------------------------------------------------------
export async function validateDatabase(
  page: Page,
  opts: { indexPath: string; rowText: string; expectRowContains?: string[] }
): Promise<void> {
  // Reload from a fresh navigation (new request/response cycle, not client
  // state) — if the row is still there with the same values, the write
  // persisted server-side and survived a round trip.
  await page.goto(opts.indexPath);
  await page.reload();

  const row = page.locator('table tr', { hasText: opts.rowText });
  await expect(row.first()).toBeVisible();

  for (const text of opts.expectRowContains ?? []) {
    await expect(row.first()).toContainText(text);
  }
}

// ---------------------------------------------------------------------------
// 10. validatePermissions — confirm a route/element is visible for a page
// already authenticated as an allowed role, and blocked (403, redirect, or
// simply absent from the DOM per this app's "don't render what they can't
// use" convention) for one that isn't. Needs a second Playwright `page`
// fixture using a non-admin storageState — this suite currently ships only
// `tests/.auth/admin.json`; add a second `tests/.auth/cashier.json` (via a
// second `*.setup.ts` project) before the "denied" half of this is usable.
// ---------------------------------------------------------------------------
export async function validatePermissions(
  allowedPage: Page,
  deniedPage: Page | null,
  opts: { path: string; elementSelector?: string; elementText?: string }
): Promise<void> {
  await allowedPage.goto(opts.path);
  if (opts.elementSelector) {
    await expect(allowedPage.locator(opts.elementSelector).first()).toBeVisible();
  } else if (opts.elementText) {
    await expect(allowedPage.getByText(opts.elementText).first()).toBeVisible();
  }

  if (!deniedPage) {
    return; // no second-role fixture wired up yet — see doc comment above.
  }

  const response = await deniedPage.goto(opts.path);
  const status = response?.status() ?? 0;
  const blockedByStatus = status === 403 || status === 404;

  if (!blockedByStatus) {
    // App convention (per layouts/app.blade.php) is to omit nav links/UI
    // rather than show a disabled one — so absence from the DOM also counts
    // as "blocked" for elements gated purely by @can in the view layer.
    if (opts.elementSelector) {
      await expect(deniedPage.locator(opts.elementSelector)).toHaveCount(0);
    } else if (opts.elementText) {
      await expect(deniedPage.getByText(opts.elementText)).toHaveCount(0);
    }
  }
}

// ---------------------------------------------------------------------------
// 11. validateErrorHandling — a bad request (invalid input, a broken FK
// reference, etc.) should produce a graceful in-app validation message, not
// Laravel's debug "Whoops" stack-trace page leaking file paths/env details
// to a browser session.
// ---------------------------------------------------------------------------
export async function validateErrorHandling(
  page: Page,
  opts: { triggerAction: () => Promise<void>; expectMessage?: string }
): Promise<void> {
  await opts.triggerAction();

  // APP_DEBUG=true renders "Whoops\!" / a stack trace; this must never reach
  // a real (non-local) session, and even in local dev it means the request
  // wasn't handled gracefully by validation/exception mapping.
  await expect(page.getByText('Whoops')).toHaveCount(0);
  await expect(page.getByText(/stack trace/i)).toHaveCount(0);

  if (opts.expectMessage) {
    await expect(page.getByText(opts.expectMessage)).toBeVisible();
  }
}

// ---------------------------------------------------------------------------
// Extras beyond the original list — same reasoning: these are patterns that
// show up on every CRUD screen in this app and are worth centralizing too.
// ---------------------------------------------------------------------------

/** 12. Old input repopulates a form after a validation failure (old()). */
export async function validateOldInputPersists(
  page: Page,
  opts: { fieldName: string; value: string; saveButtonName?: string }
): Promise<void> {
  const field = page.locator(`[name="${opts.fieldName}"]`);
  await field.fill(opts.value);
  await page.getByRole('button', { name: opts.saveButtonName ?? 'Save' }).click();
  await expect(field).toHaveValue(opts.value);
}

/** 13. A DB-level unique constraint surfaces as a form error, not a 500. */
export async function validateUniqueConstraint(
  page: Page,
  opts: { createPath: string; fieldName: string; duplicateValue: string; fillRest: () => Promise<void>; saveButtonName?: string }
): Promise<void> {
  await page.goto(opts.createPath);
  await page.locator(`[name="${opts.fieldName}"]`).fill(opts.duplicateValue);
  await opts.fillRest();
  await page.getByRole('button', { name: opts.saveButtonName ?? 'Save' }).click();

  await expect(page.getByText('Whoops')).toHaveCount(0);
  const error = page
    .locator(`[name="${opts.fieldName}"]`)
    .locator('xpath=following-sibling::p[contains(@class, "text-red-600")]');
  await expect(error.first()).toBeVisible();
}

/** 14. A flash/status banner appears after a successful action, per this app's session('status') convention. */
export async function validateFlashMessage(page: Page, expectedText: string): Promise<void> {
  await expect(page.getByRole('status').filter({ hasText: expectedText })).toBeVisible();
}

/** 15. Pagination controls appear once a listing exceeds one page, and page 2 shows different rows. */
export async function validatePagination(page: Page, indexPath: string): Promise<void> {
  await page.goto(indexPath);
  const nextLink = page.getByRole('link', { name: /next/i });

  if (!(await nextLink.count())) {
    return; // fewer rows than the page size in this environment — not a failure.
  }

  const firstPageFirstRowText = await page.locator('table tbody tr').first().innerText();
  await nextLink.click();
  const secondPageFirstRowText = await page.locator('table tbody tr').first().innerText();
  expect(secondPageFirstRowText).not.toBe(firstPageFirstRowText);
}

/** 16. A CSV/file export link/button actually returns a file, not an HTML error page. */
export async function validateExport(
  page: Page,
  opts: { triggerSelector: string; expectContentType?: string }
): Promise<void> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator(opts.triggerSelector).click(),
  ]);
  expect(download.suggestedFilename()).toBeTruthy();
}

/** 17. File upload accepts a valid file and rejects an invalid one (size/mime), matching server-side validation rules. */
export async function validateFileUpload(
  page: Page,
  opts: { inputSelector: string; validFilePath: string; invalidFilePath?: string; expectSuccessText?: string; expectRejectMessage?: string }
): Promise<void> {
  await page.locator(opts.inputSelector).setInputFiles(opts.validFilePath);
  await page.getByRole('button', { name: 'Upload' }).click();
  if (opts.expectSuccessText) {
    await expect(page.getByText(opts.expectSuccessText)).toBeVisible();
  }

  if (opts.invalidFilePath) {
    await page.locator(opts.inputSelector).setInputFiles(opts.invalidFilePath);
    await page.getByRole('button', { name: 'Upload' }).click();
    if (opts.expectRejectMessage) {
      await expect(page.getByText(opts.expectRejectMessage)).toBeVisible();
    }
  }
}

/** 18. Accessibility — thin wrapper so specs don't need to import axe-playwright directly. */
export async function validateAccessibility(page: Page): Promise<void> {
  await injectAxe(page);
  await checkA11y(page, undefined, { detailedReport: true, detailedReportOptions: { html: true } });
}

/** 19. Responsive layout — no horizontal scroll/overflow at a given viewport (mobile sidebar collapse etc). */
export async function validateResponsive(page: Page, opts: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(opts);
  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasHorizontalScroll).toBe(false);
}
