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

// ---------------------------------------------------------------------------
// Game-table fixtures (task 8.4) — the `03-game-2v2` and `04-game-normal`
// states as `GameView`s.
//
// These drive the Game route deterministically without a backend, so
// Playwright (via `?state=03` / `?state=04`) and tests reach each screen. When
// the realtime layer + Cloud Functions land, the same `GameView` shape is
// produced from Firestore `onSnapshot` (public state + own/partner hands) and
// these fixtures survive only for tests. Nothing here imports firebase.
//
// Card ids are stable strings ("h1", "p3", …) so task 7's shared `layoutId`
// flights have something to key on; the values/suits mirror the reference PNGs.
// ---------------------------------------------------------------------------

import type {
    GameStateId,
    GameView,
    HandCardView,
} from "./types";

/** The canned room code shared by the game fixtures (matches the lobby). */
const GAME_CODE = "K7QX";

/**
 * `03-game-2v2` — the 2v2 table on YOUR turn. Partner Maya (Team A) sits at the
 * top with her hand face-up; Leo and Sara (Team B) are face-down side seats
 * with real-count badges. The discard top is a red 7 (active color red); your
 * fan has one selected/playable red skip and a playable Wild +4, the rest
 * dimmed as unplayable (Highlight on). Seven cards, so "LAST CARD!" is off.
 */
function game03(): GameView {
  const hand: HandCardView[] = [
    { id: "h1", suit: "blue", value: 4, playable: false },
    { id: "h2", suit: "green", value: 9, playable: false },
    { id: "h3", suit: "yellow", value: 2, playable: false },
    { id: "h4", suit: "red", value: "skip", playable: true, selected: true },
    { id: "h5", suit: "blue", value: "+2", playable: false },
    { id: "h6", suit: "green", value: "reverse", playable: false },
    { id: "h7", value: "wild4", playable: true },
  ];
  return {
    selfId: "self",
    selfName: "You",
    selfTeam: "A",
    room: {
      code: GAME_CODE,
      inviteLink: inviteLinkForCode(GAME_CODE),
      mode: "team",
      phase: "playing",
      roundNumber: 1,
      players: [
        { id: "self", name: "You", joinOrder: 0, isHost: true, connection: "online", team: "A", cardCount: 7 },
        { id: "maya", name: "Maya", joinOrder: 1, isHost: false, connection: "online", team: "A", cardCount: 5 },
        { id: "leo", name: "Leo", joinOrder: 2, isHost: false, connection: "online", team: "B", cardCount: 6 },
        { id: "sara", name: "Sara", joinOrder: 3, isHost: false, connection: "online", team: "B", cardCount: 4 },
      ],
    },
    hand,
    partner: {
      id: "maya",
      name: "Maya",
      team: "A",
      connection: "online",
      hand: [
        { id: "m1", suit: "yellow", value: 5 },
        { id: "m2", suit: "green", value: 1 },
        { id: "m3", suit: "blue", value: 8 },
        { id: "m4", suit: "red", value: "+2" },
        { id: "m5", suit: "yellow", value: "reverse" },
      ],
    },
    opponents: [
      { id: "leo", name: "Leo", cardCount: 6, connection: "online", team: "B" },
      { id: "sara", name: "Sara", cardCount: 4, connection: "online", team: "B" },
    ],
    discardTop: { id: "d-top", suit: "red", value: 7 },
    discardPrev: { id: "d-prev", suit: "blue", value: 7 },
    activeColor: "red",
    direction: 1,
    activeSeatId: "self",
    turnText: "Your turn · match red or play a wild",
    canCallLastCard: false,
  };
}

/**
 * `04-game-normal` — the normal table, 5 players, on Nora's turn. There are no
 * teams or partner: every other player is a face-down seat and all rings are
 * `ink-muted` except the active player, who gets the `turn` ring + pulse and is
 * named in the turn pill. The discard top is a green 3 (active color green).
 * Seats fill clockwise from your left: Leo (left), Nora (top-left, active),
 * Omar (top-right), Sara (right).
 */
function game04(): GameView {
  const hand: HandCardView[] = [
    { id: "h1", suit: "red", value: 5, playable: true },
    { id: "h2", suit: "yellow", value: 8, playable: true },
    { id: "h3", suit: "green", value: "reverse", playable: true },
    { id: "h4", suit: "blue", value: 1, playable: true },
    { id: "h5", suit: "blue", value: "skip", playable: true },
    { id: "h6", value: "wild4", playable: true },
  ];
  return {
    selfId: "self",
    selfName: "You",
    selfMeta: "6 cards · up after Nora",
    room: {
      code: GAME_CODE,
      inviteLink: inviteLinkForCode(GAME_CODE),
      mode: "normal",
      phase: "playing",
      roundNumber: 1,
      players: [
        { id: "self", name: "You", joinOrder: 0, isHost: true, connection: "online", cardCount: 6 },
        { id: "leo", name: "Leo", joinOrder: 1, isHost: false, connection: "online", cardCount: 6 },
        { id: "nora", name: "Nora", joinOrder: 2, isHost: false, connection: "online", cardCount: 5 },
        { id: "omar", name: "Omar", joinOrder: 3, isHost: false, connection: "online", cardCount: 3 },
        { id: "sara", name: "Sara", joinOrder: 4, isHost: false, connection: "online", cardCount: 4 },
      ],
    },
    hand,
    // Clockwise from your left: left, top-left, top-right, right.
    opponents: [
      { id: "leo", name: "Leo", cardCount: 6, connection: "online" },
      { id: "nora", name: "Nora", cardCount: 5, connection: "online" },
      { id: "omar", name: "Omar", cardCount: 3, connection: "online" },
      { id: "sara", name: "Sara", cardCount: 4, connection: "online" },
    ],
    discardTop: { id: "d-top", suit: "green", value: 3 },
    discardPrev: { id: "d-prev", suit: "red", value: 3 },
    activeColor: "green",
    direction: 1,
    activeSeatId: "nora",
    turnText: "Nora's turn · color is green",
    canCallLastCard: false,
  };
}

/** Map each game state id to its `GameView` builder. */
const GAME_FIXTURES: Record<GameStateId, () => GameView> = {
  "03": game03,
  "04": game04,
};

/** All valid game state ids, for validating a `?state=` query param. */
export const GAME_STATE_IDS = Object.keys(GAME_FIXTURES) as GameStateId[];

/** Type guard: is `value` one of the game state ids? */
export function isGameStateId(value: string | null): value is GameStateId {
  return value !== null && (GAME_STATE_IDS as string[]).includes(value);
}

/**
 * Resolve a `?state=` value to a `GameView`. Unknown / missing values fall back
 * to `04` (a normal table) so a bare `/room/:code/game` still renders.
 */
export function makeGameView(state: string | null): GameView {
  const id: GameStateId = isGameStateId(state) ? state : "04";
  return GAME_FIXTURES[id]();
}
