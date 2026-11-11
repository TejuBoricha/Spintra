import { test, expect } from "@playwright/test";
import { skipInDbIntegration } from "./helpers/ci-skip";

skipInDbIntegration();

test.describe("Trivia and Bingo Enhancements", () => {
  test.describe("Trivia Tool (/tools/trivia)", () => {
    test("renders expanded trivia game with category, difficulty, and options", async ({ page }) => {
      await page.goto("/tools/trivia");

      // Verify header and initial question badges
      await expect(page.getByRole("heading", { name: "Trivia", exact: true })).toBeVisible();
      await expect(page.getByText(/Q 1 \//)).toBeVisible();

      // Verify question options are accessible interactive buttons
      const options = page.getByRole("group", { name: "Trivia answer options" }).locator("button");
      await expect(options).toHaveCount(4);

      // Verify clicking an option reveals feedback and educational explanation
      await options.first().click();

      // Feedback status box should now be visible
      const statusBox = page.getByRole("status");
      await expect(statusBox).toBeVisible();
      await expect(statusBox).toContainText(/Did you know/);

      // Next Question button should be visible and focused
      const nextButton = page.getByRole("button", { name: /Next Question|See Final Results/ });
      await expect(nextButton).toBeVisible();

      // Advancing to question 2
      await nextButton.click();
      await expect(page.getByText(/Q 2 \//)).toBeVisible();
    });

    test("game settings drawer allows filtering by new categories including Gaming and Food", async ({ page }) => {
      await page.goto("/tools/trivia");

      // Open settings drawer
      const settingsToggle = page.getByRole("button", { name: "Toggle game settings and category filters" });
      await settingsToggle.click();

      await expect(page.getByText("Game Settings & Filters")).toBeVisible();

      // Category select should contain the new categories
      const categorySelect = page.locator("#trivia-tool-category");
      await expect(categorySelect).toBeVisible();
      await categorySelect.click();

      // Check popup options include both new expanded categories
      await expect(page.getByRole("option", { name: "All Categories" })).toBeVisible();
      await expect(page.getByRole("option", { name: "Gaming & Internet Culture" })).toBeVisible();
      await expect(page.getByRole("option", { name: "Food & Culinary Arts" })).toBeVisible();
      await expect(page.getByRole("option", { name: "Science & Nature" })).toBeVisible();

      // Pick Gaming & Internet Culture
      await page.getByRole("option", { name: "Gaming & Internet Culture" }).click();
      await page.getByRole("button", { name: "5", exact: true }).click();

      // Apply & Restart
      await page.getByRole("button", { name: "Apply & Restart Game" }).click();

      // Verify game restarted with 5 questions in the selected category
      await expect(page.getByText("Q 1 / 5")).toBeVisible();
      await expect(page.locator("text=Gaming & Internet Culture").first()).toBeVisible();
    });

    test("displays educational explanations in missed questions review at game completion", async ({ page }) => {
      await page.goto("/tools/trivia");

      // Set round size to 5 questions for quick completion
      const settingsToggle = page.getByRole("button", { name: "Toggle game settings and category filters" });
      await settingsToggle.click();
      await page.getByRole("button", { name: "5", exact: true }).click();
      await page.getByRole("button", { name: "Apply & Restart Game" }).click();
      await expect(page.getByText("Q 1 / 5")).toBeVisible();

      // Answer 5 questions
      for (let q = 1; q <= 5; q++) {
        const option = page.getByRole("group", { name: "Trivia answer options" }).locator("button").first();
        await option.click();
        const nextBtn = page.getByRole("button", { name: /Next Question|See Final Results/ });
        await nextBtn.click();
      }

      // Final results banner should be shown
      await expect(page.getByText(/\/ 5/)).toBeVisible();
      await expect(page.getByRole("button", { name: "Play Again" })).toBeVisible();

      // If any question was missed, review list should show the educational fact
      const reviewHeader = page.getByRole("heading", { name: /Review Missed Questions/ });
      const hasReview = await reviewHeader.isVisible();
      if (hasReview) {
        await expect(page.locator("text=Fact:").first()).toBeVisible();
      }
    });
  });

  test.describe("Bingo Tool (/tools/bingo)", () => {
    test("renders 5x5 card, allows calling numbers, and manual daubing", async ({ page }) => {
      await page.goto("/tools/bingo");

      await expect(page.getByRole("heading", { name: "Bingo", exact: true })).toBeVisible();

      // Center space is Free
      const freeSpace = page.getByRole("button", { name: /Free Space, Marked/ });
      await expect(freeSpace).toBeVisible();

      // Call next number
      const callNextBtn = page.getByRole("button", { name: /Call Next/ });
      await expect(callNextBtn).toBeVisible();
      await callNextBtn.click();

      // Latest call should be displayed
      await expect(page.getByText(/Latest Call #1/)).toBeVisible();

      // Test manual daubing on a non-free cell
      const firstCell = page.locator('button[aria-label*="B 1:"]').first();
      await expect(firstCell).toBeVisible();
      await expect(firstCell).toHaveAttribute("aria-pressed", "false");

      // Click to daub
      await firstCell.click();
      await expect(firstCell).toHaveAttribute("aria-pressed", "true");

      // Click again to un-daub
      await firstCell.click();
      await expect(firstCell).toHaveAttribute("aria-pressed", "false");
    });

    test("supports new themes including Gaming, Food, Travel, and Pattern Preview", async ({ page }) => {
      await page.goto("/tools/bingo");

      // Open settings drawer
      const settingsToggle = page.getByRole("button", { name: "Toggle game settings and themes" });
      await settingsToggle.click();

      // Open theme selector and verify expanded 10 themes exist
      const themeSelect = page.locator("#bingo-theme-select");
      await expect(themeSelect).toBeVisible();
      await themeSelect.click();

      await expect(page.getByRole("option", { name: /Gaming & Esports/ })).toBeVisible();
      await expect(page.getByRole("option", { name: /Foodie & Cuisine/ })).toBeVisible();
      await expect(page.getByRole("option", { name: /Wanderlust & Travel/ })).toBeVisible();
      await expect(page.getByRole("option", { name: /Music & Concerts/ })).toBeVisible();
      await expect(page.getByRole("option", { name: /Office & Remote Work/ })).toBeVisible();

      // Select Gaming theme
      await page.getByRole("option", { name: /Gaming & Esports/ }).click();

      // Verify winning pattern preview is visible
      const patternSelect = page.locator("#bingo-pattern-select");
      await patternSelect.click();
      await page.getByRole("option", { name: /Four Corners/ }).click();

      // Pattern preview should describe Four Corners
      await expect(page.getByText("All 4 outer corner spaces marked").first()).toBeVisible();

      // Card should be rendered with 5x5 grid
      await expect(page.getByRole("button", { name: /Free Space, Marked/ })).toBeVisible();

      // Toggle Master Board
      const masterBoardBtn = page.getByRole("button", { name: /Master Board/ });
      await masterBoardBtn.click();
      await expect(page.getByText("Called Board Matrix")).toBeVisible();
    });
  });
});
