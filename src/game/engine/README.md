# game/engine/

The pure rules engine — no React, no I/O, injected seeded RNG. See
`.kiro/steering/conventions/game-engine.md`.

## Modules

- `types.ts` — `Card`, `GameState`, `Action`, `Result` (success | rejection),
  and supporting types. Rejections are values, never thrown.
- `rng.ts` — `createSeededRng` (mulberry32) for reproducible shuffles in tests.
- `deck.ts` — `buildDeck` (108 cards), `shuffle` (Fisher–Yates), card predicates.
- `deal.ts` — `assignSeats`, `deal` (deal 7, number-card initial discard,
  host-first, clockwise, team seat alternation).
- `turn.ts` — turn advancement with reverse/skip incl. the exact-2-player case.
- `rules.ts` — match legality and asymmetric +2/+4 stacking predicates.
- `reducer.ts` — `reducer(state, action, ctx)`: the single transition function
  (play, choose_color, draw, keep, call_last), win detection, last-card penalty.
- `autopause.ts` — `shouldAutoPause`, a pure predicate over connection state.
- `index.ts` — the public API barrel.

## Correctness properties

Properties 1–15 from `design.md` are implemented as fast-check tests (≥100
runs each), tagged `Feature: homemade-uno, Property N`, plus unit tests for the
concrete edge cases. Run only the engine suite during development:

```bash
npx vitest run src/game/engine
```
