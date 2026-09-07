import { Page, Locator } from '@playwright/test';
import { BasePage } from './base-page';

/**
 * Discount Schemes (index/create) — real selectors confirmed against
 * resources/views/discount-schemes/{index,create,_form}.blade.php.
 */
export class DiscountSchemesPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async gotoIndex(): Promise<void> {
    await this.page.goto('/discount-schemes');
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto('/discount-schemes/create');
  }

  get nameInput(): Locator {
    return this.page.locator('input[name="name"]');
  }

  get typeSelect(): Locator {
    return this.page.locator('select[name="type"]');
  }

  scopeRadio(value: 'medicine' | 'category'): Locator {
    return this.page.locator(`input[type="radio"][name="scope"][value="${value}"]`);
  }

  get medicineSelect(): Locator {
    return this.page.locator('select[name="medicine_id"]');
  }

  get categorySelect(): Locator {
    return this.page.locator('select[name="category_id"]');
  }

  get buyQtyInput(): Locator {
    return this.page.locator('input[name="buy_qty"]');
  }

  get getQtyInput(): Locator {
    return this.page.locator('input[name="get_qty"]');
  }

  get minQtyInput(): Locator {
    return this.page.locator('input[name="min_qty"]');
  }

  get slabDiscountPercentInput(): Locator {
    return this.page.locator('input[name="slab_discount_percent"]');
  }

  get startsOnInput(): Locator {
    return this.page.locator('input[type="date"][name="starts_on"]');
  }

  get endsOnInput(): Locator {
    return this.page.locator('input[type="date"][name="ends_on"]');
  }
}
