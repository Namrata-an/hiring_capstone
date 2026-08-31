import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/login.page';
import { testUsers } from './fixtures/test-data';

test.describe('Interviewer Workflow', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.loginAsHR(testUsers.hr.email, testUsers.hr.password);
    // Switch to interviewer view
    const switchDropdown = page.locator('[data-testid="switch-user-dropdown"]');
    await switchDropdown.click();
    await page.locator('[data-testid="switch-to-interviewer"]').click();
    await expect(page.getByText('My Schedule')).toBeVisible({ timeout: 10000 });
  });

  test('should display interviewer dashboard', async ({ page }) => {
    await expect(page.getByText('My Interview Schedule')).toBeVisible();
  });

  test('should show schedule and candidates tabs', async ({ page }) => {
    await expect(page.getByText('My Schedule')).toBeVisible();
    await expect(page.getByText('Assigned Candidates')).toBeVisible();
  });

  test('should switch back to HR view', async ({ page }) => {
    const switchDropdown = page.locator('[data-testid="switch-user-dropdown"]');
    await switchDropdown.click();
    await page.locator('[data-testid="switch-to-hr-admin"]').click();
    await expect(page.getByText('Dashboard Overview')).toBeVisible({ timeout: 10000 });
  });
});
