import { Page, Locator } from '@playwright/test';

export class InterviewerDashboardPage {
  readonly page: Page;
  readonly assignedCandidates: Locator;
  readonly scheduleTab: Locator;
  readonly generateQBButton: Locator;
  readonly submitReviewButton: Locator;
  readonly previousReviewContext: Locator;

  constructor(page: Page) {
    this.page = page;
    this.assignedCandidates = page.locator('[data-testid="assigned-candidate"]');
    this.scheduleTab = page.getByRole('tab', { name: /schedule/i });
    this.generateQBButton = page.getByRole('button', { name: /generate.*question/i });
    this.submitReviewButton = page.getByRole('button', { name: /submit.*review/i });
    this.previousReviewContext = page.locator('[data-testid="previous-review-context"]');
  }

  async goto() {
    await this.page.goto('/interviewer-dashboard');
  }

  async selectCandidate(name: string) {
    await this.page.getByText(name).click();
  }

  async generateQuestionBank(round: number = 1) {
    await this.generateQBButton.click();
    if (round > 1) {
      await this.page.getByLabel(/round/i).selectOption(round.toString());
    }
  }
}
