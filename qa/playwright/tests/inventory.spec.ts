import { test, expect } from '@playwright/test';

// Inventory — verified against resources/views/inventory/index.blade.php,
// inventory/low-stock.blade.php, and inventory/expiry-report.blade.php.

test.describe('Inventory', () => {
  test('inventory page loads with real filters and table', async ({ page }) => {
    await page.goto('/inventory');
    await expect(page.getByRole('heading', { name: 'Inventory', exact: true })).toBeVisible();

    // Filter form: x-form.select "Medicine", x-form.date "Expiry from"/"Expiry to".
    await expect(page.getByLabel('Medicine')).toBeVisible();
    await expect(page.getByLabel('Expiry from')).toBeVisible();
    await expect(page.getByLabel('Expiry to')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Filter' })).toBeVisible();

    // Real table headers: Medicine, Batch No., Expiry, Available Qty, Status.
    const table = page.getByRole('table');
    await expect(table).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Medicine' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Batch No.' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Expiry' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Available Qty' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Status' })).toBeVisible();
  });

  test('links to Racks Layout, Low stock and Expiry report are present', async ({ page }) => {
    await page.goto('/inventory');
    await expect(page.getByRole('link', { name: 'Racks Layout →' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Low stock →' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Expiry report →' })).toBeVisible();
  });

  test('low-stock report page loads with real heading and columns', async ({ page }) => {
    await page.goto('/inventory/low-stock');
    await expect(page.getByRole('heading', { name: 'Low Stock', exact: true })).toBeVisible();

    const table = page.getByRole('table');
    await expect(table).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Medicine' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Available Qty' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Min Stock Level' })).toBeVisible();

    // On a fresh, empty-of-low-stock seed the view renders this literal
    // empty-state row instead of data rows.
    // TODO: once a seed with a medicine below min_stock_level exists,
    // replace/extend this with an assertion on an actual data row.
  });

  test('expiry report page loads with real window filter and columns', async ({ page }) => {
    await page.goto('/inventory/expiry-report');
    await expect(page.getByRole('heading', { name: 'Expiry Report', exact: true })).toBeVisible();

    // x-form.select "Window" with options 30/60/90 days.
    const windowFilter = page.getByLabel('Window');
    await expect(windowFilter).toBeVisible();
    await expect(windowFilter.locator('option')).toHaveText(['30 days', '60 days', '90 days']);
    await expect(page.getByRole('button', { name: 'Apply' })).toBeVisible();

    const table = page.getByRole('table');
    await expect(table).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Medicine' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Batch No.' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Expiry' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Qty' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Supplier' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Flag' })).toBeVisible();
  });

  test.skip('stock adjustment flow from inventory (TODO)', async ({ page }) => {
    // TODO: no stock-adjustments Blade view was included in this staging
    // set, so no real selectors are available yet. Needs that view (or
    // the controller route) before writing against real markup.
  });
});
