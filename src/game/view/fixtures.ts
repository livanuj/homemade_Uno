/**
 * In-memory view-model fixtures.
 *
 * The realtime layer (task 5) and Cloud Functions (task 4) are DEFERRED (no
 * emulator in this environment), so the screens are driven from these fixtures
 * through the `RoomStore` provider (`store.tsx`) for now. When the backend
 * lands, `store.tsx` swaps its data source from these fixtures to Firestore
 * `onSnapshot` + callable functions — the fixtures below stay only for tests
 * and Storybook-style previews.
 *
 * Nothing here imports firebase or performs I/O.
 */
import type { PlayerView, RoomView } from "./types";

/** A deterministic invite link for a given code (mirrors the future server). */
export function inviteLinkForCode(code: string): string {
  return `https://homemade-uno.app/room/${code}`;
}

/** A single fixture host player. */
export function makeHostPlayer(name: string, id = "self"): PlayerView {
  return {
    id,
    name,
    joinOrder: 0,
    isHost: true,
    connection: "online",
  };
}

/**
 * A freshly-created room owned by `hostName` — the state Home lands in right
 * after "Create a room". Team assignments are absent (Normal_Mode default).
 */
export function makeFreshRoom(code: string, hostName: string): RoomView {
  return {
    code,
    inviteLink: inviteLinkForCode(code),
    mode: "normal",
    phase: "lobby",
    roundNumber: 1,
    players: [makeHostPlayer(hostName)],
  };
}

/** A room the viewer is joining that already has some members. */
export function makeJoinedRoom(
  code: string,
  selfName: string,
  existing: string[] = ["Maya", "Leo"],
): RoomView {
  const players: PlayerView[] = existing.map((name, i) => ({
    id: `p${i}`,
    name,
    joinOrder: i,
    isHost: i === 0,
    connection: "online",
  }));
  players.push({
    id: "self",
    name: selfName,
    joinOrder: players.length,
    isHost: false,
    connection: "online",
  });
  return {
    code,
    inviteLink: inviteLinkForCode(code),
    mode: "normal",
    phase: "lobby",
    roundNumber: 1,
    players,
  };
}

/**
 * The set of room codes that behave a particular way in the fixture backend,
 * so screens and tests can exercise the Home error states deterministically
 * without a server. Real membership checks happen in the Cloud Functions later.
 */
export const FIXTURE_ROOMS = {
  /** Any other 4-char code resolves to a joinable lobby. */
  full: "FULL",
  started: "PLAY",
} as const;
