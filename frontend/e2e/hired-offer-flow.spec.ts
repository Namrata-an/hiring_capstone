import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/login.page';
import { testUsers } from './fixtures/test-data';

test.describe('Hired / Offers Flow', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.loginAsHR(testUsers.hr.email, testUsers.hr.password);
    await page.getByRole('button', { name: 'Hired / Offers' }).click();
    await expect(page.getByRole('heading', { name: 'Hired / Offers' })).toBeVisible({ timeout: 5000 });
  });

  test('should display Hired / Offers section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Hired / Offers' })).toBeVisible();
  });

  test('should show offer/hired/rejected sub-tabs', async ({ page }) => {
    await expect(page.getByText(/Offers \(\d+\)/)).toBeVisible();
    await expect(page.getByText(/Hired \(\d+\)/)).toBeVisible();
    await expect(page.getByText(/Rejected \(\d+\)/)).toBeVisible();
  });

  test('should show quick actions area', async ({ page }) => {
    await expect(page.getByText('Quick Actions')).toBeVisible();
  });

  test('should switch between hired sub-tabs', async ({ page }) => {
    await page.getByText(/Hired \(\d+\)/).click();
    await page.waitForTimeout(500);
    await page.getByText(/Rejected \(\d+\)/).click();
    await page.waitForTimeout(500);
    await page.getByText(/Offers \(\d+\)/).click();
    await page.waitForTimeout(500);
  });
});
