---
inclusion: fileMatch
fileMatchPattern: "src/{supabase,realtime}/**/*.{ts,tsx}"
---

# Supabase Data & Realtime Conventions

The game is **server-authoritative**. Clients render state and send intents; the server (Edge Functions / RPC) deals, shuffles, validates, and mutates. This enforces Requirements 14 and 23.

## No raw game-table writes from the client

- FORBIDDEN:
  ```ts
  await supabase.from("game_state").update({ active_seat: next }).eq("room_id", id);
  await supabase.from("hands").update({ cards }).eq("player_id", uid);
  ```
- REQUIRED — call an Edge Function that runs the rules engine server-side:
  ```ts
  await callAction("play_card", { roomId, cardId, basedOnVersion: state.version });
  ```
There is no client write policy on `game_state`, `hands`, or `draw_pile`. The only client write allowed is a player updating **their own** `players.last_seen`.

## Every action carries the state version

Optimistic-concurrency: stamp each action with the `version` it was based on. The server rejects stale or out-of-turn actions.

- REQUIRED: pass `basedOnVersion: currentState.version`; on a version-conflict reject, resync from the broadcast and revert optimistic UI.

## Action client is the single transport layer

All Edge Function calls go through one thin `callAction(name, payload)` wrapper in `src/supabase/`. Components and hooks never call `supabase.functions.invoke` directly.

- FORBIDDEN: `supabase.functions.invoke("play_card", ...)` inside a component.
- REQUIRED: a `useGameActions()` hook exposing `playCard`, `drawOne`, `chooseColor`, `pause`, etc., each delegating to `callAction`.

## Reads honor RLS; never widen scope

- A client reads only: its own hand, the public `game_state` projection (excludes `draw_pile`), the partner's hand in Team mode, and room/player rows (no hand data).
- FORBIDDEN: selecting `draw_pile`, or another player's `hands` row. If a query needs data the client should not see, the logic belongs server-side.

## Realtime subscription conventions

- One channel per room, keyed by `room_id`. Subscribe to the public `game_state` projection, `players`, and own/partner `hands`.
- Presence tracks connection; the server (not presence) enforces the 60s Grace_Period against `last_seen`.
- Hold server state in a read-only store; do not fork or locally edit it.

## Anti-patterns

- Duplicating rule logic on the client "for responsiveness" — the client may show optimistic *animation*, but never computes authoritative outcomes.
- Trusting presence for skip/pause decisions — always server-confirmed via `last_seen`.
