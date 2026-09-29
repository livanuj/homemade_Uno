import type { Rng } from "./types";

/**
 * A small, seedable, deterministic PRNG (mulberry32). It is used only for tests
 * and any caller that wants reproducible shuffles; the production Edge Function
 * injects a CSPRNG-backed {@link Rng}. Either way the engine never calls
 * `Math.random()` itself — randomness is always injected.
 *
 * @param seed - 32-bit unsigned integer seed.
 * @returns an {@link Rng} producing floats in [0, 1).
 */
export function createSeededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
