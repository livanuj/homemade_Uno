import { expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

// e2e/__shots__/<screen-id>.png — where raw captures land for the agent to eyeball
// against the design references.
export const SHOTS_DIR = path.resolve(here, "..", "__shots__");

// design/uno-design/screens/<screen-id>.png — the design reference images.
export const DESIGN_SCREENS_DIR = path.resolve(
  here,
  "..",
  "..",
  "design",
  "uno-design",
  "screens",
);

/**
 * CSS that neutralises motion so a capture is deterministic. `reducedMotion:
 * 'reduce'` in the config handles anything gated behind the media query; this
 * also zeroes out unconditional animations/transitions and hides carets.
 */
const DISABLE_ANIMATIONS_CSS = `
*, *::before, *::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
  scroll-behavior: auto !important;
  caret-color: transparent !important;
}
`;

/**
 * Navigate to a screen and wait until it is visually settled: DOM + network
 * idle, web fonts loaded, and all motion disabled. Returns once the page is
 * ready to capture.
 *
 * @param page  Playwright page
 * @param route App route/path to visit (e.g. "/" or "/settings")
 */
export async function gotoScreen(page: Page, route: string): Promise<void> {
  await page.goto(route, { waitUntil: "networkidle" });
  // Kill animations/transitions before we start measuring anything.
  await page.addStyleTag({ content: DISABLE_ANIMATIONS_CSS });
  // Wait for fonts so text metrics are stable in the capture.
  await page.evaluate(() => document.fonts.ready);
}

/**
 * Navigate to `route` and write a raw PNG capture to
 * `e2e/__shots__/<screenId>.png`. The agent compares this file against the
 * matching `design/uno-design/screens/<screenId>.png` reference by eye.
 *
 * This is the case-1 (single-screen) capture path from the verification policy.
 * It does NOT assert against a Playwright baseline — see `expectScreenshot` for
 * visual-regression baselines.
 */
export async function captureScreen(
  page: Page,
  route: string,
  screenId: string,
): Promise<string> {
  await gotoScreen(page, route);
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  const outPath = path.join(SHOTS_DIR, `${screenId}.png`);
  await page.screenshot({ path: outPath, fullPage: false, animations: "disabled" });
  return outPath;
}

/**
 * Navigate to `route`, then assert the page matches a stored Playwright
 * visual-regression baseline via `toHaveScreenshot`. On first run this writes
 * the baseline (under e2e/__screenshots__/…); later runs diff against it and
 * fail on drift beyond the configured tolerance.
 *
 * Use this once a screen is finalised so future changes are caught. The baseline
 * name is derived from the screen id.
 */
export async function expectScreenshot(
  page: Page,
  route: string,
  screenId: string,
): Promise<void> {
  await gotoScreen(page, route);
  await expect(page).toHaveScreenshot(`${screenId}.png`, {
    animations: "disabled",
  });
}

/**
 * Absolute path to a screen's design reference PNG. Handy when an agent wants to
 * open the reference alongside a fresh capture from `captureScreen`.
 */
export function designReferenceFor(screenId: string): string {
  return path.join(DESIGN_SCREENS_DIR, `${screenId}.png`);
}
