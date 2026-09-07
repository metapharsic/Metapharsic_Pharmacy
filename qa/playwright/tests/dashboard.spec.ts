import { test, expect } from '@playwright/test';

// Dashboard — verified against resources/views/dashboard/index.blade.php
// and components/stat-tile.blade.php.
//
// x-stat-tile renders as a <div> (or <a> when :href is set) with class
// "block rounded-lg border border-slate-200 bg-white p-4 shadow-sm" and
// an inner label div "text-xs font-medium uppercase tracking-wide
// text-slate-500" holding the exact label text, so tiles are located by
// role/text (getByText) rather than by CSS class.

test.describe('Dashboard', () => {
  test('dashboard page loads', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  });

  test('key stat tiles are visible with real labels', async ({ page }) => {
    await page.goto('/dashboard');

    // Always-rendered tiles (no @can gate).
    await expect(page.getByText("Today's Sales", { exact: true })).toBeVisible();
    await expect(page.getByText('Bills Today', { exact: true })).toBeVisible();
    await expect(page.getByText('Purchases Today', { exact: true })).toBeVisible();
    await expect(page.getByText('Cash in Drawer', { exact: true })).toBeVisible();

    // "Gross Profit" tile is wrapped in @can('report.profit') — only
    // present in the DOM for a session with that permission (cave law 2:
    // cashier/pharmacist sessions never see it, not even hidden via CSS).
    // TODO: assert presence/absence conditionally once test users with
    // known roles (admin vs cashier/pharmacist) are seeded — for now this
    // spec assumes an admin-equivalent login per playwright.config auth.
    await expect(page.getByText('Gross Profit', { exact: true })).toBeVisible();
  });

  test('alert boxes for expiry and stock are visible', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.getByText('Expiring in 30 Days', { exact: true })).toBeVisible();
    await expect(page.getByText('Expiring in 90 Days', { exact: true })).toBeVisible();
    await expect(page.getByText('Below Min Stock', { exact: true })).toBeVisible();
    await expect(page.getByText('Payment Due', { exact: true })).toBeVisible();
  });

  test('sales chart and top medicines sections render', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Sales — Last 30 Days' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Top 10 Medicines This Month' })).toBeVisible();

    // Table headers from the "Top 10 Medicines" table.
    const table = page.getByRole('heading', { name: 'Top 10 Medicines This Month' })
      .locator('xpath=following-sibling::table[1]');
    await expect(table.getByRole('columnheader', { name: 'Medicine' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Qty Sold' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Revenue' })).toBeVisible();

    // $topMedicines is now a real query (top 5 medicines by qty sold over
    // the trailing 30 days). On a shop with sales in that window the table
    // shows data rows; on a fresh/empty seed it correctly falls back to the
    // "No sales recorded this month yet." empty-state row (dashboard/
    // index.blade.php line 194). Don't assume seed data either way —
    // assert one of the two valid states.
    const emptyState = table.getByText('No sales recorded this month yet.');
    const dataRows = table.locator('tbody tr').filter({ hasNot: emptyState });
    await expect(emptyState.or(dataRows.first())).toBeVisible();
  });
});
