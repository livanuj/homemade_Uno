---
inclusion: fileMatch
fileMatchPattern: "{src/backend,src/realtime,supabase}/**/*.{ts,tsx,sql}"
---

# Supabase Data & Realtime Conventions

The game is **server-authoritative**. Clients render state and send intents; the server (the `game` Edge Function) deals, shuffles, validates, and mutates. This enforces Requirements 14 and 23. Backend: **Supabase Postgres + Realtime + Edge Functions + anonymous sign-in**.

## Data model: room documents

Every room is a set of JSON documents in one table, `public.room_docs (room_id, path, doc jsonb, updated_at)`. `room_id` is the room code.

- `room` — public room doc (code, host, mode, phase, round).
- `players/<uid>` — seat/team/host/connection/lastSeen/cardCount (public within the room).
- `state/current` — public game state (discard, active seat, direction, active color, penalty, version, phase). The draw-pile order is NOT here.
- `hands/<uid>` — a player's cards; readable only by that player (+ partner in Team mode).
- `private/deck` — the draw-pile order; readable by NO client.
- `actions/<id>` — append-only action log; readable by no client.

Document shapes live in `src/backend/types.ts` (client) and `supabase/functions/game/model.ts` (server). Timestamps are epoch milliseconds. Paths live in `src/backend/paths.ts` and `supabase/functions/game/refs.ts`.

## No client writes to game documents

Clients have `SELECT` only (through RLS). Every mutation goes through the `game` Edge Function, which runs the pure rules engine.

- FORBIDDEN:
  ```ts
  await supabase.from("room_docs").update({ doc: next }).eq("path", "state/current");
  ```
- REQUIRED — call a server action through the single transport:
  ```ts
  await callAction("playCard", { roomId, cardId, basedOnVersion: state.version });
  ```

The only client write is the caller's own presence, via the `heartbeat(p_room, p_connection)` database function. It can only touch the caller's `lastSeen` (database clock) and `connectionState`.

## Server writes are atomic room commits

Server handlers use the Firestore-shaped transaction API in `supabase/functions/game/store.ts` (`db.runTransaction`, `tx.get/set/update/delete`). A transaction loads all of one room's documents, buffers writes, and commits them with `commit_room(room, rev, ops)`. If another commit landed first (`rev` changed), it re-runs, exactly like a Firestore transaction retry.

- REQUIRED: every server mutation runs inside `db.runTransaction`, scoped to one room.
- FORBIDDEN: writing `room_docs` from the Edge Function outside a transaction.

## Every action carries the state version

Optimistic concurrency: stamp each action with the `version` it was based on. The handler rejects stale or out-of-turn actions. The exceptions are `callLast` and `catchLast`, which are off-turn: they skip the version and active-player checks in `harness.ts` and the engine validates them against current state.

- REQUIRED: pass `basedOnVersion: currentState.version`; on a version-conflict reject, the store drops the optimistic marker and the Realtime subscription delivers the truth.

## Action client is the single transport layer

All server calls go through `callAction(name, payload)` in `src/backend/callAction.ts` (`supabase.functions.invoke("game", { body: { name, data } })`). Components and hooks never invoke the function directly.

- REQUIRED: a `useGameActions()` hook exposing `playCard`, `drawOne`, `chooseColor`, `pause`, etc., each delegating to `callAction`.

## Reads honor RLS; never widen scope

- The `room_docs_read` policy allows: members read everything in their room except `hands/*`, `private/*`, `actions/*`; a player reads their own hand and (2v2) their partner's.
- FORBIDDEN: granting clients write access, adding a policy that exposes `private/*`, or reading another player's hand. If a query needs data the client should not see, the logic belongs in the Edge Function.
- Any schema change is a new migration in `supabase/migrations/` plus an RLS test in `supabase/tests/rls.test.ts`.

## Realtime & presence

- `src/realtime/subscription.ts` holds ONE Realtime channel per room (`postgres_changes` on `room_docs` filtered by `room_id`). It loads all visible docs when subscribed and again when the change feed confirms it is listening, keeps the newer copy by `updated_at`, and dispatches the same store actions (`room_snapshot`, `players_snapshot`, …). Hold snapshot state in the read-only store; do not fork or locally edit it.
- Presence is a heartbeat on the caller's own player doc. The **server** (`enforceGrace`, polled by connected clients) enforces the 60s Grace_Period against `lastSeen`.

## The shared engine in Deno

The Edge Function imports the engine straight from `src/game/engine/` (`supabase/functions/game/engine.ts` is the single import boundary). Deno needs explicit extensions, so engine imports are written `./types.ts`. Locally, `supabase start` copies the function's import graph at startup: after adding a NEW engine file, restart the stack.

## Local development

- `supabase start` runs Postgres, Auth, Realtime and the Edge Function locally (Docker). `.env.local` points the app at it (see `.env.example`).
- `npm run test:supabase` runs the RLS and Edge Function tests against the local stack.

## Anti-patterns

- Duplicating rule logic on the client "for responsiveness" — the client may show optimistic *animation*, but never computes authoritative outcomes.
- Trusting client-reported presence for skip/pause decisions — always server-confirmed via `lastSeen`.
- Leaving a Supabase query builder un-awaited: `void supabase.from(...).update(...)` never runs. Await it or `.then()` it.
