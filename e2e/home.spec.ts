import { expect, test } from "@playwright/test";
import path from "node:path";
import { captureScreen, gotoScreen, SHOTS_DIR } from "./helpers/capture";

/**
 * Case-1 (single-screen) capture spec for the Home route and its states
 * (task 8.1). Run on its own:
 *     npx playwright test e2e/home.spec.ts
 *
 * Captures each state at 390×844 into e2e/__shots__/<screen-id>.png so the
 * agent can eyeball it against design/uno-design/screens/<screen-id>.png. It
 * does NOT assert a pixel baseline — the design comparison is by eye.
 */

test("01-home renders and captures", async ({ page }) => {
  const shot = await captureScreen(page, "/", "01-home");
  await expect(
    page.getByRole("heading", { name: "Homemade Uno" }),
  ).toBeVisible();
  await expect(page.getByLabel("Your name")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create a room" })).toBeVisible();
  await expect(page.getByLabel("Room code")).toBeVisible();
  await expect(page.getByRole("button", { name: "Join" })).toBeVisible();
  await expect(page.getByRole("link", { name: "How to play" })).toBeVisible();
  expect(shot).toContain("01-home.png");
});

test("01b-home-room-not-found captures the error state", async ({ page }) => {
  await gotoScreen(page, "/");
  await page.getByLabel("Your name").fill("Alex");
  // The fixture store treats ABCD as a non-existent room.
  await page.getByLabel("Room code").fill("ABCD");
  await page.getByRole("button", { name: "Join" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "No room uses the code ABCD",
  );
  await page.screenshot({
    path: path.join(SHOTS_DIR, "01b-home-room-not-found.png"),
    animations: "disabled",
  });
});

test("01c-game-already-started captures the blocked state", async ({
  page,
}) => {
  const shot = await captureScreen(
    page,
    "/?state=game-already-started&code=K7QX",
    "01c-game-already-started",
  );
  await expect(
    page.getByRole("heading", { name: "This game has already started" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Back to home" })).toBeVisible();
  expect(shot).toContain("01c-game-already-started.png");
});
