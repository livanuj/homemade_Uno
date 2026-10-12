import { expect, test } from "@playwright/test";
import { captureScreen } from "./helpers/capture";

/**
 * Case-1 (single-screen) capture spec for the game table (task 8.4). Run on its
 * own:
 *     npx playwright test e2e/game.spec.ts
 *
 * Captures `03-game-2v2` and `04-game-normal` at 390×844 into
 * e2e/__shots__/<screen-id>.png so the agent can eyeball each against
 * design/uno-design/screens/<screen-id>.png. It does NOT assert a pixel
 * baseline — the design comparison is by eye.
 *
 * The two tables are the same route rendering different fixtures, keyed by the
 * `?state=` query param (03 = 2v2, 04 = normal).
 *
 * NOTE (Task 10): the accessible LiveAnnouncer renders the current turn text in
 * an sr-only `role="status"` live region, so the turn text appears twice in the
 * DOM — once in the visible `TurnPill` and once in the status region. Turn-text
 * assertions therefore scope to the VISIBLE pill (`:not([role="status"])`) and
 * check the live region separately.
 */

test("03-game-2v2 renders and captures", async ({ page }) => {
  const shot = await captureScreen(
    page,
    "/room/K7QX/game?state=03",
    "03-game-2v2",
  );
  // Top bar mode chip carries the round (Req 12.6).
  await expect(page.getByText("2v2 · Round 1")).toBeVisible();
  // Partner hand is face-up (Req 13.1/13.2).
  await expect(page.getByRole("button", { name: "Yellow 5" })).toBeVisible();
  await expect(page.getByText("Partner · 5 cards")).toBeVisible();
  // Turn pill (visible) — exclude the sr-only live region.
  await expect(
    page.locator(':not([role="status"])', {
      hasText: "Your turn · match red or play a wild",
    }).last(),
  ).toBeVisible();
  // The polite live region mirrors the same turn text (Req 18.4/18.7).
  await expect(page.getByRole("status")).toContainText(
    "Your turn · match red or play a wild",
  );
  await expect(page.getByRole("button", { name: "LAST CARD!" })).toBeVisible();
  expect(shot).toContain("03-game-2v2.png");
});

test("04-game-normal renders and captures", async ({ page }) => {
  const shot = await captureScreen(
    page,
    "/room/K7QX/game?state=04",
    "04-game-normal",
  );
  await expect(page.getByText("Normal · 5 players")).toBeVisible();
  // Active player named in the visible turn pill (Req 6.4/6.5) — exclude the
  // sr-only live region.
  await expect(
    page.locator(':not([role="status"])', {
      hasText: "Nora's turn · color is green",
    }).last(),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "Nora's turn · color is green",
  );
  await expect(page.getByRole("button", { name: "Draw a card" })).toBeVisible();
  expect(shot).toContain("04-game-normal.png");
});
