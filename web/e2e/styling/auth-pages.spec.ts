/**
 * Styling card — Auth/public pages oracle: Login, Sign-Up, Forgot Password
 * use the shared token primitives and have no horizontal overflow.
 */
import { test, expect } from '@playwright/test';
import { mockApi } from '../spec/_support';

const AUTH_PAGES = [
  '/#/login',
  '/#/signup/1',
  '/#/forgot-password',
] as const;

test.describe('auth/public pages use the shared visual system', () => {
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    for (const url of AUTH_PAGES) {
      test(`${url} @ ${viewport.width}px – no overflow, Inter, button not disabled-gray`, async ({ page }) => {
        await mockApi(page);
        await page.setViewportSize(viewport);
        await page.goto(url);

        // No horizontal overflow — page fits its viewport.
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);

        // Body font-family contains Inter (token --font-body is applied).
        const fontFamily = await page.evaluate(
          () => getComputedStyle(document.body).fontFamily,
        );
        expect(fontFamily).toContain('Inter');

        // Primary action button background is not the UA disabled gray.
        // Signup step 1 uses type="button" with class btn-primary; other pages use type="submit".
        const btn = page
          .locator('button[type="submit"], button.btn-primary')
          .first();
        await expect(btn).toBeVisible();
        const bgColor = await btn.evaluate(
          (el) => getComputedStyle(el).backgroundColor,
        );
        expect(bgColor).not.toBe('rgb(239, 239, 239)');
      });
    }
  }
});
