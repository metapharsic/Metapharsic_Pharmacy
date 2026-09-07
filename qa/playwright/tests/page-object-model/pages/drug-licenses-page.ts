import { Page, Locator } from '@playwright/test';
import { BasePage } from './base-page';

/**
 * Drug Licenses (index/create/edit) — real selectors confirmed against
 * resources/views/settings/licenses/{index,create,_form}.blade.php.
 */
export class DrugLicensesPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async gotoIndex(): Promise<void> {
    await this.page.goto('/settings/licenses');
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto('/settings/licenses/create');
  }

  get licenseTypeSelect(): Locator {
    return this.page.locator('select[name="license_type"]');
  }

  get licenseNumberInput(): Locator {
    return this.page.locator('input[name="license_number"]');
  }

  get issuedOnInput(): Locator {
    return this.page.locator('input[type="date"][name="issued_on"]');
  }

  get expiresOnInput(): Locator {
    return this.page.locator('input[type="date"][name="expires_on"]');
  }

  async createLicense(opts: { type: string; number: string; issuedOn: string; expiresOn: string }): Promise<void> {
    await this.gotoCreate();
    await this.licenseTypeSelect.selectOption(opts.type);
    await this.licenseNumberInput.fill(opts.number);
    await this.issuedOnInput.fill(opts.issuedOn);
    await this.expiresOnInput.fill(opts.expiresOn);
    await this.saveButton.click();
  }
}

/** The admin-only compliance banner on the dashboard (Phase 8e). */
export class DashboardLicenseBannerPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/dashboard');
  }

  get banner(): Locator {
    return this.page.getByText('Drug License Compliance');
  }

  get viewLicensesLink(): Locator {
    return this.page.getByRole('link', { name: 'View drug licenses →' });
  }
}
