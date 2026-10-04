/**
 * Styling card — Vendor pages oracle: Vendor Profile, Channels (ChannelList),
 * Invoices (InvoiceViewer) and Notification Settings use the shared token primitives.
 */
import { test, expect, type Page } from '@playwright/test';
import { mockApi, login } from '../spec/_support';

const VENDOR_PAGES: Array<[string, string]> = [
  ['vendor/profile', 'vendor-profile-screen'],
  ['channels', 'channels-screen'],
  ['invoices', 'invoices-screen'],
  ['settings/notifications', 'settings-notifications-screen'],
];

async function token(page: Page, name: string): Promise<string> {
  return page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);
}

test.describe('vendor pages use the shared visual system', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await login(page);
  });

  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    for (const [path, screen] of VENDOR_PAGES) {
      test(`/${path} @ ${viewport.width}px`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto(`/#/${path}`);
        const root = page.locator(`[data-testid="app-shell"] [data-testid="${screen}"]`);
        await expect(root).toBeVisible();
        await expect(root).toHaveClass(/\bpage\b/);
        await expect(root.locator('.page-header h1')).toBeVisible();
        const card = root.locator('.card').first();
        await expect(card).toBeVisible();
        await expect(card).toHaveCSS('border-radius', await token(page, '--radius-card'));
        // No horizontal overflow: the page fits its viewport.
        const overflow = await root.evaluate((el) => el.scrollWidth - el.clientWidth);
        expect(overflow).toBeLessThanOrEqual(1);
      });
    }
  }

  test('Channels renders the ChannelList', async ({ page }) => {
    await page.goto('/#/channels');
    await expect(page.locator('[data-testid="channel-list"].channel-list')).toBeVisible();
  });

  test('Invoices renders the InvoiceViewer', async ({ page }) => {
    await page.goto('/#/invoices');
    await expect(page.locator('[data-testid="invoices-screen"] .invoice-viewer')).toBeVisible();
  });
});
