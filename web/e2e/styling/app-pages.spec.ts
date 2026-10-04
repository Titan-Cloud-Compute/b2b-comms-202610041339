/**
 * Styling card — signed-in pages oracle: Dashboard and Settings
 * use the shared token primitives and render inside the shared layout.
 */
import { test, expect } from '@playwright/test';
import { mockApi, login } from '../spec/_support';

const SIGNED_IN_PAGES = [
  '/#/dashboard',
  '/#/settings',
] as const;

test.describe('signed-in pages use the shared visual system', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await login(page);
  });

  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    for (const url of SIGNED_IN_PAGES) {
      test(`${url} @ ${viewport.width}px – sidebar, Main nav group, no overflow`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto(url);

        // App sidebar is rendered inside the shell.
        const sidebar = page.locator('[data-testid="app-sidebar"]');
        await expect(sidebar).toBeAttached();

        // "Main" nav-group label is present for the regular (non-admin) user.
        const mainLabel = sidebar.locator('.nav-group-label').filter({ hasText: 'Main' });
        await expect(mainLabel).toBeVisible();

        // No horizontal page overflow — content fits the viewport.
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }
  }
});
