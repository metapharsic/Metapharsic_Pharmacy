import { test, expect } from '@playwright/test';

// Returns — verified against resources/views/returns/create.blade.php.
// Note: no returns/index.blade.php was provided in this staging set, so
// the previous "returns index loads" test (asserting a generic table at
// /returns) is replaced — its selectors and even its route were guessed
// and unverifiable against real markup.

test.describe('Returns', () => {
  test('return lookup form loads with real invoice-number field', async ({ page }) => {
    await page.goto('/returns/create');
    await expect(page.getByRole('heading', { name: 'Process return' })).toBeVisible();

    // Shown only when no sale is resolved yet (! $sale): x-form.input
    // name="invoice_no" label "Invoice number", with a hint.
    const invoiceInput = page.getByLabel('Invoice number');
    await expect(invoiceInput).toBeVisible();
    await expect(page.getByText('Enter the invoice number to look up the sale.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Find sale' })).toBeVisible();
  });

  test.skip('process a return against an existing sale (TODO)', async ({ page }) => {
    // TODO: this flow requires GET /returns/create?invoice_no=... to
    // resolve a real $sale with $sale->items — i.e. a seeded sale invoice
    // number known ahead of time. Once such a fixture exists, the real
    // per-line markup to assert against is:
    //   - one checkbox per remaining line: name="lines[{i}][sale_item_id]"
    //     value={item id}, aria-label "Include line" (only rendered when
    //     remaining > 0)
    //   - quantity input: name="lines[{i}][quantity]",
    //     aria-label "Return quantity", min=1, max={remaining}
    //   - condition select: name="lines[{i}][condition]" with options
    //     "Good — restock" (good) / "Damaged — quarantine" (damaged) /
    //     "Expired — quarantine" (expired)
    //   - reason textarea: x-form.textarea name="reason" label "Reason"
    //   - submit button: "Process return"
    // e.g.:
    //   await page.goto('/returns/create?invoice_no=<seeded-invoice>');
    //   await page.getByLabel('Include line').first().check();
    //   await page.getByLabel('Return quantity').first().fill('1');
    //   await page.getByLabel('Reason').fill('Customer changed mind');
    //   await page.getByRole('button', { name: 'Process return' }).click();
  });
});
