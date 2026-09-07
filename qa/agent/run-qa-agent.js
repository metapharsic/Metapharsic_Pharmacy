#!/usr/bin/env node
/**
 * run-qa-agent.js — SKELETON, not a working implementation.
 *
 * Spec-driven QA agent for Metapharsic Pharmacy.
 *
 * Usage:
 *   node run-qa-agent.js path/to/spec.json
 *
 * The spec file is expected to match the shape described in
 * docs/qa/agent/spec-schema.md — either a single screen object or
 * { screens: [ ... ] }.
 *
 * This script is intentionally incomplete: login flow and DOM selectors
 * are marked TODO and must be confirmed against the live app before this
 * will actually work. Do not treat this as a finished tool.
 */

const fs = require('fs');
const path = require('path');
// TODO: `npm install playwright` (or add to package.json) before running.
const { chromium } = require('playwright');

// ---------------------------------------------------------------------
// Config — TODO: move to env vars / a config file once real values exist.
// ---------------------------------------------------------------------
const BASE_URL = process.env.QA_BASE_URL || 'http://localhost:8000'; // TODO: confirm
const LOGIN_EMAIL = process.env.QA_LOGIN_EMAIL || 'qa@example.com'; // TODO: confirm test account
const LOGIN_PASSWORD = process.env.QA_LOGIN_PASSWORD || 'password'; // TODO: confirm test account

function loadSpec(specPath) {
  const raw = fs.readFileSync(specPath, 'utf8');
  const parsed = JSON.parse(raw); // TODO: support YAML too (js-yaml) if spec files are authored as YAML
  return parsed.screens ? parsed.screens : [parsed];
}

async function login(page) {
  // TODO: confirm the real login route and field selectors against the
  // live app — this is a guess based on common Laravel Breeze/Jetstream
  // conventions and WILL likely need adjusting.
  await page.goto(`${BASE_URL}/login`);
  await page.fill('[name="email"]', LOGIN_EMAIL); // TODO: confirm selector
  await page.fill('[name="password"]', LOGIN_PASSWORD); // TODO: confirm selector
  await page.click('button[type="submit"]'); // TODO: confirm selector
  await page.waitForLoadState('networkidle');
  // TODO: assert login actually succeeded (e.g. check for a dashboard
  // element or absence of a login-error message) before proceeding.
}

async function checkFields(page, screen, failures) {
  for (const field of screen.fields || []) {
    const el = await page.$(field.selector_hint);
    if (!el) {
      failures.push({
        screen: screen.screen,
        route: screen.route,
        type: 'missing_field',
        detail: `Field "${field.name}" (${field.type}) not found using selector "${field.selector_hint}".`,
      });
    }
  }
}

async function checkDropdowns(page, screen, failures) {
  for (const dropdown of screen.dropdowns || []) {
    const field = (screen.fields || []).find((f) => f.name === dropdown.name);
    const selector = field ? field.selector_hint : null;
    if (!selector) continue; // already flagged as missing_field above

    // TODO: this assumes a native <select> — adjust for custom
    // dropdown/combobox components (e.g. a div-based autocomplete) which
    // won't have <option> children.
    const optionCount = await page
      .locator(`${selector} option`)
      .count()
      .catch(() => 0);

    if (optionCount === 0) {
      failures.push({
        screen: screen.screen,
        route: screen.route,
        type: 'empty_dropdown',
        detail: `Dropdown "${dropdown.name}" (source: ${dropdown.source}) has 0 options.`,
      });
    }
  }
}

async function checkValidations(page, screen, failures, screenshotDir) {
  for (const validation of screen.validations || []) {
    if (validation.rule !== 'required') continue; // TODO: handle other rule types (format, min_length, not_future_date, ...)

    const field = (screen.fields || []).find((f) => f.name === validation.field);
    if (!field) continue;

    // TODO: this "leave it empty and submit" approach assumes one
    // submit button per screen and a form that doesn't have OTHER
    // required fields blocking submission first. For screens with
    // multiple required fields, fill in valid values for every field
    // except the one under test.
    const submitSelector = 'button[type="submit"]'; // TODO: confirm per-screen

    await page.goto(`${BASE_URL}${screen.route}`);
    await page.waitForLoadState('networkidle');

    const fieldEl = await page.$(field.selector_hint);
    if (!fieldEl) continue; // already flagged as missing_field

    await page.fill(field.selector_hint, '').catch(() => {});
    await page.click(submitSelector).catch(() => {});
    await page.waitForTimeout(500); // TODO: replace with a real wait condition

    // TODO: confirm what a validation message actually looks like in
    // this app (a `.error` class? aria-invalid? a toast?) — this is a
    // placeholder check.
    const hasValidationMessage = await page
      .locator('.error, [role="alert"], .invalid-feedback')
      .count()
      .then((n) => n > 0)
      .catch(() => false);

    if (!hasValidationMessage) {
      const screenshotPath = path.join(
        screenshotDir,
        `${screen.screen}-${field.name}-validation.png`
      );
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});

      failures.push({
        screen: screen.screen,
        route: screen.route,
        type: 'missing_validation',
        detail: `Submitting with "${field.name}" empty did not show a validation message (spec requires it).`,
        screenshot: screenshotPath,
      });
    }
  }
}

function writeBugReport(reportDir, failures) {
  const lines = [
    `# QA Agent Bug Report`,
    ``,
    `Generated: ${new Date().toISOString()}`,
    ``,
    `Total findings: ${failures.length}`,
    ``,
  ];

  if (failures.length === 0) {
    lines.push('No discrepancies found between spec and live build.');
  }

  for (const [i, f] of failures.entries()) {
    lines.push(`## ${i + 1}. [${f.type}] ${f.screen} (${f.route})`);
    lines.push('');
    lines.push(f.detail);
    lines.push('');
    if (f.screenshot) {
      const relPath = path.relative(reportDir, f.screenshot);
      lines.push(`![screenshot](${relPath})`);
      lines.push('');
    }
  }

  const reportPath = path.join(reportDir, 'bug-report.md');
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
  return reportPath;
}

async function main() {
  const specPath = process.argv[2];
  if (!specPath) {
    console.error('Usage: node run-qa-agent.js path/to/spec.json');
    process.exit(1);
  }

  const screens = loadSpec(specPath);
  const failures = [];

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportDir = path.join(__dirname, 'reports', timestamp); // TODO: confirm this matches qa/agent/reports/<timestamp>/ in the real repo layout
  fs.mkdirSync(reportDir, { recursive: true });

  const browser = await chromium.launch({ headless: true }); // TODO: headless: false for local debugging
  const page = await browser.newPage();

  try {
    await login(page);

    for (const screen of screens) {
      console.log(`Checking screen: ${screen.screen} (${screen.route})`);
      await page.goto(`${BASE_URL}${screen.route}`);
      await page.waitForLoadState('networkidle');

      await checkFields(page, screen, failures);
      await checkDropdowns(page, screen, failures);
      await checkValidations(page, screen, failures, reportDir);

      // TODO: on any failure detected above that isn't already
      // screenshotted (missing_field, empty_dropdown), take a
      // screenshot here too, e.g.:
      // const shot = path.join(reportDir, `${screen.screen}-overview.png`);
      // await page.screenshot({ path: shot, fullPage: true });
    }
  } finally {
    await browser.close();
  }

  const reportPath = writeBugReport(reportDir, failures);
  console.log(`\nDone. ${failures.length} finding(s).`);
  console.log(`Report: ${reportPath}`);

  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('QA agent crashed:', err);
  process.exit(2);
});
