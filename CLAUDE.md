# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Homemade Uno: a mobile-only (390×844 portrait) multiplayer Uno PWA. React 19 + Vite + Tailwind v4 + Motion on the client; Firebase (Firestore, Cloud Functions, Anonymous Auth) on the backend. The game is **server-authoritative**.

## Commands

```bash
npm run dev                         # Vite dev server (auto-connects to Firebase emulators in DEV)
npm run emulators                   # Auth + Firestore + Functions emulators (needs Java + firebase CLI)
npm run typecheck                   # tsc -b --noEmit
npm run build                       # tsc -b && vite build
npm run test                        # Vitest, src/** only (jsdom, no emulator needed)
npx vitest run path/to/file.test.ts # a single test file
npx vitest run src/game/engine      # engine unit + fast-check property tests
npm run test:rules                  # Firestore Security Rules tests (wraps emulators:exec)
npm run test:functions              # builds functions/, then Cloud Function integration tests (wraps emulators:exec)
npx playwright test e2e/<screen>.spec.ts  # one screen's visual capture
```

There is no `lint` script in `package.json`, even though the steering docs list `npm run lint` as part of the gate.

Test layout: `npm run test` covers only `src/**/*.test.ts(x)`. Rules tests (`firestore/*.rules.test.ts`, config `firestore/vitest.rules.config.ts`) and functions integration tests (`functions/test/*.integration.test.ts`) have their own configs and run serially against the emulator. Playwright specs live in `e2e/`.

## Architecture

**Pure engine shared by client and server.** `src/game/engine/` is a pure, deterministic reducer (`reducer(state, action, { rng, now })`). It has no React, no I/O, no `Math.random`/`Date.now`, and it returns rejections as values instead of throwing. Cloud Functions don't duplicate it. `functions/tsconfig.json` has the repo root as `rootDir` and compiles `../src/game/engine/**` directly, and `functions/src/engine.ts` is the single import boundary. That's why the functions build output lands in `lib/functions/src/`. Engine changes take effect in functions only after a rebuild.

**Server mutates, client renders.** Every game mutation is a callable Cloud Function (`functions/src/index.ts`: rooms, lobby, start, actions, lifecycle, presence, grace). Each one runs the engine inside a Firestore transaction and is checked against `basedOnVersion`. The exceptions are `callLast` and `catchLast`: they're off-turn actions that skip the version and active-player checks in `functions/src/harness.ts`, and the engine validates them instead. Security Rules (`firestore.rules`) deny client writes to game docs; the only exception is a player's own presence/`lastSeen`. The draw-pile order lives only in a server-only `private/deck` doc.

Firestore layout: `rooms/{roomId}`, `rooms/{roomId}/players/{uid}`, `rooms/{roomId}/state/current` (public state plus `version`), and `rooms/{roomId}/hands/{uid}` (readable by the owner, and by the partner in Team mode).

**Client data flow:**
- `src/firebase/`: app init, emulator wiring, anon auth, converters. `callAction()` is the **only** transport to Cloud Functions; never call `httpsCallable` directly.
- `src/realtime/`: `onSnapshot` subscriptions feed a read-only store reducer (`store.ts`). `actions.ts`/`useGameActions()` stamp `basedOnVersion`, track an optimistic `pendingAction`, and revert on rejection. They never apply outcomes locally, because outcomes arrive via snapshots. Presence is a Firestore heartbeat on the player's own doc, not RTDB. The 60s grace period and auto-pause are enforced server-side by the `enforceGrace` function.
- `src/game/view/`: the `RoomStore` seam that screens consume via `useRoomStore()`. It maps server state to view models (`mappers.ts`, `overlays.ts`). `createFirebaseRoomStore` is the real implementation, and `createFixtureRoomStore` is the fallback for provider-less tests and previews.
- `src/routes/`: one route per page (`App.tsx`). Lobby sub-states and the game tables are the same route rendering different state. Overlays (menu, sheets, dialogs, paused) are components rendered over the table, not routes.

`src/supabase/` is a stale placeholder from an earlier backend plan; the backend is Firebase.

## Conventions (detailed rules in `.kiro/steering/`)

The `.kiro/steering/` files are the project's binding conventions. Read the relevant file before editing that area:
- `design-fidelity.md`, `token-policy.md`, `styling.md`: UI must match `design/uno-design/` (`theme.css`, `tokens.json`, `design.md`, and the `screens/*.png` references indexed by `screen-map.json`). Use tokens only: no hex/rgb values, no arbitrary `text-[]`/`rounded-[]`/`shadow-[]`, and spacing only from Tailwind's scale or values documented in `design.md`. Never interpolate class names; use static maps or CSS variables. Merge classes with `cn()` from `@/lib/cn`. Interactive elements must be native `<button>`/`<a>`/`<input>`.
- `component-architecture.md`: named exports only, PascalCase component files, one component per file. Look for an existing component in `src/components/` before adding a new one. `@/` aliases `src/`.
- `conventions/game-engine.md`: engine invariants (108-card conservation, asymmetric +2/+4 stacking, and the rest). A rule change needs a matching fast-check property test with at least 100 runs, tagged `Feature: homemade-uno, Property N`.
- `conventions/animation.md`: use the motion presets in `src/design/motion.ts` (no inline timings) and always respect `usePrefersReducedMotion()`. Animation must never gate when server state gets applied.
- `verification.md`: TDD. Run only the tests for the file you're working on, and run the full gate only before calling work done. Run Playwright only for the single screen you're building (compared against its PNG) or as a final full smoke run.
- `git-workflow.md`: task branches named `task/<n>-<slug>` stack on the previous branch, not `main`. PRs use the previous branch as their base. Stage files explicitly.

Specs: `.kiro/specs/homemade-uno/` (`requirements.md`, `design.md`, `tasks.md`). Code comments cite requirement and property numbers from there. `requirements-updates.md` and `Pause Requirements.md` are change proposals against `requirements.md`.
