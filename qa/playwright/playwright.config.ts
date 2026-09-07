import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the Metapharsic pharmacy app E2E skeleton.
 * Assumes the Laravel app is already running locally (see README.md, start.bat)
 * on http://127.0.0.1:5656.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  // JUnit for CI (matches UKHO/playwright-template's CI reporter choice),
  // HTML locally for interactive triage.
  reporter: process.env.CI ? [['junit', { outputFile: 'uiTestResults.xml' }]] : [['html', { open: 'never' }]],

  use: {
    baseURL: 'http://127.0.0.1:5656',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Reuse the logged-in admin session saved by auth.setup.ts
        storageState: 'tests/.auth/admin.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: 'tests/.auth/admin.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        storageState: 'tests/.auth/admin.json',
      },
      dependencies: ['setup'],
    },
  ],
});
