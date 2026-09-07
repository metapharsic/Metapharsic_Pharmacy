import { Page, Locator } from '@playwright/test';
import { BasePage } from './base-page';

/**
 * Fast/Slow Movers report (resources/views/reports/fast-slow-movers.blade.php),
 * route name reports.movers.
 */
export class MoversPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/reports/movers');
  }

  get categorySelect(): Locator {
    return this.page.locator('select[name="category_id"]');
  }

  get filterButton(): Locator {
    return this.page.getByRole('button', { name: 'Filter' });
  }

  get exportCsvLink(): Locator {
    return this.page.getByRole('link', { name: 'Export CSV' });
  }

  get fastMoversPanel(): Locator {
    return this.page.getByText('Fast Movers');
  }

  get slowMoversPanel(): Locator {
    return this.page.getByText('Slow Movers');
  }
}
