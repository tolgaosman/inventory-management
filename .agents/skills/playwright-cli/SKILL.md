---
name: playwright-cli
description: Comprehensive guide to writing, executing, and debugging end-to-end tests using the Playwright CLI.
---

# Playwright CLI & E2E Testing

Use this skill when writing, configuring, or debugging Playwright tests.

## 1. Writing Robust Locators
- **User-Facing Attributes:** Always prefer locators that reflect what the user sees. Use `getByRole`, `getByText`, `getByLabel`, and `getByPlaceholder`.
- **Test IDs:** If user-facing attributes are brittle or dynamic, use `getByTestId` (and ensure `data-testid` attributes are added to the markup).
- **Avoid CSS/XPath:** Never use brittle CSS selectors (`div > ul > li:nth-child(3)`) or XPaths unless absolutely necessary.

## 2. Assertions (Web-First)
- **Auto-Retrying Assertions:** Use `expect(locator).toBeVisible()`, `expect(locator).toHaveText()`, etc. These automatically wait and retry until the condition is met or the timeout is reached. 
- **Avoid Manual Waits:** NEVER use `page.waitForTimeout(5000)`. Always wait for a specific state (e.g., `await page.waitForLoadState('networkidle')` or wait for an element to appear).

## 3. CLI Execution Commands
- **Run all tests:** `npx playwright test`
- **Run a specific test file:** `npx playwright test tests/login.spec.ts`
- **Run tests in headed mode (visible browser):** `npx playwright test --headed`
- **Run tests with UI Mode (interactive debugging):** `npx playwright test --ui`
- **Debug mode (pauses execution):** `npx playwright test --debug`
- **Run a specific test by title:** `npx playwright test -g "should allow user to log in"`

## 4. Debugging & Tracing
- **Trace Viewer:** If a test fails in CI, view the trace to see exactly what happened: `npx playwright show-trace trace.zip`
- **Codegen:** To quickly generate a test skeleton by recording browser actions: `npx playwright codegen your-app-url.com`

## 5. Configuration (playwright.config.ts)
- Ensure `baseURL` is set correctly.
- Configure `trace: 'on-first-retry'` to keep CI artifacts manageable.
- Set up global setup/teardown if authentication state needs to be reused across tests.
