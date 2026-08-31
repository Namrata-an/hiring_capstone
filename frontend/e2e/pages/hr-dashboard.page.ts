import { Page, Locator } from '@playwright/test';

export class HRDashboardPage {
  readonly page: Page;
  readonly jobsTab: Locator;
  readonly candidatesTab: Locator;
  readonly talentSearchTab: Locator;
  readonly communicationsTab: Locator;
  readonly addJobButton: Locator;
  readonly uploadResumeButton: Locator;
  readonly searchInput: Locator;
  readonly candidateCards: Locator;
  readonly pipelineCanvas: Locator;

  constructor(page: Page) {
    this.page = page;
    this.jobsTab = page.getByRole('tab', { name: /jobs/i });
    this.candidatesTab = page.getByRole('tab', { name: /candidates/i });
    this.talentSearchTab = page.getByRole('tab', { name: /talent|search/i });
    this.communicationsTab = page.getByRole('tab', { name: /communications|emails/i });
    this.addJobButton = page.getByRole('button', { name: /add job|create job/i });
    this.uploadResumeButton = page.getByRole('button', { name: /upload|resume/i });
    this.searchInput = page.getByPlaceholder(/search/i);
    this.candidateCards = page.locator('[data-testid="candidate-card"]');
    this.pipelineCanvas = page.locator('[data-testid="pipeline-canvas"]');
  }

  async goto() {
    await this.page.goto('/hr-dashboard');
  }

  async searchTalent(query: string) {
    await this.talentSearchTab.click();
    await this.searchInput.fill(query);
    await this.page.keyboard.press('Enter');
  }

  async openCommunications() {
    await this.communicationsTab.click();
  }
}
