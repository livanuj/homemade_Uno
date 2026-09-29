import { expect, test } from "@playwright/test";
import { captureScreen } from "./helpers/capture";

/**
 * Case-1 (single-screen) capture spec for the Game over route and its variants
 * (task 8.6). Run on its own:
 *     npx playwright test e2e/game-over.spec.ts
 *
 * Captures each state at 390×844 into e2e/__shots__/<screen-id>.png so the
 * agent can eyeball it against design/uno-design/screens/07-game-over.png. It
 * does NOT assert a pixel baseline — the design comparison is by eye. The four
 * variants are reached via `?state=` on the game-over route:
 *   - team-win  → the `07-game-over` reference (2v2 team win, host view)
 *   - normal-win → single winner ("Maya wins!")
 *   - guest     → "Waiting for the host" instead of "Play again"
 *   - ended     → "Game ended" (no winner, no confetti)
 */

test("07-game-over (team win) renders and captures", async ({ page }) => {
  const shot = await captureScreen(
    page,
    "/room/K7QX/game-over?state=team-win",
    "07-game-over",
  );
  await expect(
    page.getByRole("heading", { name: "Team A wins!" }),
  ).toBeVisible();
  await expect(page.getByText("Maya played her last card")).toBeVisible();
  await expect(page.getByText("Cards left")).toBeVisible();
  await expect(page.getByText("Went out")).toBeVisible();
  await expect(page.getByRole("button", { name: "Play again" })).toBeVisible();
  await expect(
    page.getByText("Everyone stays in room K7QX"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Back to home" }),
  ).toBeVisible();
  expect(shot).toContain("07-game-over.png");
});

test("07-game-over normal winner captures", async ({ page }) => {
  await captureScreen(
    page,
    "/room/K7QX/game-over?state=normal-win",
    "07-game-over-normal-win",
  );
  await expect(
    page.getByRole("heading", { name: "Maya wins!" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Play again" })).toBeVisible();
});

test("07-game-over guest view captures", async ({ page }) => {
  await captureScreen(
    page,
    "/room/K7QX/game-over?state=guest",
    "07-game-over-guest",
  );
  await expect(page.getByText("Waiting for the host")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Play again" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Back to home" }),
  ).toBeVisible();
});

test("07-game-over 'Game ended' variant captures", async ({ page }) => {
  await captureScreen(
    page,
    "/room/K7QX/game-over?state=ended",
    "07-game-over-ended",
  );
  await expect(
    page.getByRole("heading", { name: "Game ended" }),
  ).toBeVisible();
  await expect(page.getByText("Went out")).toHaveCount(0);
  await expect(page.getByText("Cards left")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Back to home" }),
  ).toBeVisible();
});
