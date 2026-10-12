import { expect, test } from "@playwright/test";
import { captureScreen } from "./helpers/capture";

/**
 * Landscape (wide-screen) captures. Run on its own:
 *     npx playwright test e2e/landscape.spec.ts
 *
 * At 1280×800 the app renders each screen's landscape layout (viewport mode
 * `landscape`); at 844×390 (a phone on its side) the compact one. Captures
 * land in e2e/__shots__/landscape-<screen>.png and compact-<screen>.png for
 * review by eye; no pixel baseline is asserted.
 */
test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

const SCREENS: [id: string, route: string][] = [
  ["landscape-01-home", "/"],
  ["landscape-01c-game-already-started", "/?state=game-already-started&code=K7QX"],
  ["landscape-01d-settings", "/settings"],
  ["landscape-01e-how-to-play", "/how-to-play"],
  ["landscape-02b-lobby-normal", "/room/K7QX?state=02b"],
  ["landscape-02d-lobby-2v2-ready", "/room/K7QX?state=02d"],
  ["landscape-02e-lobby-dragging", "/room/K7QX?state=02e"],
  ["landscape-02f-lobby-guest", "/room/K7QX?state=02f"],
  ["landscape-03-game-2v2", "/room/K7QX/game?state=03"],
  ["landscape-04-game-normal", "/room/K7QX/game?state=04"],
  ["landscape-05-menu", "/room/K7QX/game?state=03&overlay=menu"],
  ["landscape-06a-wild-color-picker", "/room/K7QX/game?state=04&overlay=wild"],
  ["landscape-06b-drew-playable-card", "/room/K7QX/game?state=03&overlay=drew"],
  ["landscape-06c-player-disconnected", "/room/K7QX/game?state=04&overlay=disconnected"],
  ["landscape-06d-leave-confirm", "/room/K7QX/game?state=03&overlay=leave"],
  ["landscape-07-game-over", "/room/K7QX/game-over?state=team-win"],
  ["landscape-08a-paused", "/room/K7QX/game?overlay=paused-break"],
];

for (const [id, route] of SCREENS) {
  test(`${id} renders and captures`, async ({ page }) => {
    await captureScreen(page, route, id);
    // Never the rotate guard at a landscape wide-screen size.
    await expect(page.getByText("Rotate to portrait")).toHaveCount(0);
  });
}

/** A phone on its side (iPhone 13 at 844×390): the compact landscape layout. */
test.describe("compact (phone on its side)", () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: false, hasTouch: false });

  for (const [id, route] of SCREENS) {
    test(`${id} renders compact and captures`, async ({ page }) => {
      await captureScreen(page, route, id.replace("landscape-", "compact-"));
      await expect(page.getByText("Rotate to portrait")).toHaveCount(0);
    });
  }
});
