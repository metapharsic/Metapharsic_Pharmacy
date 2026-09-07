import { test } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

// Accessibility smoke test, pattern adopted from UKHO/playwright-template
// (tests/a11y/a11y.spec.ts) using axe-core via axe-playwright. Runs against
// a representative sample of screens rather than every route in the app —
// add a page here whenever a new screen ships, following the same shape.
//
// detailedReport surfaces which nodes failed and why in the HTML reporter's
// attachment; failing on any violation (rather than just logging) keeps this
// from silently rotting into a report nobody reads.

const PAGES_TO_CHECK: Array<{ name: string; path: string }> = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Racks index', path: '/racks' },
  { name: 'Doctors index', path: '/doctors' },
  { name: 'Drug Licenses index', path: '/settings/licenses' },
  { name: 'Discount Schemes index', path: '/discount-schemes' },
];

test.describe('Accessibility (axe)', () => {
  for (const { name, path } of PAGES_TO_CHECK) {
    test(`${name} has no automatically detectable accessibility violations`, async ({ page }) => {
      await page.goto(path);
      await injectAxe(page);
      await checkA11y(page, undefined, {
        detailedReport: true,
        detailedReportOptions: { html: true },
      });
    });
  }
});
