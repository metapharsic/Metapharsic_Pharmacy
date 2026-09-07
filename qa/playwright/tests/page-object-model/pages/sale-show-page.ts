import { Page, Locator } from '@playwright/test';
import { BasePage } from './base-page';

/**
 * Invoice detail screen (resources/views/sales/show.blade.php), scoped to
 * the Phase 8b prescription-image upload/view block only — this suite does
 * not otherwise exercise the sales module.
 */
export class SaleShowPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(saleId: number | string): Promise<void> {
    await this.page.goto(`/sales/${saleId}`);
  }

  get prescriptionImageInput(): Locator {
    return this.page.getByLabel('Prescription image or scan');
  }

  get uploadButton(): Locator {
    return this.page.getByRole('button', { name: 'Upload' });
  }

  get viewPrescriptionImageLink(): Locator {
    return this.page.getByRole('link', { name: 'View prescription image' });
  }
}
