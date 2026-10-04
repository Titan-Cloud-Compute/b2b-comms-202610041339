/**
 * Styling card — shared shell oracle: every story feature page renders inside the
 * one app shell (sidebar + top bar) with the Main / Vendor / Customer / Admin nav groups,
 * on desktop and on a phone-sized viewport.
 */
import { test, expect } from '@playwright/test';
import { mockApi, login } from '../spec/_support';

const PAGES: Array<[string, string]> = [
  ['vendor/profile', 'vendor-profile-screen'],
  ['admin/customers', 'admin-customers-screen'],
  ['channels', 'channels-screen'],
  ['orders', 'orders-screen'],
  ['invoices', 'invoices-screen'],
  ['settings/notifications', 'settings-notifications-screen'],
  ['admin/audit-log', 'admin-audit-log-screen'],
];

test.describe('shared app shell', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await login(page);
  });

  for (const [path, screen] of PAGES) {
    test(`/${path} renders inside the shell`, async ({ page }) => {
      await page.goto(`/#/${path}`);
      const shell = page.locator('[data-testid="app-shell"]');
      await expect(shell.locator(`[data-testid="${screen}"]`)).toBeVisible();
      await expect(shell.locator('[data-testid="app-topbar"]')).toBeVisible();
      await expect(shell.locator('[data-testid="app-sidebar"]')).toBeAttached();
      await expect(shell.locator(`[data-testid="${screen}"].page .page-header h1`)).toBeVisible();
    });
  }

  test('sidebar shows the Main, Vendor, Customer and Admin nav groups', async ({ page }) => {
    await page.goto('/#/channels');
    const labels = page.locator('[data-testid="app-shell"] .nav-group-label');
    for (const group of ['Main', 'Vendor', 'Customer', 'Admin']) {
      await expect(labels.filter({ hasText: new RegExp(`^\\s*${group}\\s*$`) })).toHaveCount(1);
    }
    await expect(page.locator('[data-testid="app-topbar-title"]')).toHaveText('Channels');
  });

  test('mobile: top bar with menu toggle, sidebar off-canvas until opened', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/orders');
    await expect(page.locator('[data-testid="orders-screen"]')).toBeVisible();
    const topbar = page.locator('[data-testid="app-topbar"]');
    await expect(topbar).toBeVisible();
    const toggle = topbar.locator('.menu-btn');
    await expect(toggle).toBeVisible();
    await expect(page.locator('[data-testid="app-sidebar"]')).not.toBeInViewport();
    await toggle.click();
    await expect(page.locator('[data-testid="app-sidebar"]')).toBeInViewport();
  });
});
