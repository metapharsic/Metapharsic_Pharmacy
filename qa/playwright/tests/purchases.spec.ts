import { test, expect } from '@playwright/test';

// Purchases — verified against resources/views/purchases/index.blade.php
// and purchases/create.blade.php.

test.describe('Purchases', () => {
  test('purchases index loads with real filter and table', async ({ page }) => {
    await page.goto('/purchases');
    await expect(page.getByRole('heading', { name: 'Purchases', exact: true })).toBeVisible();

    // Status filter select, name="status", options All/Draft/Confirmed/Cancelled.
    const statusFilter = page.getByLabel('Status');
    await expect(statusFilter).toBeVisible();
    await expect(statusFilter.locator('option')).toHaveText(['All', 'Draft', 'Confirmed', 'Cancelled']);

    // x-data-table columns: Invoice #, Supplier, Date, Status, Total.
    const table = page.getByRole('table');
    await expect(table).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Invoice #' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Supplier' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Date' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Status' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Total' })).toBeVisible();
  });

  test('"New Purchase" link is visible for a user with purchase.create', async ({ page }) => {
    await page.goto('/purchases');
    // Gated by @can('purchase.create'); assumes the configured test login
    // has that permission. TODO: add a negative-permission variant once a
    // non-purchasing test role is seeded.
    await expect(page.getByRole('link', { name: 'New Purchase' })).toBeVisible();
  });

  test('create a purchase order with a line item', async ({ page }) => {
    await page.goto('/purchases/create');
    await expect(page.getByRole('heading', { name: 'New Purchase' })).toBeVisible();

    // Header fields: x-form.select "Supplier", x-form.input "Invoice No.",
    // x-form.date "Invoice Date". x-form components render a <label for>
    // matching the input id, so getByLabel works.
    const supplierSelect = page.getByLabel('Supplier');
    await expect(supplierSelect).toBeVisible();
    // TODO: confirm at least one supplier exists in the fresh seed before
    // selecting by label text; falling back to selecting the first
    // non-empty option index if a named supplier isn't guaranteed.
    await supplierSelect.selectOption({ index: 1 });

    await page.getByLabel('Invoice No.').fill('INV-TEST-0001');
    await page.getByLabel('Invoice Date').fill('2026-08-20');

    // Single line item row (Alpine x-for), fields keyed by name pattern
    // items[0][...]. Medicine select has placeholder option "Select
    // Medicine…"; other fields are plain inputs with no <label> (Alpine
    // :name / x-model only) so CSS attribute selectors on the real name
    // attributes are the correct fallback here, not a guess.
    const lineRow = page.locator('tbody tr').first();
    await lineRow.locator('select[name="items[0][medicine_id]"]').selectOption({ index: 1 });
    await lineRow.locator('input[name="items[0][batch_no]"]').fill('BATCH-TEST-01');
    await lineRow.locator('input[name="items[0][expiry_date]"]').fill('2027-12-31');
    await lineRow.locator('input[name="items[0][quantity]"]').fill('10');
    await lineRow.locator('input[name="items[0][free_quantity]"]').fill('0');
    await lineRow.locator('input[name="items[0][purchase_price]"]').fill('50.00');
    await lineRow.locator('input[name="items[0][mrp]"]').fill('80.00');
    await lineRow.locator('input[name="items[0][selling_price]"]').fill('70.00');
    await lineRow.locator('select[name="items[0][gst_rate]"]').selectOption('12');

    // Client-side "Subtotal (indicative)" — never sent to the server, so
    // only assert it's present/computed, not that it drives the save.
    await expect(page.getByText('Subtotal (indicative)')).toBeVisible();

    await page.getByRole('button', { name: 'Save Draft' }).click();

    // TODO: after submit, PurchaseService recomputes totals server-side;
    // assert redirect to purchases.show and correct persisted totals once
    // a known-good seed/fixture for suppliers+medicines exists to make
    // this deterministic (currently supplier/medicine picked by index,
    // which is fragile against seed order).
  });

  test('"+ Add line" adds another line item row', async ({ page }) => {
    await page.goto('/purchases/create');
    const addLineButton = page.getByRole('button', { name: '+ Add line' });
    await expect(addLineButton).toBeVisible();
    await addLineButton.click();
    await expect(page.locator('tbody tr')).toHaveCount(2);
  });

  test.skip('view purchase detail (TODO)', async ({ page }) => {
    // TODO: purchases/show.blade.php exists in the app but wasn't read for
    // this pass — selectors here are still route-only. Needs a known
    // purchase id from a seeded fixture (e.g. via the create flow above),
    // plus a read of the real view markup, before this can be written
    // against real selectors instead of guesses.
  });
});
