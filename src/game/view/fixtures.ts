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
import { inviteLinkForCode } from "@/lib/share";
import type {
    LobbyStateId,
    LobbyView,
    PlayerView,
    RoomView,
} from "./types";

/**
 * The invite link for a room code — re-exported from the shared helper so the
 * existing `store.tsx` import keeps working and fixtures and the real mapper
 * build the same origin-relative link (no hardcoded domain; see `@/lib/share`).
 */
export { inviteLinkForCode };

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

// ---------------------------------------------------------------------------
// Paused-overlay fixtures (task 8.7) — the `08a`/`08b`/`08c` states as
// `PausedView`s that mount the `PausedOverlay` over the game table.
//
// These drive the paused states deterministically without a backend, so
// Playwright (via `?overlay=paused-break|paused-waiting|paused-auto`) and tests
// reach each distinct screen. When the realtime layer + Cloud Functions land,
// the same `PausedView` shape is derived from `state/current` (`phase`,
// `pausedBy`, `pausedAt`) + player `connection`, and these survive only for
// tests. The "Paused for m:ss" is a static value here; the live clock and the
// resume / continue / end-game wiring are task 9.6. Nothing here imports
// firebase.
// ---------------------------------------------------------------------------

import type {
    PausedOverlayId,
    PausedView,
} from "./types";

/**
 * `08a-paused` — a manual "break" pause over the 2v2 table. Maya paused; any
 * connected player can resume when everyone's ready (Req 25.3/25.4/25.7).
 */
function pausedBreak(): PausedView {
  return {
    variant: "break",
    title: "Game paused",
    body: "Maya paused the game. Anyone can resume when everyone's ready.",
    elapsedLabel: "Paused for 2:14",
    tableState: "03",
  };
}

/**
 * `08b-paused-waiting` — paused to wait for a disconnected player over the
 * normal table. Leo paused; it resumes by itself when Nora is back, or anyone
 * can "Continue without Nora" (whose turns are then skipped) (Req 25.5/25.8/25.9).
 */
function pausedWaiting(): PausedView {
  return {
    variant: "waiting",
    title: "Waiting for Nora",
    body: "Leo paused the game. It resumes by itself when Nora is back.",
    elapsedLabel: "Paused for 1:05",
    offlineName: "Nora",
    offlineCardCount: 5,
    primaryCaption: "Nora's turns will be skipped until she returns",
    tableState: "04",
  };
}

/**
 * `08c-paused-team-offline` — a server auto-pause because a whole team (Team B:
 * Leo + Sara) went offline, over the 2v2 table (Team B is a 2v2 concept). It
 * resumes by itself when either comes back; the host can "End game" (danger)
 * (Req 25.10/25.11/25.13).
 */
function pausedAuto(): PausedView {
  return {
    variant: "auto",
    title: "Team B lost connection",
    body: "The game paused by itself. It resumes when Leo or Sara comes back.",
    elapsedLabel: "Paused for 3:40",
    offlineName: "Leo",
    offlineTeam: "B",
    tableState: "03",
  };
}

/** Map each paused overlay id to its `PausedView` builder. */
const PAUSED_FIXTURES: Record<PausedOverlayId, () => PausedView> = {
  "paused-break": pausedBreak,
  "paused-waiting": pausedWaiting,
  "paused-auto": pausedAuto,
};

/** All valid paused overlay ids, for validating an `?overlay=` query param. */
export const PAUSED_OVERLAY_IDS = Object.keys(
  PAUSED_FIXTURES,
) as PausedOverlayId[];

/** Type guard: is `value` one of the three paused overlay ids? */
export function isPausedOverlayId(
  value: string | null,
): value is PausedOverlayId {
  return value !== null && (PAUSED_OVERLAY_IDS as string[]).includes(value);
}

/**
 * Resolve an `?overlay=` value to a `PausedView`, or `null` when it is not a
 * paused overlay id (so the route renders the plain table). Kept null-returning
 * so task 8.5 can own other `?overlay=` values without colliding.
 */
export function makePausedView(overlay: string | null): PausedView | null {
  return isPausedOverlayId(overlay) ? PAUSED_FIXTURES[overlay]() : null;
}

// ---------------------------------------------------------------------------
// Game-over fixtures (task 8.6) — screen `07-game-over` and its variants as
// `GameResultView`s.
//
// These drive the Game over route deterministically without a backend, so
// Playwright (via `?state=team-win|normal-win|guest|ended`) and tests reach
// each variant. When the realtime layer + Cloud Functions land, the same
// `GameResultView` shape is produced from `onSnapshot` on `state/current`
// (`winner`, `phase`) + the `players` collection, and these fixtures survive
// only for tests. Nothing here imports firebase.
//
// The `team-win` fixture mirrors the `07-game-over.png` reference exactly: a
// 2v2 win by Team A (You + Maya), Maya played her last card, counts You 3 /
// Maya 0 / Leo 4 / Sara 2, room K7QX, host view.
// ---------------------------------------------------------------------------

import type {
    GameResultView,
    ResultPlayerView,
    ResultStateId,
} from "./types";

/** The canned room code shared by the result fixtures (matches the table). */
const RESULT_CODE = "K7QX";

/** Build a result row with sensible defaults (not a winner, did not go out). */
function resultPlayer(
  id: string,
  name: string,
  cardCount: number,
  extra: Partial<ResultPlayerView> = {},
): ResultPlayerView {
  return { id, name, cardCount, isWinner: false, wentOut: false, ...extra };
}

/**
 * `team-win` — the `07-game-over` reference. Team A (You + Maya) wins in 2v2;
 * Maya played the last card. Confetti + two winner avatars, host view with
 * "Play again".
 */
function resultTeamWin(): GameResultView {
  const you = resultPlayer("self", "You", 3, { team: "A", isWinner: true });
  const maya = resultPlayer("maya", "Maya", 0, {
    team: "A",
    isWinner: true,
    wentOut: true,
  });
  const leo = resultPlayer("leo", "Leo", 4, { team: "B" });
  const sara = resultPlayer("sara", "Sara", 2, { team: "B" });
  return {
    selfId: "self",
    kind: "team",
    mode: "team",
    title: "Team A wins!",
    subtitle: "Maya played her last card",
    winners: [you, maya],
    players: [you, maya, leo, sara],
    selfIsHost: true,
    room: {
      code: RESULT_CODE,
      inviteLink: inviteLinkForCode(RESULT_CODE),
      mode: "team",
      phase: "ended",
      roundNumber: 1,
      players: [
        { id: "self", name: "You", joinOrder: 0, isHost: true, connection: "online", team: "A" },
        { id: "maya", name: "Maya", joinOrder: 1, isHost: false, connection: "online", team: "A" },
        { id: "leo", name: "Leo", joinOrder: 2, isHost: false, connection: "online", team: "B" },
        { id: "sara", name: "Sara", joinOrder: 3, isHost: false, connection: "online", team: "B" },
      ],
    },
  };
}

/**
 * `normal-win` — Normal-mode single winner (Req 12.1). Maya emptied her hand;
 * one winner avatar and the title "Maya wins!". Host view.
 */
function resultNormalWin(): GameResultView {
  const maya = resultPlayer("maya", "Maya", 0, { isWinner: true, wentOut: true });
  const you = resultPlayer("self", "You", 3);
  const leo = resultPlayer("leo", "Leo", 5);
  const sara = resultPlayer("sara", "Sara", 2);
  return {
    selfId: "self",
    kind: "player",
    mode: "normal",
    title: "Maya wins!",
    subtitle: "Maya played her last card",
    winners: [maya],
    players: [maya, you, leo, sara],
    selfIsHost: true,
    room: {
      code: RESULT_CODE,
      inviteLink: inviteLinkForCode(RESULT_CODE),
      mode: "normal",
      phase: "ended",
      roundNumber: 1,
      players: [
        { id: "self", name: "You", joinOrder: 0, isHost: true, connection: "online" },
        { id: "maya", name: "Maya", joinOrder: 1, isHost: false, connection: "online" },
        { id: "leo", name: "Leo", joinOrder: 2, isHost: false, connection: "online" },
        { id: "sara", name: "Sara", joinOrder: 3, isHost: false, connection: "online" },
      ],
    },
  };
}

/**
 * `guest` — the same 2v2 win as `team-win` but seen by a guest (Req 12.5): the
 * primary "Play again" is replaced by "Waiting for the host". Viewer is Sara
 * (Team B, a non-winner, non-host) so the guest treatment is unambiguous.
 */
function resultGuest(): GameResultView {
  return {
    ...resultTeamWin(),
    selfId: "sara",
    selfIsHost: false,
  };
}

/**
 * `ended` — the "Game ended" variant (Req 25.13): the game was ended from an
 * Auto_Pause, so there is NO winner and NO confetti. The title reads "Game
 * ended", there is no subtitle, and the results card still shows every
 * player's remaining count. Host view still offers "Play again"; "Back to
 * home" is present for all.
 */
function resultEnded(): GameResultView {
  const you = resultPlayer("self", "You", 3, { team: "A" });
  const maya = resultPlayer("maya", "Maya", 1, { team: "A" });
  const leo = resultPlayer("leo", "Leo", 4, { team: "B" });
  const sara = resultPlayer("sara", "Sara", 2, { team: "B" });
  return {
    selfId: "self",
    kind: "none",
    mode: "team",
    title: "Game ended",
    winners: [],
    players: [you, maya, leo, sara],
    selfIsHost: true,
    room: {
      code: RESULT_CODE,
      inviteLink: inviteLinkForCode(RESULT_CODE),
      mode: "team",
      phase: "ended",
      roundNumber: 1,
      players: [
        { id: "self", name: "You", joinOrder: 0, isHost: true, connection: "online", team: "A" },
        { id: "maya", name: "Maya", joinOrder: 1, isHost: false, connection: "online", team: "A" },
        { id: "leo", name: "Leo", joinOrder: 2, isHost: false, connection: "offline", team: "B" },
        { id: "sara", name: "Sara", joinOrder: 3, isHost: false, connection: "offline", team: "B" },
      ],
    },
  };
}

/** Map each game-over state id to its `GameResultView` builder. */
const RESULT_FIXTURES: Record<ResultStateId, () => GameResultView> = {
  "team-win": resultTeamWin,
  "normal-win": resultNormalWin,
  guest: resultGuest,
  ended: resultEnded,
};

/** All valid game-over state ids, for validating a `?state=` query param. */
export const RESULT_STATE_IDS = Object.keys(RESULT_FIXTURES) as ResultStateId[];

/** Type guard: is `value` one of the game-over state ids? */
export function isResultStateId(value: string | null): value is ResultStateId {
  return value !== null && (RESULT_STATE_IDS as string[]).includes(value);
}

/**
 * Resolve a `?state=` value to a `GameResultView`. Unknown / missing values
 * fall back to `team-win` (the `07-game-over` reference) so a bare
 * `/room/:code/game-over` still renders.
 */
export function makeResultView(state: string | null): GameResultView {
  const id: ResultStateId = isResultStateId(state) ? state : "team-win";
  return RESULT_FIXTURES[id]();
}
