import { expect, test } from "@playwright/test";
import { captureScreen } from "./helpers/capture";

/**
 * Case-1 (single-screen) capture spec for the five in-game overlays (task 8.5:
 * `05-menu`, `06a`–`06d`). Run on its own:
 *     npx playwright test e2e/game-overlays.spec.ts
 *
 * Each overlay is reached over the game table through the `?overlay=` query
 * param and captured at 390×844 into e2e/__shots__/<screen-id>.png so the agent
 * can eyeball it against design/uno-design/screens/<screen-id>.png. It does NOT
 * assert a pixel baseline — the design comparison is by eye.
 */

test("05-menu captures the in-game menu drawer", async ({ page }) => {
  const shot = await captureScreen(
    page,
    "/room/K7QX/game?state=03&overlay=menu",
    "05-menu",
  );
  const drawer = page.getByRole("dialog", { name: "Menu" });
  await expect(drawer.getByText("Sound effects")).toBeVisible();
  await expect(drawer.getByText("Highlight playable cards")).toBeVisible();
  await expect(
    drawer.getByRole("button", { name: "Pause game" }),
  ).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Leave game" })).toBeVisible();
  expect(shot).toContain("05-menu.png");
});

test("06a-wild-color-picker captures the wild picker sheet", async ({
  page,
}) => {
  const shot = await captureScreen(
    page,
    "/room/K7QX/game?state=04&overlay=wild",
    "06a-wild-color-picker",
  );
  const sheet = page.getByRole("dialog", { name: "Choose a color" });
  await expect(sheet.getByRole("button", { name: "Red" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Blue" })).toBeVisible();
  // No cancel / close in the picker (§5.16).
  await expect(page.getByRole("button", { name: /close/i })).toHaveCount(0);
  expect(shot).toContain("06a-wild-color-picker.png");
});

test("06b-drew-playable-card captures the drew-a-card sheet", async ({
  page,
}) => {
  const shot = await captureScreen(
    page,
    "/room/K7QX/game?state=03&overlay=drew",
    "06b-drew-playable-card",
  );
  await expect(page.getByText("Red 3 fits the pile")).toBeVisible();
  await expect(page.getByRole("button", { name: "Play it" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Keep it" })).toBeVisible();
  expect(shot).toContain("06b-drew-playable-card.png");
});

test("06c-player-disconnected captures the disconnected table state", async ({
  page,
}) => {
  const shot = await captureScreen(
    page,
    "/room/K7QX/game?state=04&overlay=disconnected",
    "06c-player-disconnected",
  );
  await expect(
    page.getByText("Waiting for Nora · skipping in 42s"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pause and wait" }),
  ).toBeVisible();
  await expect(page.getByText("Nora lost connection")).toBeVisible();
  expect(shot).toContain("06c-player-disconnected.png");
});

test("06d-leave-confirm captures the leave-confirm dialog", async ({ page }) => {
  const shot = await captureScreen(
    page,
    "/room/K7QX/game?state=03&overlay=leave",
    "06d-leave-confirm",
  );
  const dialog = page.getByRole("alertdialog", { name: "Leave this game?" });
  await expect(
    dialog.getByRole("button", { name: "Stay in game" }),
  ).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Leave game" })).toBeVisible();
  expect(shot).toContain("06d-leave-confirm.png");
});
