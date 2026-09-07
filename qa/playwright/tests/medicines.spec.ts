import { test, expect } from '@playwright/test';

// CRUD smoke test for Medicines, based on real Blade source:
//   resources/views/medicines/index.blade.php
//   resources/views/medicines/create.blade.php
//   resources/views/medicines/_form.blade.php
//   resources/views/components/form/{select,input}.blade.php
//
// Route names (Laravel resource routes): medicines.index -> /medicines,
// medicines.create -> /medicines/create, medicines.store (POST) -> /medicines.

test.describe('Medicines', () => {
  test('medicines index loads with table', async ({ page }) => {
    await page.goto('/medicines');

    // x-data-table renders a real <table> with these column headers.
    const table = page.locator('table');
    await expect(table.first()).toBeVisible();
    await expect(table.first()).toContainText('Name');
    await expect(table.first()).toContainText('Generic');
    await expect(table.first()).toContainText('Category');
    await expect(table.first()).toContainText('Manufacturer');
    await expect(table.first()).toContainText('GST');
    await expect(table.first()).toContainText('Min stock');
    await expect(table.first()).toContainText('Rx');
    await expect(table.first()).toContainText('Status');

    // "Add medicine" link, gated by @can('medicine.create') — only assert
    // if visible for the current test user's permissions.
    const addLink = page.getByRole('link', { name: 'Add medicine' });
    if (await addLink.count()) {
      await expect(addLink.first()).toBeVisible();
    }
  });

  test('create form has real fields visible', async ({ page }) => {
    await page.goto('/medicines/create');

    // Identity section
    await expect(page.locator('input#name[name="name"]')).toBeVisible();
    await expect(page.locator('input#generic_name[name="generic_name"]')).toBeVisible();
    await expect(page.locator('input#barcode[name="barcode"]')).toBeVisible();
    await expect(page.locator('input#hsn_code[name="hsn_code"]')).toBeVisible();

    // Classification section
    await expect(page.locator('select#category_id[name="category_id"]')).toBeVisible();
    await expect(page.locator('select#manufacturer_id[name="manufacturer_id"]')).toBeVisible();
    await expect(page.locator('input#unit[name="unit"]')).toBeVisible();

    // Spatial rack placement & climate section
    await expect(page.locator('select#storage_zone_id[name="storage_zone_id"]')).toBeVisible();
    await expect(page.locator('select#storage_temperature[name="storage_temperature"]')).toBeVisible();
    await expect(page.locator('select#rack_id[name="rack_id"]')).toBeVisible();
    await expect(page.locator('select#rack_shelf_id[name="rack_shelf_id"]')).toBeVisible();
    await expect(page.locator('input#rack_location[name="rack_location"]')).toBeVisible();

    // Tax and stock rules section
    await expect(page.locator('select#gst_rate[name="gst_rate"]')).toBeVisible();
    await expect(page.locator('input#pack_size[name="pack_size"]')).toBeVisible();
    await expect(page.locator('input#min_stock_level[name="min_stock_level"]')).toBeVisible();
    await expect(
      page.locator('input[type="checkbox"][name="is_prescription_required"]')
    ).toBeVisible();
    await expect(page.locator('input[type="checkbox"][name="is_active"]')).toBeVisible();

    // GST rate select is constrained to a DB CHECK slab of 0/5/12/18.
    const gstOptions = await page.locator('select#gst_rate option').allTextContents();
    expect(gstOptions.map((t) => t.trim())).toEqual(['0%', '5%', '12%', '18%']);

    // Submit button text, from create.blade.php.
    await expect(page.getByRole('button', { name: 'Save medicine' })).toBeVisible();
  });

  test('submitting with required Name empty shows validation error', async ({ page }) => {
    await page.goto('/medicines/create');

    // "name" is the only field with no default/nullable hint in _form.blade.php
    // and is the natural required field (autofocus, no "Optional" caption,
    // unlike barcode). Leave it empty and submit.
    await page.locator('input#name[name="name"]').fill('');
    await page.getByRole('button', { name: 'Save medicine' }).click();

    // create.blade.php renders a top-of-form error summary box when
    // $errors->any() is true (aria-live="assertive", red-themed).
    const errorSummary = page.locator('[aria-live="assertive"]');
    await expect(errorSummary).toBeVisible();

    // Per-field error text renders via @error('name') as a <p> immediately
    // after the #name input (component/form/input.blade.php pattern is not
    // used here — _form.blade.php inlines the same @error block directly).
    const nameFieldError = page
      .locator('input#name')
      .locator('xpath=following-sibling::p[contains(@class, "text-red-600")]');
    await expect(nameFieldError.first()).toBeVisible();
  });

  test('creating a medicine shows it in the index table', async ({ page }) => {
    const uniqueName = `Playwright Test Medicine ${Date.now()}`;

    await page.goto('/medicines/create');
    await page.locator('input#name[name="name"]').fill(uniqueName);
    // unit has a default value of "strip" already filled in; category_id,
    // manufacturer_id, storage_zone_id, rack_id, rack_shelf_id all have a
    // "— None —" / "— Select … —" option and are not marked required in the
    // form markup, so they are left at their defaults here.

    await page.getByRole('button', { name: 'Save medicine' }).click();

    // TODO: confirm post-create redirect target — controller behavior
    // (redirect to medicines.index vs medicines.show) isn't visible in the
    // Blade views read for this test, so we assert on the index page
    // directly rather than on the immediate post-submit URL.
    await page.goto('/medicines');

    const row = page.locator('table tr', { hasText: uniqueName });
    await expect(row.first()).toBeVisible();
  });
});
