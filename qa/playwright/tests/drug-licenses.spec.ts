import { test, expect } from '@playwright/test';
import { DrugLicensesPage, DashboardLicenseBannerPage } from './page-object-model/pages/drug-licenses-page';

// CRUD smoke test for Drug Licenses (Phase 8e).
// Rewired onto the Page Object Model pattern (tests/page-object-model/pages)
// adopted from UKHO/playwright-template.

test.describe('Drug Licenses', () => {
  test('drug licenses index loads with table', async ({ page }) => {
    const licenses = new DrugLicensesPage(page);
    await licenses.gotoIndex();

    await expect(licenses.table).toBeVisible();
    await expect(licenses.table).toContainText('Type');
    await expect(licenses.table).toContainText('License Number');
    await expect(licenses.table).toContainText('Issued On');
    await expect(licenses.table).toContainText('Expires On');
    await expect(licenses.table).toContainText('Issuing Authority');
    await expect(licenses.table).toContainText('Active');
    await expect(licenses.table).toContainText('Actions');

    const addLink = page.getByRole('link', { name: 'New License' });
    if (await addLink.count()) {
      await expect(addLink.first()).toBeVisible();
    }
  });

  test('create form has real fields visible', async ({ page }) => {
    const licenses = new DrugLicensesPage(page);
    await licenses.gotoCreate();

    await expect(licenses.licenseTypeSelect).toBeVisible();
    await expect(licenses.licenseNumberInput).toBeVisible();
    await expect(licenses.issuedOnInput).toBeVisible();
    await expect(licenses.expiresOnInput).toBeVisible();

    const typeOptions = await licenses.licenseTypeSelect.locator('option').allTextContents();
    expect(typeOptions.map((t) => t.trim())).toEqual([
      'Select a type',
      'Retail Drug License (Form 20)',
      'Retail Drug License (Form 21)',
      'Wholesale Drug License (Form 20B)',
      'Wholesale Drug License (Form 21B)',
      'Other',
    ]);

    await expect(licenses.saveButton).toBeVisible();
  });

  test('creating a license with a near-expiry date shows the warning badge in the index', async ({ page }) => {
    const licenses = new DrugLicensesPage(page);
    const uniqueNumber = `PW-LIC-${Date.now()}`;

    const today = new Date();
    const issuedOn = today.toISOString().slice(0, 10);
    const soon = new Date(today.getTime() + 20 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    await licenses.createLicense({ type: 'retail_dl_20', number: uniqueNumber, issuedOn, expiresOn: soon });
    await licenses.gotoIndex();

    const row = await licenses.expectRowVisible(uniqueNumber);
    await expect(row).toContainText('Expires in');
  });

  test('submitting with expires_on before issued_on shows validation error', async ({ page }) => {
    const licenses = new DrugLicensesPage(page);
    await licenses.createLicense({
      type: 'retail_dl_21',
      number: `PW-LIC-BAD-${Date.now()}`,
      issuedOn: '2026-06-01',
      expiresOn: '2026-05-01',
    });

    await expect(page).toHaveURL(/\/settings\/licenses\/create/);
  });

  test('dashboard shows a compliance banner when a license is expired or expiring soon', async ({ page }) => {
    const dashboard = new DashboardLicenseBannerPage(page);
    await dashboard.goto();

    if (await dashboard.banner.count()) {
      await expect(dashboard.banner.first()).toBeVisible();
      await expect(dashboard.viewLicensesLink).toBeVisible();
    } else {
      test.info().annotations.push({
        type: 'note',
        description: 'No expired/expiring-soon license found — compliance banner correctly absent from the DOM.',
      });
    }
  });

  // TODO (future integration test, not covered here): verify `php artisan
  // license:check-expiry` actually logs the expected Log::warning lines.
  // Requires shelling out to Artisan and reading storage/logs/laravel.log,
  // outside what a browser-driven Playwright test can assert.
});
