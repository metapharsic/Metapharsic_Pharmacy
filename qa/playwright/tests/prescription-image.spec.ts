import { test, expect } from '@playwright/test';
import { SaleShowPage } from './page-object-model/pages/sale-show-page';

// Attach prescription image feature (Phase 8b).
// Rewired onto the Page Object Model pattern (tests/page-object-model/pages)
// adopted from UKHO/playwright-template.
//
// Real route names: sales.index -> /sales, sales.show -> /sales/{sale},
// sales.prescription-image.store (POST) -> /sales/{sale}/prescription-image,
// sales.prescription-image.show (GET) -> /sales/{sale}/prescription-image.
// The whole prescription block only renders `@if ($sale->prescription)` —
// nothing shows for a sale with no prescription record. Within that, it is
// `@if ($sale->prescription->hasImage())` / `@else` — exactly one of "View
// prescription image" link or the upload form can render, never both.
//
// This spec cannot assume a specific sale ID exists with (or without) a
// prescription in a fresh seed, so tests inspect whatever /sales currently
// has and skip gracefully when the seed doesn't give them anything to check.

test.describe('Prescription image attachment', () => {
  test('sale detail page loads for the first sale in the index, if any exist', async ({ page }) => {
    await page.goto('/sales');

    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();
    test.skip(rowCount === 0, 'No seeded sales to test against — /sales index is empty.');

    const firstRowLink = rows.first().locator('a').first();
    await firstRowLink.click();

    await expect(page.getByRole('heading', { name: /Invoice /i })).toBeVisible();
  });

  test('prescription section, where present, shows exactly one of upload form or view link', async ({ page }) => {
    const sale = new SaleShowPage(page);
    await page.goto('/sales');

    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();
    test.skip(rowCount === 0, 'No seeded sales to test against — /sales index is empty.');

    const rowsToCheck = Math.min(rowCount, 5);
    let sawPrescriptionSection = false;

    for (let i = 0; i < rowsToCheck; i++) {
      await page.goto('/sales');
      const link = page.locator('table tbody tr').nth(i).locator('a').first();
      await link.click();
      await expect(page.getByRole('heading', { name: /Invoice /i })).toBeVisible();

      const hasUpload = (await sale.prescriptionImageInput.count()) > 0;
      const hasViewLink = (await sale.viewPrescriptionImageLink.count()) > 0;

      if (hasUpload || hasViewLink) {
        sawPrescriptionSection = true;
        expect(hasUpload && hasViewLink).toBe(false);

        if (hasUpload) {
          await expect(sale.prescriptionImageInput).toBeVisible();
          await expect(sale.uploadButton).toBeVisible();
        } else {
          await expect(sale.viewPrescriptionImageLink).toBeVisible();
        }
      }
    }

    test.skip(
      !sawPrescriptionSection,
      `No prescription record found on the first ${rowsToCheck} sale(s) checked — ` +
        'neither the upload form nor the "View prescription image" link rendered ' +
        'for any of them. This is expected for a seed with no Schedule-H sales and ' +
        'is not a failure of the feature.'
    );
  });

  // TODO: full upload-flow test — select a real file for the prescription
  // image input, submit the form (POST sales.prescription-image.store), and
  // assert the "View prescription image" link then appears in place of the
  // upload form. Requires a known sale ID that (a) has a prescription record
  // and (b) does not yet have an image attached, guaranteed by neither the
  // current seed nor this spec file.

  test('admin (storageState user) can see the upload form when a prescription exists without an image', async ({ page }) => {
    const sale = new SaleShowPage(page);
    await page.goto('/sales');

    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();
    test.skip(rowCount === 0, 'No seeded sales to test against — /sales index is empty.');

    const rowsToCheck = Math.min(rowCount, 5);
    let sawUploadForm = false;

    for (let i = 0; i < rowsToCheck; i++) {
      await page.goto('/sales');
      const link = page.locator('table tbody tr').nth(i).locator('a').first();
      await link.click();

      if (await sale.prescriptionImageInput.count()) {
        sawUploadForm = true;
        // The upload form is wrapped in @can('sale.view', $sale) in the
        // Blade source. This suite's storageState is the admin user, who
        // has sale.view per existing project convention, so we can only
        // assert the positive case here: admin CAN see it.
        await expect(sale.prescriptionImageInput).toBeVisible();
        await expect(sale.uploadButton).toBeVisible();
        break;
      }
    }

    test.skip(
      !sawUploadForm,
      `No sale with a prescription-but-no-image was found in the first ${rowsToCheck} sale(s) checked.`
    );

    // TODO: true negative permission test — assert a user WITHOUT sale.view
    // cannot see (or is blocked from submitting) the upload form. Needs a
    // second login fixture (a non-privileged storageState) this suite does
    // not currently have.
  });
});
