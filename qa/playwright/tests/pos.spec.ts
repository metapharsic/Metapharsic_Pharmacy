import { test, expect } from '@playwright/test';

// Smoke test for the Point of Sale screen (resources/views/pos/index.blade.php,
// pos/_search-results.blade.php, pos/_payment-panel.blade.php).
//
// Selectors below are verified against that real markup. Where a flow needs
// markup that lives outside these three files (e.g. the F2 "new customer"
// modal, whose contents are explicitly "omitted for brevity" in
// index.blade.php), a TODO names the missing file instead of guessing.

test.describe('POS', () => {
  test('POS page loads and search box is present', async ({ page }) => {
    await page.goto('/pos');
    await expect(page.locator('body')).toBeVisible();

    // Real selector: aria-label="Medicine search" (index.blade.php line 82),
    // also has x-ref="search" and placeholder "Search medicine, or scan barcode…".
    const searchBox = page.getByLabel('Medicine search');
    await expect(searchBox).toBeVisible();
    await expect(searchBox).toBeFocused(); // autofocus attribute on the input
  });

  test('can search for a medicine', async ({ page }) => {
    await page.goto('/pos');

    const searchBox = page.getByLabel('Medicine search');

    // TODO: replace with a medicine name known to exist in the seeded test database.
    await searchBox.fill('Paracetamol');

    // Real behaviour: @input.debounce.120ms="onSearchInput()" — live search,
    // no submit/button. Wait past the 120ms debounce plus the /api/pos/medicines
    // round trip.
    await page.waitForTimeout(300);

    // Real selector: the results dropdown is the div with x-show="ui.searchOpen"
    // in pos/_search-results.blade.php; each row is a div rendered by
    // x-for="(result, idx) in ui.searchResults" containing a span.font-medium
    // with the medicine name (x-text="result.name"). There is no data-testid /
    // stable class hook, so we scope by the visible name text.
    const resultRow = page.locator('div').filter({ hasText: 'Paracetamol' }).last();
    await expect(resultRow.first()).toBeVisible({ timeout: 5000 });
  });

  test('add medicine to cart', async ({ page }) => {
    await page.goto('/pos');

    const searchBox = page.getByLabel('Medicine search');
    // TODO: replace with a medicine name known to exist in the seeded test database.
    await searchBox.fill('Paracetamol');
    await page.waitForTimeout(300);

    // Real selector: clicking the result div fires
    // @click="addMedicineToCart(result); ui.searchOpen = false"
    // (pos/_search-results.blade.php line 13-14). Scope to the font-medium
    // name span's row via text match since there's no data-testid.
    const resultRow = page.locator('div').filter({ hasText: 'Paracetamol' }).last();
    await resultRow.click();

    // Real selector: cart lines render as <tr> inside the cart <table>'s
    // <tbody class="text-lg tabular-nums"> (index.blade.php lines 102-152),
    // one row per line via x-for="(line, index) in lines". The medicine name
    // is in a div.font-medium (x-text="line.medicine.name") in the first <td>.
    const cartRows = page.locator('table tbody tr');
    await expect(cartRows).toHaveCount(1);
    await expect(cartRows.first().locator('td').first()).toContainText('Paracetamol');

    // Real selector: per-line remove button, aria-label="Remove line"
    // (index.blade.php line 145) — confirms the row structure independently.
    await expect(cartRows.first().getByLabel('Remove line')).toBeVisible();
  });

  test('opens payment panel and shows Save & Print button', async ({ page }) => {
    await page.goto('/pos');

    const searchBox = page.getByLabel('Medicine search');
    await searchBox.fill('Paracetamol');
    await page.waitForTimeout(300);
    await page.locator('div').filter({ hasText: 'Paracetamol' }).last().click();

    // Real behaviour: F4 opens the payment panel, but only once lines.length > 0
    // (index.blade.php handleKey(), case 'F4'). It's a global keydown handler
    // (@keydown.window="handleKey($event)"), not a button — there is no visible
    // "open payment" button in this markup.
    await page.keyboard.press('F4');

    // Real selector: payment panel root is a div[role="dialog"][aria-label="Payment"]
    // (pos/_payment-panel.blade.php line 7).
    const paymentPanel = page.getByRole('dialog', { name: 'Payment' });
    await expect(paymentPanel).toBeVisible();

    // Real selector: checkout/save button text "Save & Print (Enter)"
    // (pos/_payment-panel.blade.php lines 62-69); it's disabled until a
    // payment row exists, so select a payment mode first.
    await paymentPanel.getByRole('button', { name: 'Cash' }).click();
    const saveButton = paymentPanel.getByRole('button', { name: 'Save & Print (Enter)' });
    await expect(saveButton).toBeEnabled();
  });

  // TODO: "held bills" (F9 hold / F10 recall) use window.prompt() for the slot
  // number (index.blade.php holdBill()/promptRecall()) rather than any input
  // element in this markup, and the held-slot indicators
  // (index.blade.php lines 168-180) are plain non-interactive <span> chips with
  // no click handler — there is no "held-bills button" to select in these 3
  // files. Testing the hold/recall flow needs a page.on('dialog', ...) handler
  // plus confirmation of what UI (if any) triggers it outside a raw F9/F10
  // keypress; leaving unimplemented rather than guessing.

  test('bill discount input updates totals', async ({ page }) => {
    await page.goto('/pos');

    const searchBox = page.getByLabel('Medicine search');
    await searchBox.fill('Paracetamol');
    await page.waitForTimeout(300);
    await page.locator('div').filter({ hasText: 'Paracetamol' }).last().click();

    // Real selector: aria-label="Bill discount percent" input in the totals
    // strip (index.blade.php line 166), x-model.number="billDiscountPercent",
    // fires requote() on @change.
    const discountInput = page.getByLabel('Bill discount percent');
    await expect(discountInput).toBeVisible();

    const totalsStrip = page.locator('div.flex.items-center.justify-end.gap-6');
    const discountValue = totalsStrip.locator('span', { hasText: 'Bill discount %' }).locator('strong');
    const totalBefore = await discountValue.textContent();

    await discountInput.fill('10');
    await discountInput.blur(); // triggers @change="requote()"

    // requote() is an async round trip; ui.quoting drives the "recalculating…"
    // indicator (line 177) while it's in flight, so wait for it to settle
    // rather than assuming a fixed delay.
    const recalculating = page.getByText('recalculating…');
    await expect(recalculating).toHaveCount(0, { timeout: 5000 });

    await expect(discountValue).not.toHaveText(totalBefore ?? '—');
  });

  // TODO: F2 "new customer" modal markup is explicitly not present here
  // ("F2 new customer modal (markup omitted for brevity...)",
  // index.blade.php line 188) — needs the real modal partial/view file before
  // a selector can be written.
});
