---
inclusion: fileMatch
fileMatchPattern: "{src/game/engine/**,functions/**}/*.{ts,tsx}"
---

# Game Engine Conventions

The rules engine in `src/game/engine/` is the correctness surface. It is a **pure, deterministic** module: given a state, an action, and an injected RNG, it returns a new state or a rejection. Purity is what makes the property-based tests possible.

## Purity — no I/O, no globals, no time

- FORBIDDEN inside the engine:
  ```ts
  Math.random();            // nondeterministic
  Date.now();               // nondeterministic
  await getDoc(...) / db access;  // I/O in the engine
  ```
- REQUIRED — inject randomness and clock:
  ```ts
  export function shuffle<T>(cards: T[], rng: Rng): T[] { /* Fisher–Yates using rng */ }
  export function reducer(state: GameState, action: Action, ctx: { rng: Rng; now: number }): Result;
  ```
Cloud Functions supply a seeded `rng` and `now`; tests supply a fixed seed for reproducibility.

## Pure transitions — return new state, never mutate

- FORBIDDEN: `state.hands[seat].push(card)`
- REQUIRED: build and return a new state object; treat inputs as immutable.

## Rejections are values, not throws

- REQUIRED: return `{ ok: false, reason: "not_active" | "illegal_card" | "stale_version" | ... }`. The Cloud Function maps reasons to responses; the engine does not throw for expected rule violations.

## Invariants must always hold (property-tested)

Every transition must preserve these (see design.md Correctness Properties 1–15):
1. **Card conservation** — hands + draw + discard = exactly 108, no duplicate `id`.
2. **Exactly one active player** references an occupied in-game seat.
3. **Penalty clears only by drawing** the pending count; otherwise it only grows via legal stacking.
4. **Match legality** — any card reaching the discard top was legal when played.
5. **Hidden-information boundary** — engine output for a client never includes another hand (except partner in Team mode) or draw-pile order.

When you add or change a rule, add/adjust the matching property test (fast-check, ≥100 iterations, tagged `Feature: homemade-uno, Property N`) in the same change.

## Rule specifics to preserve

- Deck: 108 cards (per suit: one 0, two each 1–9, two +2, two skip, two reverse; +4 wild, +4 wild4).
- +2/+4 stacking is **asymmetric**: +2 only onto +2; wild4 onto +2 or +4; +2 onto +4 is rejected.
- Reverse and skip act as a skip with exactly 2 players.
- Draw one, then play-or-keep; reshuffle discards (except top) when the draw pile empties.
- Winning wild requires the color choice before the win resolves.
