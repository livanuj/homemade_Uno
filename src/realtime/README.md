# realtime/

The read-only authoritative store, the room's Supabase Realtime subscription,
the presence heartbeat, reconnect resync, and the versioned action client
(Task 5, moved to Supabase in Task 12). See
`.kiro/steering/conventions/supabase-data.md`.

## Modules

- `store.ts` — the read-only authoritative store: a pure reducer over server
  snapshots (`room`, `players`, `state/current`, own/partner hand) plus
  client-only optimistic bookkeeping (`pendingAction`, `rejection`). Screens
  render from this; they never mutate it.
- `subscription.ts` — `subscribeRoom()` opens ONE Realtime channel
  (`postgres_changes` on `room_docs`, filtered by room) and feeds the store the
  same snapshots per document path. Row Level Security decides which rows
  arrive (never another player's hand, the deck, or the action log). It loads
  all visible documents on subscribe and again once the change feed confirms
  it is listening, keeping the newer copy by `updated_at`. Re-attach on
  reconnect by calling it again.
- `actions.ts` — the versioned action client + `useGameActions()` hook. Stamps
  every request with the current `state.version` (`basedOnVersion`), records an
  optimistic `pendingAction`, delegates to `callAction` (the single transport),
  and reverts on rejection. Never mutates the store on accept — the
  authoritative outcome arrives via the Realtime subscription.
- `presence.ts` — `startHeartbeat()` calls the `heartbeat` database function on
  an interval + on visibility/online/focus events. It stamps only the caller's
  own `lastSeen` (database clock) and `connectionState`.
- `useRoomChannel.ts` — the top-level seam: holds the store in a `useReducer`,
  attaches/tears down the subscription + heartbeat, re-attaches on
  `online`/`visibilitychange` (reconnect resync within 5s), and exposes the
  action client.

## Server-enforced grace / auto-pause

The grace countdown and auto-pause/auto-resume are NOT client logic. The
connected clients call the `enforceGrace` action (see
`supabase/functions/game/grace.ts`), which compares `now − lastSeen` against
the 60s `Grace_Period` server-side and skips / auto-pauses accordingly.
Client-reported presence is never trusted for skip/pause decisions.
