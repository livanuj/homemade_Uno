import { defineConfig } from "vitest/config";

/**
 * Tests that run against the LOCAL Supabase stack (`supabase start`): Row
 * Level Security and the `game` Edge Function. Kept out of the default
 * `npm run test` (which covers `src/**` only and needs no stack).
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["supabase/tests/**/*.test.ts"],
    // One shared database; keep files sequential.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
