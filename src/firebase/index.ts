/**
 * Public surface of the Firebase module.
 *
 * Task 9 will adopt these (client + auth + converters) to back the `RoomStore`
 * seam that currently uses fixtures. Nothing here is wired into the app yet —
 * the fixture store still backs the screens.
 */
export { app, auth, db, functions, useEmulator } from "./client";
export { ensureSession, onSession, type Session } from "./auth";
export { useSession, type SessionStatus, type UseSessionResult } from "./useSession";
export * from "./types";
export {
  actionConverter,
  actionsRef,
  deckConverter,
  deckRef,
  handConverter,
  handRef,
  playerConverter,
  playerRef,
  playersRef,
  roomConverter,
  roomRef,
  stateConverter,
  stateRef,
} from "./converters";
