import { expect, test } from "@playwright/test";
import path from "node:path";
import { captureScreen, gotoScreen, SHOTS_DIR } from "./helpers/capture";

/**
 * Case-1 (single-screen) capture spec for Settings (01d) and How to play (01e)
 * — task 8.2. Run on its own:
 *     npx playwright test e2e/settings.spec.ts
 *
 * Captures each screen at the 390×844 design viewport into
 * e2e/__shots__/<screen-id>.png so the agent can eyeball it against
 * design/uno-design/screens/<screen-id>.png. It does NOT assert a pixel
 * baseline — the design comparison is by eye.
 */

test("01d-settings renders and captures", async ({ page }) => {
  // Seed the device store so the name field matches the reference ("Alex") and
  // the Vibration row is present (the reference shows a device that supports it).
  await page.addInitScript(() => {
    localStorage.setItem(
      "uno.settings",
      JSON.stringify({
        name: "Alex",
        sound: true,
        vibration: true,
        highlight: true,
      }),
    );
    // Force the Vibration API to exist so the row shows in the capture.
    if (!("vibrate" in navigator)) {
      Object.defineProperty(navigator, "vibrate", { value: () => true });
    }
  });

  const shot = await captureScreen(page, "/settings", "01d-settings");

  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByLabel("Your name")).toHaveValue("Alex");
  await expect(page.getByRole("switch", { name: "Sound effects" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Vibration" })).toBeVisible();
  await expect(
    page.getByRole("switch", { name: "Highlight playable cards" }),
  ).toBeVisible();
  await expect(page.getByText("Version 1.0")).toBeVisible();
  expect(shot).toContain("01d-settings.png");
});

test("01e-how-to-play renders and captures the full scrolling page", async ({
  page,
}) => {
  // This page is a tall scrolling rules page (design height 2012px), so capture
  // the full page rather than just the 390×844 viewport (Req 16.5).
  await gotoScreen(page, "/how-to-play");

  await expect(page.getByRole("heading", { name: "How to play" })).toBeVisible();
  for (const section of [
    "On your turn",
    "Action cards",
    "Stacking",
    "Last card!",
    "2v2 teams",
    "If someone drops out",
  ]) {
    await expect(page.getByRole("heading", { name: section })).toBeVisible();
  }

  await page.screenshot({
    path: path.join(SHOTS_DIR, "01e-how-to-play.png"),
    fullPage: true,
    animations: "disabled",
  });
});
