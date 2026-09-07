import { test as setup, expect } from '@playwright/test';
import path from 'path';

// Saved storage state reused by the "chromium" project so every spec
// starts already logged in as admin.
const authFile = path.join(__dirname, '.auth', 'admin.json');

const ADMIN_EMAIL = 'admin@metapharsic.local';
const ADMIN_PASSWORD = 'ChangeMe123!';

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/login');

  // Confirmed against auth/login.blade.php: x-input-label for="email"/"password"
  // renders <label for="email">Email</label> / <label for="password">Password</label>,
  // paired with <x-text-input id="email" name="email"> and id="password" name="password".
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);

  // x-primary-button renders a <button type="submit"> with text "Log in".
  await page.getByRole('button', { name: 'Log in' }).click();

  // After a successful login the app should redirect away from /login,
  // typically to /dashboard. Adjust if the app uses a different landing
  // route.
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 15000,
  });

  // Sanity check: navigation.blade.php renders a "Dashboard" nav link
  // (x-nav-link :href="route('dashboard')") only inside the authenticated
  // layout, so its presence confirms we're logged in.
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();

  await page.context().storageState({ path: authFile });
});
