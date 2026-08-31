import { Page, Locator, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly signUpButton: Locator;
  readonly errorMessage: Locator;
  readonly nameInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByPlaceholder('Enter your email');
    this.passwordInput = page.getByPlaceholder('Enter your password');
    this.loginButton = page.getByRole('button', { name: 'Sign In' }).last();
    this.signUpButton = page.getByRole('button', { name: 'Sign Up' });
    this.errorMessage = page.locator('.bg-red-500\\/20');
    this.nameInput = page.getByPlaceholder('Enter your full name');
  }

  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
    // Clear any existing auth state
    await this.page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    });
    await this.page.reload();
    await this.page.waitForLoadState('networkidle');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.page.getByRole('button', { name: 'Sign In' }).last().click();
  }

  async loginAsHR(email: string, password: string) {
    await this.goto();
    await this.login(email, password);
    await expect(this.page.getByText('Hiring Co-Pilot')).toBeVisible({ timeout: 10000 });
    // Wait a moment for the dashboard to fully render
    await this.page.waitForTimeout(1000);
    // Ensure we're on HR view by checking if the switch dropdown shows "Interviewer"
    const switchDropdown = this.page.locator('[data-testid="switch-user-dropdown"]');
    await expect(switchDropdown).toBeVisible({ timeout: 5000 });
    const switchText = await switchDropdown.textContent();
    if (switchText?.includes('Interviewer')) {
      await switchDropdown.click();
      await this.page.locator('[data-testid="switch-to-hr-admin"]').click();
      await this.page.waitForTimeout(2000);
      await expect(this.page.getByText('Dashboard Overview')).toBeVisible({ timeout: 10000 });
    }
  }

  async register(email: string, password: string, name: string, role: 'hr_admin' | 'interviewer' = 'hr_admin') {
    await this.signUpButton.click();
    await this.nameInput.fill(name);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    if (role === 'hr_admin') {
      await this.page.getByText('HR Admin').click();
    } else {
      await this.page.getByText('Interviewer').click();
    }
    await this.page.getByRole('button', { name: 'Create Account' }).click();
  }
}
