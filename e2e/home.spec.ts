import { test, expect } from "@playwright/test";
import { captureScreen } from "./helpers/capture";

/**
 * Example / smoke spec — proves the Playwright harness works end-to-end:
 * the config boots `npm run dev`, the capture helper waits for fonts + disables
 * motion, and a PNG lands in e2e/__shots__/.
 *
 * NOTE: the home screen is still the task-1.1 placeholder; the real screens
 * (and their design-PNG comparisons) are built in task 8. So this spec does a
 * plain capture of "/" and only asserts the page rendered — it deliberately
 * does NOT compare against design/uno-design/screens/01-home.png yet.
 *
 * Per the two-case policy (see playwright.config.ts / .kiro/steering/verification.md),
 * this is a case-1 style single-screen spec: run it on its own with
 *     npx playwright test e2e/home.spec.ts
 */
test("home route renders and can be captured", async ({ page }) => {
  const shotPath = await captureScreen(page, "/", "01-home-smoke");

  // Prove the app actually rendered something, not a blank/error page.
  await expect(page.getByRole("heading", { name: "Homemade Uno" })).toBeVisible();

  expect(shotPath).toContain("01-home-smoke.png");
});
