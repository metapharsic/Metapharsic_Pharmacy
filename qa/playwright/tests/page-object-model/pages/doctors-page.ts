import { Page, Locator } from '@playwright/test';
import { BasePage } from './base-page';

/**
 * Doctor master (index/create/edit) — real selectors confirmed against
 * resources/views/doctors/{index,create,_form}.blade.php.
 */
export class DoctorsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async gotoIndex(): Promise<void> {
    await this.page.goto('/doctors');
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto('/doctors/create');
  }

  get activeOnlyFilter(): Locator {
    return this.page.locator('input[type="checkbox"][name="active"]');
  }

  get nameInput(): Locator {
    return this.page.locator('input[name="name"]');
  }

  get registrationNoInput(): Locator {
    return this.page.locator('input[name="registration_no"]');
  }

  get specializationInput(): Locator {
    return this.page.locator('input[name="specialization"]');
  }

  async createDoctor(opts: { name: string; registrationNo?: string; specialization?: string }): Promise<void> {
    await this.gotoCreate();
    await this.nameInput.fill(opts.name);
    if (opts.registrationNo) await this.registrationNoInput.fill(opts.registrationNo);
    if (opts.specialization) await this.specializationInput.fill(opts.specialization);
    await this.saveButton.click();
  }
}

/**
 * The `doctor_id` select embedded in the Customer create/edit forms
 * (resources/views/customers/create.blade.php) — kept here rather than a
 * separate CustomersPage since this suite only exercises the doctor-linkage
 * portion of that form, not customer CRUD as a whole.
 */
export class CustomerDoctorLinkPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto('/customers/create');
  }

  get doctorSelect(): Locator {
    return this.page.locator('select[name="doctor_id"]');
  }

  get doctorNameLegacyInput(): Locator {
    return this.page.locator('input[name="doctor_name"]');
  }

  doctorOption(name: string): Locator {
    return this.page.locator('select[name="doctor_id"] option', { hasText: name });
  }
}
