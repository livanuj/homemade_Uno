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
import type {
    LobbyStateId,
    LobbyView,
    PlayerView,
    RoomView,
} from "./types";

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

// ---------------------------------------------------------------------------
// Lobby fixtures (task 8.3) — the six `02a`–`02f` states as `LobbyView`s.
//
// These drive the Lobby route deterministically without a backend, so
// Playwright (via `?state=02c`) and tests reach each distinct screen. When the
// realtime layer + Cloud Functions land, the same `LobbyView` shape is produced
// from Firestore `onSnapshot` and these fixtures survive only for tests.
// ---------------------------------------------------------------------------

/** The canned room code shared by every lobby fixture (matches `createRoom`). */
const LOBBY_CODE = "K7QX";

/** Build a lobby player with sensible defaults (online, non-host). */
function player(
  id: string,
  name: string,
  joinOrder: number,
  extra: Partial<PlayerView> = {},
): PlayerView {
  return { id, name, joinOrder, isHost: false, connection: "online", ...extra };
}

/**
 * `02a` — just created. The host sits alone in Normal mode; the list shows one
 * dashed "Share the link to invite friends" slot and Start is disabled with
 * "Invite at least 1 more player to start".
 */
function lobby02a(): LobbyView {
  return {
    selfId: "self",
    room: {
      code: LOBBY_CODE,
      inviteLink: inviteLinkForCode(LOBBY_CODE),
      mode: "normal",
      phase: "lobby",
      roundNumber: 1,
      players: [player("self", "You", 0, { isHost: true })],
    },
  };
}

/**
 * `02b` — Normal with 5 players. "Play 2v2" is disabled with the InfoNote and
 * Start is enabled.
 */
function lobby02b(): LobbyView {
  return {
    selfId: "self",
    room: {
      code: LOBBY_CODE,
      inviteLink: inviteLinkForCode(LOBBY_CODE),
      mode: "normal",
      phase: "lobby",
      roundNumber: 1,
      players: [
        player("self", "You", 0, { isHost: true }),
        player("p1", "Maya", 1),
        player("p2", "Leo", 2),
        player("p3", "Sara", 3),
        player("p4", "Omar", 4),
      ],
    },
  };
}

/**
 * `02c` — 2v2 waiting. Three players are seated (A: You, Maya; B: Leo) leaving
 * one dashed "Waiting for a player" slot in Team B; Start is disabled with
 * "2v2 needs exactly 4 players. 3 of 4 have joined."
 */
function lobby02c(): LobbyView {
  return {
    selfId: "self",
    room: {
      code: LOBBY_CODE,
      inviteLink: inviteLinkForCode(LOBBY_CODE),
      mode: "team",
      phase: "lobby",
      roundNumber: 1,
      players: [
        player("self", "You", 0, { isHost: true, team: "A" }),
        player("p1", "Maya", 1, { team: "A" }),
        player("p2", "Leo", 2, { team: "B" }),
      ],
    },
  };
}

/**
 * `02d` — 2v2 ready. Exactly 4 players fill both teams (A: You, Maya; B: Leo,
 * Sara); every host row shows a drag handle and Start is enabled.
 */
function lobby02d(): LobbyView {
  return {
    selfId: "self",
    room: {
      code: LOBBY_CODE,
      inviteLink: inviteLinkForCode(LOBBY_CODE),
      mode: "team",
      phase: "lobby",
      roundNumber: 1,
      players: [
        player("self", "You", 0, { isHost: true, team: "A" }),
        player("p1", "Maya", 1, { team: "A" }),
        player("p2", "Leo", 2, { team: "B" }),
        player("p3", "Sara", 3, { team: "B" }),
      ],
    },
  };
}

/**
 * `02e` — dragging. The `02d` roster with Leo (Team B) lifted and hovering Maya
 * (Team A) as a swap target: Maya's row becomes the dashed swap target, Leo's
 * origin slot a dashed placeholder, and the hint reads "Drop on a player to
 * swap".
 */
function lobby02e(): LobbyView {
  return {
    ...lobby02d(),
    drag: { draggingId: "p2", overId: "p1" },
  };
}

/**
 * `02f` — guest view (viewer is Maya). The mode is read-only, no drag handles,
 * and the host's Start is replaced by a "Waiting for Alex to start the game"
 * status pill plus a "Leave room" button.
 */
function lobby02f(): LobbyView {
  return {
    selfId: "p1",
    room: {
      code: LOBBY_CODE,
      inviteLink: inviteLinkForCode(LOBBY_CODE),
      mode: "team",
      phase: "lobby",
      roundNumber: 1,
      players: [
        player("p0", "Alex", 0, { isHost: true, team: "A" }),
        player("p1", "You", 1, { team: "A" }),
        player("p2", "Leo", 2, { team: "B" }),
        player("p3", "Sara", 3, { team: "B" }),
      ],
    },
  };
}

/** Map each `02a`–`02f` state id to its `LobbyView` builder. */
const LOBBY_FIXTURES: Record<LobbyStateId, () => LobbyView> = {
  "02a": lobby02a,
  "02b": lobby02b,
  "02c": lobby02c,
  "02d": lobby02d,
  "02e": lobby02e,
  "02f": lobby02f,
};

/** All valid lobby state ids, for validating a `?state=` query param. */
export const LOBBY_STATE_IDS = Object.keys(LOBBY_FIXTURES) as LobbyStateId[];

/** Type guard: is `value` one of the six lobby state ids? */
export function isLobbyStateId(value: string | null): value is LobbyStateId {
  return value !== null && (LOBBY_STATE_IDS as string[]).includes(value);
}

/**
 * Resolve a `?state=` value to a `LobbyView`. Unknown / missing values fall
 * back to `02a` (a freshly created room) so a bare `/room/:code` still renders.
 */
export function makeLobbyView(state: string | null): LobbyView {
  const id: LobbyStateId = isLobbyStateId(state) ? state : "02a";
  return LOBBY_FIXTURES[id]();
}
