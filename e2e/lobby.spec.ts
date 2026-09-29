import { expect, test } from "@playwright/test";
import { captureScreen } from "./helpers/capture";

/**
 * Case-1 (single-screen) capture spec for the Lobby route and its six states
 * (task 8.3). Run on its own:
 *     npx playwright test e2e/lobby.spec.ts
 *
 * Each `02a`–`02f` state is reachable via `?state=` on the lobby route, keyed to
 * a distinct fixture. Captures land at 390×844 in e2e/__shots__/<screen-id>.png
 * so the agent can eyeball them against design/uno-design/screens/<screen-id>.png.
 * It does NOT assert a pixel baseline — the design comparison is by eye.
 */

const LOBBY = "/room/K7QX";

test("02a-lobby-just-created captures", async ({ page }) => {
  const shot = await captureScreen(
    page,
    `${LOBBY}?state=02a`,
    "02a-lobby-just-created",
  );
  await expect(page.getByRole("heading", { name: "Game room" })).toBeVisible();
  await expect(page.getByText("K7QX")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start game" })).toBeDisabled();
  await expect(
    page.getByText("Invite at least 1 more player to start"),
  ).toBeVisible();
  expect(shot).toContain("02a-lobby-just-created.png");
});

test("02b-lobby-normal captures", async ({ page }) => {
  const shot = await captureScreen(
    page,
    `${LOBBY}?state=02b`,
    "02b-lobby-normal",
  );
  await expect(page.getByRole("radio", { name: /Play 2v2/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Start game" })).toBeEnabled();
  expect(shot).toContain("02b-lobby-normal.png");
});

test("02c-lobby-2v2-waiting captures", async ({ page }) => {
  const shot = await captureScreen(
    page,
    `${LOBBY}?state=02c`,
    "02c-lobby-2v2-waiting",
  );
  await expect(page.getByText("TEAM A")).toBeVisible();
  await expect(page.getByText("TEAM B")).toBeVisible();
  await expect(page.getByText("Waiting for a player")).toBeVisible();
  await expect(
    page.getByText("2v2 needs exactly 4 players. 3 of 4 have joined."),
  ).toBeVisible();
  expect(shot).toContain("02c-lobby-2v2-waiting.png");
});

test("02d-lobby-2v2-ready captures", async ({ page }) => {
  const shot = await captureScreen(
    page,
    `${LOBBY}?state=02d`,
    "02d-lobby-2v2-ready",
  );
  await expect(page.getByRole("button", { name: "Start game" })).toBeEnabled();
  await expect(page.getByText("Drag to change teams")).toBeVisible();
  expect(shot).toContain("02d-lobby-2v2-ready.png");
});

test("02e-lobby-dragging captures", async ({ page }) => {
  const shot = await captureScreen(
    page,
    `${LOBBY}?state=02e`,
    "02e-lobby-dragging",
  );
  await expect(page.getByText("Drop on a player to swap")).toBeVisible();
  await expect(page.getByText("Swap", { exact: true })).toBeVisible();
  expect(shot).toContain("02e-lobby-dragging.png");
});

test("02f-lobby-guest captures", async ({ page }) => {
  const shot = await captureScreen(
    page,
    `${LOBBY}?state=02f`,
    "02f-lobby-guest",
  );
  await expect(
    page.getByText("Game mode · chosen by the host"),
  ).toBeVisible();
  await expect(
    page.getByText("Waiting for Alex to start the game"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Leave room" })).toBeVisible();
  expect(shot).toContain("02f-lobby-guest.png");
});
