import { defineConfig } from "vitest/config";

/**
 * Integration tests for the Cloud Functions run against the LOCAL emulator
 * (Functions + Firestore + Auth), started by `firebase emulators:exec` (see the
 * `test:integration` script). They are intentionally kept OUT of the root
 * `vitest` (src/**) include so the default `npm run test` stays fast and
 * emulator-independent.
 */
export default defineConfig({
  test: {
    include: ["test/**/*.integration.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Emulator is a single shared backend; run serially to avoid cross-test
    // interference on shared docs.
    fileParallelism: false,
    pool: "forks",
  },
});
