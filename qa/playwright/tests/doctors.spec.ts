import { test, expect } from '@playwright/test';
import { DoctorsPage, CustomerDoctorLinkPage } from './page-object-model/pages/doctors-page';

// CRUD + customer-linkage smoke test for Doctor master (Phase 8c).
// Rewired onto the Page Object Model pattern (tests/page-object-model/pages)
// adopted from UKHO/playwright-template.

test.describe('Doctors', () => {
  test('doctors index loads with table and active-only filter', async ({ page }) => {
    const doctors = new DoctorsPage(page);
    await doctors.gotoIndex();

    await expect(doctors.table).toBeVisible();
    await expect(doctors.table).toContainText('Name');
    await expect(doctors.table).toContainText('Registration No.');
    await expect(doctors.table).toContainText('Phone');
    await expect(doctors.table).toContainText('Specialization');
    await expect(doctors.table).toContainText('Active');
    await expect(doctors.table).toContainText('Actions');

    await expect(doctors.activeOnlyFilter).toBeAttached();

    const addLink = page.getByRole('link', { name: 'New Doctor' });
    if (await addLink.count()) {
      await expect(addLink.first()).toBeVisible();
    }
  });

  test('active-only filter round-trips as ?active=1', async ({ page }) => {
    const doctors = new DoctorsPage(page);
    await doctors.gotoIndex();

    if (await doctors.activeOnlyFilter.count()) {
      await doctors.activeOnlyFilter.check();
      await expect(page).toHaveURL(/[?&]active=1\b/);
    }
  });

  test('create form has real fields visible', async ({ page }) => {
    const doctors = new DoctorsPage(page);
    await doctors.gotoCreate();

    await expect(doctors.nameInput).toBeVisible();
    await expect(doctors.registrationNoInput).toBeVisible();
    await expect(doctors.specializationInput).toBeVisible();
    await expect(doctors.saveButton).toBeVisible();
  });

  test('creating a doctor shows it in the index table', async ({ page }) => {
    const doctors = new DoctorsPage(page);
    const uniqueName = `Playwright Dr ${Date.now()}`;

    await doctors.createDoctor({ name: uniqueName, registrationNo: 'MCI-12345', specialization: 'General Medicine' });
    await doctors.gotoIndex();

    const row = await doctors.expectRowVisible(uniqueName);
    await expect(row).toContainText('MCI-12345');
    await expect(row).toContainText('General Medicine');
  });

  test('submitting with required Name empty shows validation error', async ({ page }) => {
    const doctors = new DoctorsPage(page);
    await doctors.gotoCreate();

    await doctors.nameInput.fill('');
    await doctors.saveButton.click();

    await expect(doctors.fieldError('name').first()).toBeVisible();
  });

  test('new customer form shows both doctor_id select and legacy doctor_name field', async ({ page }) => {
    const link = new CustomerDoctorLinkPage(page);
    await link.gotoCreate();

    await expect(link.doctorSelect).toBeVisible();
    await expect(link.doctorSelect.locator('option').first()).toHaveText('— Not listed —');
    await expect(link.doctorNameLegacyInput).toBeVisible();
  });

  test('a newly created doctor appears as an option in the customer doctor_id select', async ({ page }) => {
    const doctors = new DoctorsPage(page);
    const link = new CustomerDoctorLinkPage(page);
    const uniqueName = `Playwright Linkable Dr ${Date.now()}`;

    await doctors.createDoctor({ name: uniqueName });
    await link.gotoCreate();

    await expect(link.doctorOption(uniqueName)).toHaveCount(1);
  });

  // TODO (future integration test, not covered here): verify that
  // customers/edit.blade.php's doctor_id <select> pre-selects the customer's
  // currently linked doctor. Requires a seeded customer already linked to a
  // doctor, which this spec file has no guarantee exists.
});
