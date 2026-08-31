import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/login.page';
import { testUsers } from './fixtures/test-data';

test.describe('Authentication', () => {
  test('should show login page when not authenticated', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await expect(loginPage.emailInput).toBeVisible({ timeout: 10000 });
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(page.getByText('SeedlingLabs')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('invalid@test.com', 'wrongpassword');
    await expect(loginPage.errorMessage).toBeVisible({ timeout: 10000 });
  });

  test('should redirect to dashboard on successful login', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(testUsers.hr.email, testUsers.hr.password);
    // Should see dashboard elements (HR or Interviewer depending on DB state)
    await expect(page.getByText('Hiring Co-Pilot')).toBeVisible({ timeout: 10000 });
  });

  test('should show sign up form when clicking Sign Up', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.signUpButton.click();
    await expect(loginPage.nameInput).toBeVisible({ timeout: 5000 });
  });
});
