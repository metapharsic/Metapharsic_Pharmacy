import { test, expect } from '@playwright/test';

// Reports — verified against resources/views/reports/sales.blade.php,
// reports/gst.blade.php, and reports/profit.blade.php. There is no
// unified /reports index view in this staging set, so the previous
// generic "reports index loads" test (guessed route) is replaced with
// per-report page tests against real routes/headings.

test.describe('Reports', () => {
  test('sales report loads with real date-range and cashier/payment filters', async ({ page }) => {
    await page.goto('/reports/sales');
    await expect(page.getByRole('heading', { name: 'Sales Report', exact: true })).toBeVisible();

    await expect(page.getByLabel('From')).toBeVisible();
    await expect(page.getByLabel('To')).toBeVisible();
    await expect(page.getByLabel('Cashier')).toBeVisible();
    await expect(page.getByLabel('Payment Mode')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Filter' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Export CSV' })).toBeVisible();

    const table = page.getByRole('table');
    await expect(table).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Date' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Invoice #' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Cashier' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Payment Mode' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Items' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Tax' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Total' })).toBeVisible();

    // Cave law 2: sales report has no cost/margin column at all — assert
    // its absence explicitly rather than only asserting what's present.
    await expect(table.getByRole('columnheader', { name: /cost/i })).toHaveCount(0);
    await expect(table.getByRole('columnheader', { name: /margin/i })).toHaveCount(0);
  });

  test('sales report filters by date range', async ({ page }) => {
    await page.goto('/reports/sales');
    await page.getByLabel('From').fill('2026-08-01');
    await page.getByLabel('To').fill('2026-08-26');
    await page.getByRole('button', { name: 'Filter' }).click();
    await expect(page).toHaveURL(/from=2026-08-01/);
    await expect(page).toHaveURL(/to=2026-08-26/);
    // TODO: assert filtered row dates fall within range once a seed with
    // known sales dates exists; a fresh/empty seed only shows the
    // "No sales in this range." empty state, which is not a meaningful
    // range assertion on its own.
  });

  test('GST report loads with real date filter and three rate-slab tables', async ({ page }) => {
    await page.goto('/reports/gst');
    await expect(page.getByRole('heading', { name: 'GST Report', exact: true })).toBeVisible();

    await expect(page.getByLabel('From')).toBeVisible();
    await expect(page.getByLabel('To')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Filter' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Export CSV' })).toBeVisible();

    await expect(page.getByText('Output Tax (Sales) — By Rate Slab')).toBeVisible();
    await expect(page.getByText('Input Tax (Purchases) — By Rate Slab')).toBeVisible();
    await expect(page.getByText('HSN Summary')).toBeVisible();

    // Column headers repeat across the two slab tables; scope to the
    // first table (Output Tax) for a concrete check.
    const outputTable = page.getByText('Output Tax (Sales) — By Rate Slab').locator('xpath=following-sibling::table[1]');
    await expect(outputTable.getByRole('columnheader', { name: 'GST Rate' })).toBeVisible();
    await expect(outputTable.getByRole('columnheader', { name: 'Taxable Value' })).toBeVisible();
    await expect(outputTable.getByRole('columnheader', { name: 'CGST' })).toBeVisible();
    await expect(outputTable.getByRole('columnheader', { name: 'SGST' })).toBeVisible();
    await expect(outputTable.getByRole('columnheader', { name: 'Total Tax' })).toBeVisible();

    const hsnTable = page.getByText('HSN Summary').locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]//table');
    await expect(hsnTable.getByRole('columnheader', { name: 'HSN Code' })).toBeVisible();
    await expect(hsnTable.getByRole('columnheader', { name: 'Quantity' })).toBeVisible();
  });

  test('profit report loads with real filters, cost/margin columns, admin-only', async ({ page }) => {
    // report.profit is hard-denied to non-admins (cave law 2); the view
    // itself abort(403)s defensively if reached without the permission.
    // This test assumes the configured test login is admin-equivalent.
    // TODO: add a non-admin session variant that asserts a 403 once a
    // pharmacist/cashier test login is available.
    await page.goto('/reports/profit');
    await expect(page.getByRole('heading', { name: 'Profit Report', exact: true })).toBeVisible();

    await expect(page.getByLabel('From')).toBeVisible();
    await expect(page.getByLabel('To')).toBeVisible();
    await expect(page.getByLabel('Category')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Filter' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Export CSV' })).toBeVisible();

    const table = page.getByRole('table');
    await expect(table).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Date' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Medicine' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Category' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Qty Sold' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Revenue' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Cost (Snapshot)' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Profit' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Margin %' })).toBeVisible();
  });
});
