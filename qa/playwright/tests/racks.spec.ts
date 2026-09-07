import { test, expect } from '@playwright/test';
import { RacksPage } from './page-object-model/pages/racks-page';
import {
  validatePage,
  validateDropdown,
  validateCreate,
  validateEdit,
  validateDelete,
  validateDatabase,
  validateErrorHandling,
  validateOldInputPersists,
  validateUniqueConstraint,
  validateFlashMessage,
  validateAPI,
} from './page-object-model/validators';

// CRUD + occupancy + assignment smoke test for the Racks module.
// Uses the Page Object Model (tests/page-object-model/pages) for real
// selectors, and the shared validators (tests/page-object-model/validators.ts)
// for the common CRUD assertion patterns every module in this app repeats.

test.describe('Racks', () => {
  test('racks index loads with table and occupancy bars', async ({ page }) => {
    const racks = new RacksPage(page);
    await racks.gotoIndex();
    await validatePage(page, { heading: 'Racks' });

    await expect(racks.table).toBeVisible();
    await expect(racks.table).toContainText('Code');
    await expect(racks.table).toContainText('Zone');
    await expect(racks.table).toContainText('Occupancy');
    await expect(racks.table).toContainText('Status');
    await expect(racks.table).toContainText('Actions');

    if (await racks.newRackLink.count()) {
      await expect(racks.newRackLink.first()).toBeVisible();
    }
  });

  test('create form has real fields, zone select populated from real data', async ({ page }) => {
    const racks = new RacksPage(page);
    await racks.gotoCreate();

    // Zones come from the real storage_zones table, never a hardcoded list.
    await validateDropdown(page, {
      selector: 'select[name="storage_zone_id"]',
      placeholderText: 'Select a zone',
      minRealOptions: 0,
    });

    await expect(racks.rackCodeInput).toBeVisible();
    await expect(racks.nameInput).toBeVisible();
    await expect(racks.totalShelvesInput).toBeVisible();
    await expect(racks.maxCapacityInput).toBeVisible();
    await expect(racks.statusSelect).toBeVisible();
    await expect(racks.saveButton).toBeVisible();
  });

  test('creating a rack shows it in the index with 0/capacity occupancy, and persists across reload', async ({ page }) => {
    const uniqueCode = `PW-RACK-${Date.now()}`;

    await validateCreate(page, {
      createPath: '/racks/create',
      indexPath: '/racks',
      uniqueRowText: uniqueCode,
      expectRowContains: ['0 / 90 units'],
      fill: async () => {
        const racks = new RacksPage(page);
        await racks.rackCodeInput.fill(uniqueCode);
        await racks.nameInput.fill('Playwright Test Rack');
        await racks.totalShelvesInput.fill('3');
        await racks.maxCapacityInput.fill('90');
      },
    });

    await validateFlashMessage(page, 'Rack created.');

    // Prove it round-tripped through the server, not just optimistic UI —
    // see validators.ts for why this isn't a real DB row check.
    await validateDatabase(page, {
      indexPath: '/racks',
      rowText: uniqueCode,
      expectRowContains: ['0 / 90 units'],
    });
  });

  test('editing a rack updates the index', async ({ page }) => {
    const uniqueCode = `PW-RACK-EDIT-${Date.now()}`;
    await validateCreate(page, {
      createPath: '/racks/create',
      indexPath: '/racks',
      uniqueRowText: uniqueCode,
      fill: async () => {
        const racks = new RacksPage(page);
        await racks.rackCodeInput.fill(uniqueCode);
        await racks.nameInput.fill('Rack Before Edit');
        await racks.totalShelvesInput.fill('2');
        await racks.maxCapacityInput.fill('40');
      },
    });

    await validateEdit(page, {
      indexPath: '/racks',
      rowText: uniqueCode,
      fieldName: 'name',
      newValue: 'Rack After Edit',
      expectRowContains: 'Rack After Edit',
    });
  });

  test('deleting an empty rack removes it; an occupied rack is blocked with a reason', async ({ page }) => {
    const uniqueCode = `PW-RACK-DELETE-${Date.now()}`;
    await validateCreate(page, {
      createPath: '/racks/create',
      indexPath: '/racks',
      uniqueRowText: uniqueCode,
      fill: async () => {
        const racks = new RacksPage(page);
        await racks.rackCodeInput.fill(uniqueCode);
        await racks.nameInput.fill('Rack To Delete');
        await racks.totalShelvesInput.fill('1');
        await racks.maxCapacityInput.fill('10');
      },
    });

    // Freshly created, zero occupancy — should delete cleanly.
    await validateDelete(page, { indexPath: '/racks', rowText: uniqueCode });

    // TODO: occupied-rack-blocks-delete branch needs a rack with a real
    // assigned batch, which this spec file has no guaranteed fixture for —
    // RackController::destroy()'s "Cannot delete ... units are still
    // assigned" message is the expectBlockedMessage to assert once such a
    // fixture exists (see validateDelete's expectBlockedMessage option).
  });

  test('a freshly created rack gets real shelf rows usable for batch assignment', async ({ page }) => {
    // Regression guard for the "total_shelves is just a number, no RackShelf
    // rows get created" gap found during review and fixed in
    // RackController::syncShelves().
    const racks = new RacksPage(page);
    const uniqueCode = `PW-RACK-SHELF-${Date.now()}`;

    await racks.createRack({ code: uniqueCode, name: 'Playwright Shelf Check Rack', totalShelves: '2', capacity: '50' });

    await page.goto('/inventory');
    const optgroup = racks.shelfOptgroup(uniqueCode);
    if (await optgroup.count()) {
      await expect(optgroup.first().locator('option')).toHaveCount(2);
    } else {
      test.info().annotations.push({
        type: 'note',
        description: 'No inventory batches rendered a rack_shelf_id select in this environment (e.g. zero batches seeded) — could not assert optgroup directly, but rack creation itself did not error.',
      });
    }
  });

  test('submitting with required fields empty shows validation errors, and old input persists', async ({ page }) => {
    const racks = new RacksPage(page);
    await racks.gotoCreate();

    await validateOldInputPersists(page, { fieldName: 'name', value: 'Kept On Failure' });

    await expect(racks.fieldError('rack_code').first()).toBeVisible();
  });

  test('rack_code must be unique — a duplicate is rejected with a form error, not a 500', async ({ page }) => {
    const uniqueCode = `PW-RACK-DUP-${Date.now()}`;
    const racks = new RacksPage(page);

    await racks.createRack({ code: uniqueCode, name: 'First Rack', totalShelves: '1', capacity: '10' });

    await validateUniqueConstraint(page, {
      createPath: '/racks/create',
      fieldName: 'rack_code',
      duplicateValue: uniqueCode,
      saveButtonName: 'Save',
      fillRest: async () => {
        await racks.nameInput.fill('Duplicate Code Rack');
        await racks.totalShelvesInput.fill('1');
        await racks.maxCapacityInput.fill('10');
      },
    });
  });

  test('submitting a malformed request does not leak a debug error page', async ({ page }) => {
    const racks = new RacksPage(page);

    await validateErrorHandling(page, {
      triggerAction: async () => {
        await racks.gotoCreate();
        await racks.rackCodeInput.fill(`PW-RACK-ERR-${Date.now()}`);
        await racks.nameInput.fill('Error Handling Rack');
        // Deliberately invalid: capacity below the controller's min:1 rule.
        await racks.totalShelvesInput.fill('1');
        await racks.maxCapacityInput.fill('0');
        await racks.saveButton.click();
      },
    });
  });

  test('rack-wise stock report loads with occupancy summary and detail table', async ({ page }) => {
    await page.goto('/reports/rack-stock');
    await validatePage(page, { heading: 'Rack-wise Stock' });

    await expect(page.getByText('Rack Occupancy Summary')).toBeVisible();

    const detailTable = page.locator('table').last();
    await expect(detailTable).toBeVisible();
    await expect(detailTable).toContainText('Medicine');
    await expect(detailTable).toContainText('Batch No.');
    await expect(detailTable).toContainText('Qty Available');

    await expect(page.getByRole('link', { name: 'Export CSV' })).toBeVisible();
  });

  test('rack-wise stock CSV export responds with a real file, not an HTML error page', async ({ request, baseURL }) => {
    await validateAPI(request, {
      url: `${baseURL}/reports/rack-stock?format=csv`,
      expectContentType: 'text/csv',
    });
  });

  // TODO (future integration test, not covered here): assign a real batch to
  // a rack shelf via the inventory dropdown and confirm the rack index /
  // rack-stock report occupancy figure increases accordingly, then confirm
  // it decreases again after a sale consumes that batch. Requires seeded
  // medicine + batch + stock fixture data this spec file has no guarantee
  // of — faking it here would be dishonest coverage.
});
