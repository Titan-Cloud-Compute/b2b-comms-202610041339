/**
 * Styling card — Customer and Admin pages oracle: Orders (with OrderQueue),
 * Customer Management, and Audit Log use the shared token primitives.
 */
import { test, expect } from '@playwright/test';
import { mockApi, login } from '../spec/_support';

const PAGES: Array<[string, string]> = [
  ['orders', 'orders-screen'],
  ['admin/customers', 'admin-customers-screen'],
  ['admin/audit-log', 'admin-audit-log-screen'],
];

const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
];

test.describe('customer and admin pages use the shared visual system', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await login(page);
  });

  for (const viewport of VIEWPORTS) {
    for (const [path, screen] of PAGES) {
      test(`/${path} @ ${viewport.width}px`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto(`/#/${path}`);

        // Screen is visible inside the app shell
        const shell = page.locator('[data-testid="app-shell"]');
        const root = shell.locator(`[data-testid="${screen}"]`);
        await expect(root).toBeVisible();

        // h1 uses the display font (Sofia Sans)
        const h1 = root.locator('.page-header h1');
        await expect(h1).toBeVisible();
        const fontFamily = await h1.evaluate((el) => getComputedStyle(el).fontFamily);
        expect(fontFamily).toContain('Sofia Sans');

        // No horizontal page overflow at this viewport
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth
        );
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }
  }

  test('/orders contains .order-queue', async ({ page }) => {
    await page.goto('/#/orders');
    await expect(page.locator('[data-testid="orders-screen"] .order-queue')).toBeAttached();
  });
});
