# game/view/

Client-side view models derived from authoritative server state (NOT the pure
rules engine in `game/engine/`).

## The seam (established in task 8.1)

Screens read data and dispatch actions through the **`RoomStore`** seam and the
realtime store instead of touching the backend directly:

- `types.ts` — read-only view-model shapes the screens render: `RoomView`,
  `PlayerView`, `LobbyView`, `GameView`, plus action result / failure types.
- `store.tsx` — the `RoomStore` interface (`createRoom`, `join`), a React
  context `RoomStoreProvider`, and the `useRoomStore()` hook. The default is
  `createLiveRoomStore`, which calls the `game` Edge Function through
  `callAction` and maps its error codes to `JoinFailureReason`.
  `createFixtureRoomStore` remains for provider-less previews and tests.
- `mappers.ts` — pure functions from the realtime store (room documents) to the
  view models (`toLobbyView`, `toGameView`, overlays, paused, game over).
- `fixtures.ts` — in-memory rooms/players used by tests, previews, and the
  Playwright screen captures (`?state=…`).
