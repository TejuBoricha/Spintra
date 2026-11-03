import { test, expect } from "@playwright/test";

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

    test("game settings drawer allows filtering by category and difficulty", async ({ page }) => {
      await page.goto("/tools/trivia");

      // Open settings drawer
      const settingsToggle = page.getByRole("button", { name: "Toggle game settings and category filters" });
      await settingsToggle.click();

      await expect(page.getByText("Game Settings & Filters")).toBeVisible();

      // Category select should contain the new categories
      const categorySelect = page.locator("#trivia-tool-category");
      await expect(categorySelect).toBeVisible();
      await categorySelect.click();

      // Check popup options and pick Science & Nature
      await expect(page.getByRole("option", { name: "All Categories" })).toBeVisible();
      await expect(page.getByRole("option", { name: "Science & Nature" })).toBeVisible();
      await expect(page.getByRole("option", { name: "Technology", exact: true })).toBeVisible();
      await expect(page.getByRole("option", { name: "Arts & Literature" })).toBeVisible();

      await page.getByRole("option", { name: "Science & Nature" }).click();
      await page.getByRole("button", { name: "5", exact: true }).click();

      // Apply & Restart
      await page.getByRole("button", { name: "Apply & Restart Game" }).click();

      // Verify game restarted with 5 questions
      await expect(page.getByText("Q 1 / 5")).toBeVisible();
      await expect(page.locator("text=Science & Nature").first()).toBeVisible();
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

    test("supports themed word bingo cards and called master board matrix", async ({ page }) => {
      await page.goto("/tools/bingo");

      // Open settings drawer
      const settingsToggle = page.getByRole("button", { name: "Toggle game settings and themes" });
      await settingsToggle.click();

      // Select Science & Nature theme
      const themeSelect = page.locator("#bingo-theme-select");
      await expect(themeSelect).toBeVisible();
      await themeSelect.click();
      await page.getByRole("option", { name: /Science & Nature/ }).click();

      // Card should update with science terms (not just numbers)
      await expect(page.getByText("Science & Nature").first()).toBeVisible();

      // Toggle Master Board
      const masterBoardBtn = page.getByRole("button", { name: /Master Board/ });
      await masterBoardBtn.click();
      await expect(page.getByText("Called Board Matrix")).toBeVisible();
    });
  });
});
