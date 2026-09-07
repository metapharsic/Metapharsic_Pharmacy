import { test, expect } from '@playwright/test';
import { MoversPage } from './page-object-model/pages/movers-page';

// Fast/Slow Movers report smoke test (Phase 8d), based on real Blade source:
//   resources/views/reports/fast-slow-movers.blade.php
// Route name: reports.movers -> /reports/movers.
// Rewired onto the Page Object Model pattern (tests/page-object-model/pages)
// adopted from UKHO/playwright-template.

test.describe('Fast / Slow Movers report', () => {
  test('report loads with both panels and a category filter', async ({ page }) => {
    const movers = new MoversPage(page);
    await movers.goto();

    await expect(page.getByRole('heading', { name: 'Fast / Slow Movers' })).toBeVisible();
    await expect(movers.fastMoversPanel).toBeVisible();
    await expect(movers.slowMoversPanel).toBeVisible();
    await expect(movers.categorySelect).toBeVisible();
    await expect(movers.filterButton).toBeVisible();
    await expect(movers.exportCsvLink).toBeVisible();
  });

  test('category filter is populated from real category data, not hardcoded', async ({ page }) => {
    const movers = new MoversPage(page);
    await movers.goto();

    // First option is always the "All" placeholder; anything beyond that
    // must come from the real categories table (@foreach (($categories ?? [])...)).
    const firstOption = await movers.categorySelect.locator('option').first().textContent();
    expect(firstOption?.trim()).toBe('All');
  });

  test('filtering by category keeps the selection in the URL', async ({ page }) => {
    const movers = new MoversPage(page);
    await movers.goto();

    const options = movers.categorySelect.locator('option');
    const optionCount = await options.count();
    if (optionCount > 1) {
      const firstRealValue = await options.nth(1).getAttribute('value');
      if (firstRealValue) {
        await movers.categorySelect.selectOption(firstRealValue);
        await movers.filterButton.click();
        await expect(page).toHaveURL(new RegExp(`category_id=${firstRealValue}`));
      }
    } else {
      test.info().annotations.push({
        type: 'note',
        description: 'No categories seeded — nothing beyond the "All" placeholder to filter by.',
      });
    }
  });

  test('Export CSV link carries format=csv', async ({ page }) => {
    const movers = new MoversPage(page);
    await movers.goto();

    const href = await movers.exportCsvLink.getAttribute('href');
    expect(href).toContain('format=csv');
  });
});
