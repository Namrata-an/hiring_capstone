import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/login.page';
import { testUsers } from './fixtures/test-data';

test.describe('Phase 5: Talent Memory & Baton Passing', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.loginAsHR(testUsers.hr.email, testUsers.hr.password);
    await page.getByRole('button', { name: 'Talent Memory' }).click();
    await expect(page.getByRole('heading', { name: 'Talent Memory' })).toBeVisible({ timeout: 5000 });
  });

  test.describe('Talent Search', () => {
    test('should show talent memory section', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Talent Memory' })).toBeVisible();
    });

    test('should show search talent tab by default', async ({ page }) => {
      await expect(page.getByText('Search Talent').first()).toBeVisible();
    });

    test('should switch to re-engagement tab', async ({ page }) => {
      await page.getByRole('button', { name: 'Re-engagement' }).click();
      await page.waitForTimeout(1000);
    });
  });
});
