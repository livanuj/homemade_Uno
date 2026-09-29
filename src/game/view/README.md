# game/view/

Client-side view models derived from authoritative server state (NOT the pure
rules engine in `game/engine/`).

## The seam (established in task 8.1)

Screens read data and dispatch actions through the **`RoomStore`** seam instead
of touching a backend directly:

- `types.ts` — read-only view-model shapes the screens render: `RoomView`,
  `PlayerView`, `LobbyView`, `GameView`, plus action result / failure types.
- `store.tsx` — the `RoomStore` interface (`createRoom`, `join`, …), a React
  context `RoomStoreProvider`, and the `useRoomStore()` hook. Ships with a
  fixture-backed implementation (`createFixtureRoomStore`).
- `fixtures.ts` — in-memory rooms/players that back the store today.

### Why fixtures for now

Firebase (tasks 2/4/5 — Firestore, Cloud Functions, realtime/presence) is
**deferred** (no emulator in this environment). The screens are built against
this injectable seam and driven by fixtures. When the backend lands:

- **Task 5/9** replace `createFixtureRoomStore` with a Firestore-backed
  `RoomStore`: `onSnapshot` on `state/current` + the `players` collection maps
  into `RoomView`/`PlayerView`, and `createRoom`/`join` call the matching
  callable Cloud Functions and map their reason codes to `JoinFailureReason`.
- Screens and the provider do not change — only the store implementation passed
  to `RoomStoreProvider`.

Tasks 8.2–8.7 extend `types.ts` (lobby drag, game table, overlays) and reuse
`useRoomStore()`.
