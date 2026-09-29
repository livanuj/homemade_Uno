---
inclusion: always
---

# Verification

Two-phase testing. Follow TDD, but keep the loop tight: while developing, test only what you are working on; run the full gate only before marking a task done.

## Phase 1 — during development (fast, scoped loop)

Write the test first (TDD), then the code. **Run only the test(s) for the file/component you are actively working on.** Do NOT run the whole suite during development — it is slow and drowns out the signal for the piece you are building.

- The specific file/component you are editing:
  ```bash
  npx vitest run <path/to/that.test.ts>
  ```
- The rules-engine unit/property tests only when you are editing the engine:
  ```bash
  npx vitest run src/game/engine
  ```
- Type-check the file you are editing in your editor; do not wait for a full build.

- FORBIDDEN during development: `npm run test` (the whole suite), or running unrelated tests for code you did not touch.
- REQUIRED: a new component/function ships with a co-located test that failed before your change and passes after (red → green).

## Phase 2 — before marking a task done (full gate)

Only now run everything. All three must pass with zero errors:

```bash
npm run typecheck   # tsc --noEmit — zero type errors
npm run lint        # eslint — zero errors (warnings reviewed)
npm run test        # vitest run — full suite, all tests pass
```

Expected outcome: zero type errors, zero lint errors, every test green. If any fail, fix before completing the task — do not mark a task complete on red.

### Self-review before completing

Before you mark a task (or the whole plan) complete, **review your own diff** and resolve anything you find:

- Re-read every file you changed as if reviewing someone else's PR.
- Resolve leftover `TODO` / `FIXME` / commented-out code you introduced; address review-style comments in the diff.
- Remove debug `console.log`, scratch files, and temporary code.
- Confirm the change actually satisfies the task's `_Requirements:_` and (for engine work) `_Properties:_` references.
- FORBIDDEN: completing a task with unresolved self-review comments or dead/commented-out code you added.

## Property-based tests

Rules-engine property tests use **fast-check**, run **≥100 iterations**, and are tagged `Feature: homemade-uno, Property N`. When you change the engine, run its property suite (Phase 1 scope), not the whole app suite:

```bash
npx vitest run src/game/engine   # includes *.property.test.ts
```

## Firebase / Security Rules and realtime tests

Part of the full gate (Phase 2); they need the local stack running:

```bash
firebase emulators:start         # local Auth + Firestore + Functions
npm run test:integration         # Cloud Function + Security Rules tests
# stop emulators with Ctrl-C when done
```

## Playwright visual/e2e — run in ONLY two cases

Playwright is expensive; do not run it on every change. Run it in exactly these two situations:

1. **While building a specific screen/component** — run Playwright ONLY for that one screen to capture it at 390×844 and compare against its `design/uno-design/screens/<screen-id>.png` reference. Do NOT run the other Playwright specs.
   ```bash
   npx playwright test e2e/<that-screen>.spec.ts
   ```
2. **After all tasks are complete** — run the full Playwright suite as a final end-to-end smoke check that the app boots and the flows work. In this pass you are checking that everything runs, **not** comparing against the design PNGs.
   ```bash
   npx playwright test
   ```

- FORBIDDEN: running the whole Playwright suite while developing a single component.
- FORBIDDEN: design-PNG comparison during the final full run (case 2) — that comparison belongs to the per-screen pass (case 1).
- Note: screenshot diffing catches visual/layout drift only, not semantic correctness or full WCAG (that stays with the accessibility tasks + manual AT testing).

## Rules (summary)

- FORBIDDEN: running the full test suite (or full Playwright suite) during development — scope to the file/component you are on.
- FORBIDDEN: marking a task done while any of typecheck / lint / test is red.
- FORBIDDEN: `it.skip` / `test.only`, debug logs, or unresolved self-review comments left in committed code.
- REQUIRED: TDD — a failing test first, then code, tested at file scope.
- REQUIRED: full gate + self-review of your own diff before completing a task.
- REQUIRED: clean up temporary files and scratch scripts before completing a task.
