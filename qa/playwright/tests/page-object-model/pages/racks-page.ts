import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base-page';

/**
 * Racks module (index/create/edit) — real selectors confirmed against
 * resources/views/racks/{index,create,_form}.blade.php.
 */
export class RacksPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async gotoIndex(): Promise<void> {
    await this.page.goto('/racks');
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto('/racks/create');
  }

  get newRackLink(): Locator {
    return this.page.getByRole('link', { name: 'New Rack' });
  }

  get zoneSelect(): Locator {
    return this.page.locator('select[name="storage_zone_id"]');
  }

  get rackCodeInput(): Locator {
    return this.page.locator('input[name="rack_code"]');
  }

  get nameInput(): Locator {
    return this.page.locator('input[name="name"]');
  }

  get totalShelvesInput(): Locator {
    return this.page.locator('input[type="number"][name="total_shelves"]');
  }

  get maxCapacityInput(): Locator {
    return this.page.locator('input[type="number"][name="max_capacity_boxes"]');
  }

  get statusSelect(): Locator {
    return this.page.locator('select[name="status"]');
  }

  async createRack(opts: { code: string; name: string; totalShelves: string; capacity: string }): Promise<void> {
    await this.gotoCreate();
    await this.rackCodeInput.fill(opts.code);
    await this.nameInput.fill(opts.name);
    await this.totalShelvesInput.fill(opts.totalShelves);
    await this.maxCapacityInput.fill(opts.capacity);

    const zoneOptions = this.zoneSelect.locator('option');
    const zoneCount = await zoneOptions.count();
    if (zoneCount > 1) {
      const firstZoneValue = await zoneOptions.nth(1).getAttribute('value');
      if (firstZoneValue) {
        await this.zoneSelect.selectOption(firstZoneValue);
      }
    }

    await this.saveButton.click();
  }

  shelfOptgroup(rackCode: string): Locator {
    return this.page.locator(`select[name="rack_shelf_id"] optgroup[label*="${rackCode}"]`);
  }
}
