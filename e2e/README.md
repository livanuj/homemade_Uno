# e2e — Playwright visual UI verification

Visual verification harness for Homemade Uno. Renders screens at the design
viewport (**390×844 @ deviceScaleFactor 2**, mobile + touch) in two browser
projects — `mobile-webkit` (targets iPhone Safari) and `mobile-chromium`.

## When to run Playwright — two cases only

Playwright is expensive. Run it in exactly these two situations
(see `.kiro/steering/verification.md`):

1. **While building a specific screen** — run ONLY that screen's spec to capture
   it at 390×844 and compare against its
   `design/uno-design/screens/<screen-id>.png` reference:

   ```bash
   npx playwright test e2e/<that-screen>.spec.ts
   ```

   Do NOT run the other specs during single-screen development.

2. **After all tasks are complete** — run the full suite as an end-to-end smoke
   check that the app boots and the flows work. In this pass you are **not**
   comparing against the design PNGs:

   ```bash
   npx playwright test
   ```

**Forbidden:** running the whole suite while developing a single screen.
**Forbidden:** design-PNG comparison during the final full run (case 2).

## Limitation

Screenshot diffing catches **visual / layout drift only**. It does **not**
verify semantic correctness or full WCAG conformance. Accessibility coverage
lives with task 10.3 (automated checks) plus manual assistive-technology testing.

## Layout

- `playwright.config.ts` (repo root) — viewport, projects, `webServer`, snapshot settings.
- `e2e/helpers/capture.ts` — reusable helpers:
  - `gotoScreen` — navigate, wait for network idle + `document.fonts.ready`, disable animations/transitions (plus config-level `reducedMotion: 'reduce'`).
  - `captureScreen` — capture a raw PNG into `e2e/__shots__/<screen-id>.png` (case-1 capture the agent eyeballs against the design reference).
  - `expectScreenshot` — assert against a Playwright `toHaveScreenshot` baseline stored under `e2e/__screenshots__/`.
  - `designReferenceFor` — path to a screen's `design/uno-design/screens/<id>.png`.
- `e2e/__shots__/` — raw captures (git-ignored scratch output).
- `e2e/__screenshots__/` — committed visual-regression baselines.
- `e2e/home.spec.ts` — example/smoke spec proving the harness works.

## Browsers

Fetch the browser binaries once:

```bash
npx playwright install chromium webkit
```
