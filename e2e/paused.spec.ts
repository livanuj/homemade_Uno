import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { gotoScreen, SHOTS_DIR } from "./helpers/capture";

/**
 * Case-1 (single-screen) capture spec for the paused overlays (task 8.7). Run
 * on its own:
 *     npx playwright test e2e/paused.spec.ts
 *
 * Each paused state is a `PausedOverlay` variant composed OVER the game table
 * and reached via `?overlay=` on the game route. Captures each at 390×844 into
 * e2e/__shots__/<screen-id>.png so the agent can eyeball it against
 * design/uno-design/screens/<screen-id>.png. No pixel baseline — the design
 * comparison is by eye.
 *
 * The overlay fades in via `motion/react` (JS-driven, not a CSS animation), so
 * `animations: "disabled"` alone will not force it to its end state. We wait
 * for the dialog to be fully opaque before capturing so the overlay is present
 * in the shot.
 */

/** Navigate, wait for the paused dialog to finish fading in, then capture. */
async function capturePaused(
  page: Page,
  route: string,
  screenId: string,
): Promise<string> {
  await gotoScreen(page, route);
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });
  // Wait until motion has settled the fade-in (opacity → 1) so the overlay is
  // rendered in the capture, not mid-fade at opacity 0.
  await expect
    .poll(async () =>
      dialog.evaluate((el) => Number(getComputedStyle(el).opacity)),
    )
    .toBeGreaterThan(0.99);
  const outPath = path.join(SHOTS_DIR, `${screenId}.png`);
  await page.screenshot({ path: outPath, fullPage: false, animations: "disabled" });
  return outPath;
}

test("08a-paused captures the break variant", async ({ page }) => {
  const shot = await capturePaused(
    page,
    "/room/K7QX/game?overlay=paused-break",
    "08a-paused",
  );
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Game paused");
  await expect(dialog).toContainText("Paused for 2:14");
  await expect(page.getByRole("button", { name: "Resume game" })).toBeVisible();
  expect(shot).toContain("08a-paused.png");
});

test("08b-paused-waiting captures the waiting variant", async ({ page }) => {
  const shot = await capturePaused(
    page,
    "/room/K7QX/game?overlay=paused-waiting",
    "08b-paused-waiting",
  );
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Waiting for Nora");
  await expect(
    page.getByRole("button", { name: "Continue without Nora" }),
  ).toBeVisible();
  expect(shot).toContain("08b-paused-waiting.png");
});

test("08c-paused-team-offline captures the auto variant", async ({ page }) => {
  const shot = await capturePaused(
    page,
    "/room/K7QX/game?overlay=paused-auto",
    "08c-paused-team-offline",
  );
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Team B lost connection");
  await expect(page.getByRole("button", { name: "End game" })).toBeVisible();
  expect(shot).toContain("08c-paused-team-offline.png");
});
