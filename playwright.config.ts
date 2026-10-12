import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config — visual UI verification for Homemade Uno.
 *
 * WHEN TO RUN PLAYWRIGHT (two-case policy, per .kiro/steering/verification.md):
 *
 *   1. While building a specific screen/component — run ONLY that one screen's
 *      spec to capture it at the 390×844 design viewport and compare against its
 *      `design/uno-design/screens/<screen-id>.png` reference:
 *          npx playwright test e2e/<that-screen>.spec.ts
 *      Do NOT run the other specs during single-screen development.
 *
 *   2. After ALL tasks are complete — run the full suite as an end-to-end smoke
 *      check that the app boots and flows work. In this pass you are NOT
 *      comparing against the design PNGs:
 *          npx playwright test
 *
 * FORBIDDEN: running the whole suite while developing a single screen.
 * FORBIDDEN: design-PNG comparison during the final full run (case 2).
 *
 * LIMITATION: screenshot diffing catches visual/layout drift only — it does NOT
 * verify semantic correctness or full WCAG conformance. Accessibility coverage
 * lives with task 10.3 (automated checks) plus manual assistive-technology testing.
 *
 * The design reference viewport is a portrait phone: 390×844 @ deviceScaleFactor 2,
 * mobile with touch. Both browser projects render at exactly that viewport so a
 * WebKit capture (targets iPhone Safari) and a Chromium capture stay comparable.
 */

// Shared design viewport — every project pins to this so captures line up with
// the 390×844 design references.
const designViewport = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  // Force reduced motion at the context level so animations don't cause flaky
  // captures. The capture helper additionally injects a stylesheet that zeroes
  // out animation/transition durations for anything not covered by the media query.
  reducedMotion: "reduce" as const,
};

export default defineConfig({
  testDir: "./e2e",
  // Baselines/snapshots for `toHaveScreenshot` are stored predictably under e2e
  // (e.g. e2e/__screenshots__/home.spec.ts/<name>-<project>.png) rather than
  // scattered next to specs.
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  // Small tolerance suitable for cross-platform font rendering differences.
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
      animations: "disabled",
    },
  },
  use: {
    baseURL: "http://localhost:5173",
    ...designViewport,
    trace: "on-first-retry",
  },
  projects: [
    {
      // Targets iPhone Safari. iPhone 13 is a 390×844 device; we still pin the
      // viewport explicitly so it can't drift if the device preset changes.
      name: "mobile-webkit",
      use: {
        ...devices["iPhone 13"],
        ...designViewport,
      },
    },
    {
      // Chromium pinned to the same 390×844 design viewport.
      name: "mobile-chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...designViewport,
      },
    },
  ],
  // Boot the Vite dev server for tests. Reuse a running server locally; always
  // start a fresh one in CI.
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
