# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Homemade Uno: a mobile-only (390×844 portrait) multiplayer Uno PWA. React 19 + Vite + Tailwind v4 + Motion on the client; Supabase (Postgres, Realtime, one Edge Function, anonymous sign-in) on the backend. The game is **server-authoritative**. The frontend deploys to Vercel (`vercel.json` rewrites every path to `index.html`).

## Commands

```bash
supabase start                      # local stack in Docker: Postgres + Auth + Realtime + Edge Functions
npm run dev                         # Vite dev server (reads .env.local; see .env.example)
npm run typecheck                   # tsc -b --noEmit
npm run build                       # tsc -b && vite build
npm run test                        # Vitest, src/** only (jsdom, no backend needed)
npx vitest run path/to/file.test.ts # a single test file
npx vitest run src/game/engine      # engine unit + fast-check property tests
npm run functions:check             # Deno typecheck of supabase/functions/game
npm run test:supabase               # RLS + Edge Function + realtime tests (needs `supabase start`)
npx vitest run --config supabase/vitest.config.ts supabase/tests/rls.test.ts  # one stack test file
npx playwright test e2e/<screen>.spec.ts  # one screen's visual capture
```

There is no `lint` script in `package.json`, even though the steering docs list `npm run lint` as part of the gate.

Test layout: `npm run test` covers only `src/**/*.test.ts(x)`. Stack tests live in `supabase/tests/` (config `supabase/vitest.config.ts`), use real anonymous users and fresh room ids, read connection details from `supabase status`, and run serially. Playwright specs live in `e2e/`.

## Architecture

**Pure engine shared by client and server.** `src/game/engine/` is a pure, deterministic reducer (`reducer(state, action, { rng, now })`). It has no React, no I/O, no `Math.random`/`Date.now`, and it returns rejections as values instead of throwing. The Edge Function doesn't duplicate it: `supabase/functions/game/engine.ts` imports it straight from `src/`. Deno needs explicit extensions, so engine imports are written `./types.ts`. Locally, `supabase start` copies the function's import graph at startup, so after adding a NEW engine file, restart the stack.

**Server mutates, client renders.** Every room and game mutation is a POST to the `game` Edge Function (`supabase/functions/game/index.ts` routes `{ name, data }` to handlers: rooms, lobby, start, actions, lifecycle, presence, grace). Handlers use a Firestore-shaped transaction API (`store.ts`: `db.runTransaction`, `tx.get/set/update/delete`). A transaction loads one room's documents, buffers writes, and commits them atomically via the `commit_room` database function, retrying if another commit landed first. Actions are checked against `basedOnVersion`. The exceptions are `callLast` and `catchLast`: they're off-turn actions that skip the version and active-player checks in `harness.ts`, and the engine validates them instead.

**Data:** one table, `room_docs (room_id, path, doc jsonb, updated_at)`, defined in `supabase/migrations/`. `room_id` is the room code. Paths are `room`, `players/<uid>`, `state/current` (public state plus `version`), `hands/<uid>` (readable by the owner, and by the partner in Team mode), `private/deck` (no client can read it), and `actions/<id>` (server-only log). Row Level Security gives clients read access only. The only client write is the `heartbeat` database function for the caller's own presence. Timestamps are epoch milliseconds.

**Client data flow:**
- `src/backend/`: Supabase client, anonymous session (`ensureSession`, `useSession`), document types and paths. `callAction()` is the **only** transport to the Edge Function.
- `src/realtime/`: one Realtime channel per room (`subscription.ts`) feeds a read-only store reducer (`store.ts`). `actions.ts`/`useGameActions()` stamp `basedOnVersion`, track an optimistic `pendingAction`, and revert on rejection. They never apply outcomes locally, because outcomes arrive via Realtime. Presence is a heartbeat; the 60s grace period and auto-pause are enforced server-side by the `enforceGrace` action.
- `src/game/view/`: the `RoomStore` seam that screens consume via `useRoomStore()`. It maps server state to view models (`mappers.ts`, `overlays.ts`). `createLiveRoomStore` is the real implementation, and `createFixtureRoomStore` is the fallback for provider-less tests and previews.
- `src/routes/`: one route per page (`App.tsx`). Lobby sub-states and the game tables are the same route rendering different state. Overlays (menu, sheets, dialogs, paused) are components rendered over the table, not routes.

A Supabase query builder only runs when awaited or `.then()`'d: `void supabase.from(...).update(...)` silently does nothing.

## Conventions (detailed rules in `.kiro/steering/`)

The `.kiro/steering/` files are the project's binding conventions. Read the relevant file before editing that area:
- `design-fidelity.md`, `token-policy.md`, `styling.md`: UI must match `design/uno-design/` (`theme.css`, `tokens.json`, `design.md`, and the `screens/*.png` references indexed by `screen-map.json`). Use tokens only: no hex/rgb values, no arbitrary `text-[]`/`rounded-[]`/`shadow-[]`, and spacing only from Tailwind's scale or values documented in `design.md`. Never interpolate class names; use static maps or CSS variables. Merge classes with `cn()` from `@/lib/cn`. Interactive elements must be native `<button>`/`<a>`/`<input>`.
- `component-architecture.md`: named exports only, PascalCase component files, one component per file. Look for an existing component in `src/components/` before adding a new one. `@/` aliases `src/`.
- `conventions/supabase-data.md`: the data model, RLS, the single transport, atomic room commits, and Realtime. Any schema change is a new migration plus an RLS test.
- `conventions/game-engine.md`: engine invariants (108-card conservation, asymmetric +2/+4 stacking, and the rest). A rule change needs a matching fast-check property test with at least 100 runs, tagged `Feature: homemade-uno, Property N`.
- `conventions/animation.md`: use the motion presets in `src/design/motion.ts` (no inline timings) and always respect `usePrefersReducedMotion()`. Animation must never gate when server state gets applied.
- `verification.md`: TDD. Run only the tests for the file you're working on, and run the full gate only before calling work done. Run Playwright only for the single screen you're building (compared against its PNG) or as a final full smoke run.
- `git-workflow.md`: task branches named `task/<n>-<slug>` stack on the previous branch, not `main`. PRs use the previous branch as their base. Stage files explicitly.

Specs: `.kiro/specs/homemade-uno/` (`requirements.md`, `design.md`, `tasks.md`). Code comments cite requirement and property numbers from there. `requirements-updates.md` and `Pause Requirements.md` are change proposals against `requirements.md`.
