/**
 * Server-side CSPRNG adapter.
 *
 * The engine is pure and takes an injected `Rng` (a `() => number` in [0, 1)).
 * Production randomness must be cryptographically strong and must never leak,
 * so the harness builds an `Rng` backed by Node's `crypto.randomBytes` here —
 * keeping the engine itself free of any global/`Math.random` dependency
 * (steering `game-engine.md`).
 */
import { randomBytes } from "crypto";
import type { Rng } from "./engine";

/** A CSPRNG-backed {@link Rng} producing uniform floats in [0, 1). */
export function createCsprng(): Rng {
  return () => {
    // 6 random bytes → 48 bits of entropy, divided by 2^48 for a uniform float
    // in [0, 1). 48 bits comfortably exceeds a double's 52-bit mantissa needs
    // for shuffling a 108-card deck.
    const buf = randomBytes(6);
    let value = 0;
    for (let i = 0; i < buf.length; i++) {
      value = value * 256 + buf[i];
    }
    return value / 0x1000000000000; // 2^48
  };
}
