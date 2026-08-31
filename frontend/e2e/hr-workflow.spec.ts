import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/login.page';
import { testUsers } from './fixtures/test-data';

test.describe('HR Workflow', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.loginAsHR(testUsers.hr.email, testUsers.hr.password);
  });

  test('should display HR dashboard with overview', async ({ page }) => {
    await expect(page.getByText('Dashboard Overview')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Total Candidates')).toBeVisible();
    await expect(page.getByText('Active Jobs').first()).toBeVisible();
  });

  test('should navigate to Jobs section', async ({ page }) => {
    await page.getByRole('button', { name: 'Jobs' }).click();
    await expect(page.getByText('Job Postings')).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to Candidates section', async ({ page }) => {
    await page.getByRole('button', { name: 'Candidates' }).click();
    await expect(page.getByRole('heading', { name: 'Candidates' })).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to Interview Pipeline', async ({ page }) => {
    await page.getByRole('button', { name: 'Interview Pipeline' }).click();
    await page.waitForTimeout(2000);
    await expect(page.locator('main')).toBeVisible();
  });

  test('should navigate to Hired / Offers section', async ({ page }) => {
    await page.getByRole('button', { name: 'Hired / Offers' }).click();
    await expect(page.getByRole('heading', { name: 'Hired / Offers' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Offers \(\d+\)/)).toBeVisible();
    await expect(page.getByText(/Hired \(\d+\)/)).toBeVisible();
    await expect(page.getByText(/Rejected \(\d+\)/)).toBeVisible();
  });

  test('should navigate to Talent Memory section', async ({ page }) => {
    await page.getByRole('button', { name: 'Talent Memory' }).click();
    await expect(page.getByRole('heading', { name: 'Talent Memory' })).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to Communications section', async ({ page }) => {
    await page.getByRole('button', { name: 'Communications' }).click();
    await expect(page.getByRole('heading', { name: 'Communications' })).toBeVisible({ timeout: 5000 });
  });

  test('should show switch user dropdown', async ({ page }) => {
    const switchDropdown = page.locator('[data-testid="switch-user-dropdown"]');
    await expect(switchDropdown).toBeVisible();
    await switchDropdown.click();
    await expect(page.getByText('Switch View')).toBeVisible();
  });

  test('should switch to interviewer view', async ({ page }) => {
    const switchDropdown = page.locator('[data-testid="switch-user-dropdown"]');
    await switchDropdown.click();
    await page.locator('[data-testid="switch-to-interviewer"]').click();
    await expect(page.getByText('My Schedule')).toBeVisible({ timeout: 10000 });
  });
});
