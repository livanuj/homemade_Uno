import { defineConfig } from "vitest/config";

/**
 * Isolated Vitest config for the Firestore Security Rules tests.
 *
 * These tests require the Firestore + Auth emulators and are run ONLY via
 * `npm run test:rules` (which wraps this in `firebase emulators:exec`). They
 * are deliberately kept OUT of the default `npm run test` suite (whose include
 * is `src/**`), so the default unit run needs no emulator / no Java.
 *
 * Environment is `node` (no jsdom): these tests talk to the emulator over the
 * network and assert on Firestore permission outcomes, not the DOM.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["firestore/**/*.rules.test.ts"],
    // Rules tests are inherently sequential against a shared emulator; keep a
    // single fork so cleared data / seeds don't race across files.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
