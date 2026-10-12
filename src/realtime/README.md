# realtime/

The read-only authoritative store, Firestore `onSnapshot` subscriptions,
presence heartbeat, reconnect resync, and the versioned action client
(Task 5). See `.kiro/steering/conventions/firestore-data.md`.

## Modules

- `store.ts` — the read-only authoritative store: a pure reducer over server
  snapshots (`room`, `players`, `state/current`, own/partner hand) plus
  client-only optimistic bookkeeping (`pendingAction`, `rejection`). Screens
  render from this; they never mutate it.
- `subscription.ts` — `subscribeRoom()` attaches the `onSnapshot` listeners
  (room doc, players collection, `state/current`, own + partner hand) and feeds
  the store. Returns an unsubscribe that detaches everything; swaps the partner
  listener as seats settle; re-attach on reconnect by calling it again.
- `actions.ts` — the versioned action client + `useGameActions()` hook. Stamps
  every request with the current `state.version` (`basedOnVersion`), records an
  optimistic `pendingAction`, delegates to `callAction` (the single transport),
  and reverts on rejection. Never mutates the store on accept — the authoritative
  outcome arrives via the snapshot listeners.
- `presence.ts` — `startHeartbeat()` bumps the caller's own
  `players/{uid}.lastSeen` (`serverTimestamp()`) on an interval + on
  visibility/online/focus events. The **server** enforces the 60s grace against
  `lastSeen`; the client is never trusted for skip/pause.
- `useRoomChannel.ts` — the top-level seam: holds the store in a `useReducer`,
  attaches/tears down the listeners + heartbeat, re-attaches on
  `online`/`visibilitychange` (reconnect resync within 5s), and exposes the
  action client. Task 9 adopts this to back the screens.

## Presence approach: Firestore heartbeat (not RTDB `onDisconnect`)

The design allows either. We use a Firestore heartbeat on the caller's own
`players/{uid}` doc because the existing Security Rules already permit a client
to write only its own `lastSeen`/`connectionState`, it needs no RTDB emulator or
`database` block in `firebase.json`, and correctness is unaffected: the server
enforces the grace period against `lastSeen` regardless of how it was recorded.

## Server-enforced grace / auto-pause

The grace countdown and auto-pause/auto-resume are NOT client logic. The
connected clients call the `enforceGrace` Cloud Function (see
`functions/src/grace.ts`), which compares `now − lastSeen` against the 60s
`Grace_Period` server-side and skips / auto-pauses accordingly. Client-reported
presence is never trusted for skip/pause decisions.
