import { test, expect } from '@playwright/test';
import { DiscountSchemesPage } from './page-object-model/pages/discount-schemes-page';

// CRUD smoke test for Discount Schemes.
// Rewired onto the Page Object Model pattern (tests/page-object-model/pages)
// adopted from UKHO/playwright-template.
//
// Route names (Laravel resource routes): discount-schemes.index -> /discount-schemes,
// discount-schemes.create -> /discount-schemes/create, discount-schemes.store (POST) ->
// /discount-schemes. All gated by `can:scheme.manage`, admin-only.

test.describe('Discount Schemes', () => {
  test('discount schemes index loads with table', async ({ page }) => {
    const schemes = new DiscountSchemesPage(page);
    await schemes.gotoIndex();

    await expect(schemes.table).toBeVisible();
    await expect(schemes.table).toContainText('Name');
    await expect(schemes.table).toContainText('Type');
    await expect(schemes.table).toContainText('Applies To');
    await expect(schemes.table).toContainText('Terms');
    await expect(schemes.table).toContainText('Active');
    await expect(schemes.table).toContainText('Dates');
    await expect(schemes.table).toContainText('Actions');

    const addLink = page.getByRole('link', { name: 'New Scheme' });
    if (await addLink.count()) {
      await expect(addLink.first()).toBeVisible();
    }
  });

  test('create form has real fields visible', async ({ page }) => {
    const schemes = new DiscountSchemesPage(page);
    await schemes.gotoCreate();

    await expect(schemes.nameInput).toBeVisible();
    await expect(schemes.typeSelect).toBeVisible();
    await expect(schemes.scopeRadio('medicine')).toBeVisible();
    await expect(schemes.scopeRadio('category')).toBeVisible();

    const typeOptions = await schemes.typeSelect.locator('option').allTextContents();
    expect(typeOptions.map((t) => t.trim())).toEqual([
      'Select a type',
      'Buy X Get Y Free',
      'Slab Discount',
    ]);

    // x-show elements are attached but not necessarily visible until a
    // scope/type is picked — presence only here, visibility asserted in the
    // create-flow test below after the matching selection is made.
    await expect(schemes.medicineSelect).toBeAttached();
    await expect(schemes.categorySelect).toBeAttached();
    await expect(schemes.buyQtyInput).toBeAttached();
    await expect(schemes.getQtyInput).toBeAttached();
    await expect(schemes.minQtyInput).toBeAttached();
    await expect(schemes.slabDiscountPercentInput).toBeAttached();

    await expect(schemes.startsOnInput).toBeVisible();
    await expect(schemes.endsOnInput).toBeVisible();
    await expect(page.locator('input[type="checkbox"][name="is_active"]')).toBeVisible();
    await expect(schemes.saveButton).toBeVisible();
  });

  test('creating a "buy 2 get 1 free" scheme shows it in the index table', async ({ page }) => {
    const schemes = new DiscountSchemesPage(page);
    const uniqueName = `Playwright Buy2Get1 Scheme ${Date.now()}`;

    await schemes.gotoCreate();
    await schemes.nameInput.fill(uniqueName);
    await schemes.typeSelect.selectOption('buy_x_get_y');
    await schemes.scopeRadio('medicine').check();

    await expect(schemes.medicineSelect).toBeVisible();
    const medicineOptions = schemes.medicineSelect.locator('option');
    const optionCount = await medicineOptions.count();
    if (optionCount > 1) {
      const firstRealValue = await medicineOptions.nth(1).getAttribute('value');
      if (firstRealValue) {
        await schemes.medicineSelect.selectOption(firstRealValue);
      }
    } else {
      test.info().annotations.push({
        type: 'note',
        description: 'medicine_id select had no options beyond the placeholder; skipped selecting a medicine.',
      });
    }

    await schemes.buyQtyInput.fill('2');
    await schemes.getQtyInput.fill('1');
    await schemes.saveButton.click();

    await schemes.gotoIndex();

    const row = await schemes.expectRowVisible(uniqueName);
    await expect(row).toContainText('Buy X Get Y');
    await expect(row).toContainText('Buy 2 Get 1 Free');
  });

  test('submitting with required Name empty shows validation error', async ({ page }) => {
    const schemes = new DiscountSchemesPage(page);
    await schemes.gotoCreate();

    await schemes.nameInput.fill('');
    await schemes.saveButton.click();

    await expect(schemes.fieldError('name').first()).toBeVisible();
  });

  // TODO (future integration test, not covered here): verify a discount
  // scheme actually auto-applies its discount at POS checkout. Requires a
  // full POS cart flow against seeded fixture data this spec file has no
  // guarantee exists.
});
