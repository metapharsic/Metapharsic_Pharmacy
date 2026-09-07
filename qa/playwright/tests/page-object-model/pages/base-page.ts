import { Page, Locator, expect } from '@playwright/test';

/**
 * Shared base for every page object in this suite. Pattern adopted from
 * UKHO/playwright-template (docs/pageobjectmodel.md) — one class per screen,
 * locators as getters, actions as methods, specs never touch raw selectors.
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  get table(): Locator {
    return this.page.locator('table').first();
  }

  get saveButton(): Locator {
    return this.page.getByRole('button', { name: 'Save' });
  }

  async expectRowVisible(text: string): Promise<Locator> {
    const row = this.page.locator('table tr', { hasText: text });
    await expect(row.first()).toBeVisible();
    return row.first();
  }

  fieldError(name: string): Locator {
    return this.page
      .locator(`[name="${name}"]`)
      .locator('xpath=following-sibling::p[contains(@class, "text-red-600")]');
  }
}
