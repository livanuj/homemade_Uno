/**
 * Client view-model types — the read-only shapes the screens (task 8) render.
 *
 * These are derived from authoritative server state, NOT the pure rules engine
 * (`game/engine/`). The realtime layer (task 5) and Cloud Functions (task 4)
 * are DEFERRED, so today these models are produced by in-memory fixtures
 * (`fixtures.ts`) and fed through the `RoomStore` provider (`store.tsx`). When
 * the realtime layer lands, `onSnapshot` on `state/current` + `players` will
 * map into these same shapes and the screens will not change.
 *
 * Keep these minimal but derived from what the design screens actually need,
 * so 8.2–8.7 can extend them (lobby drag, game table, overlays) without a
 * rewrite.
 */

/** The Host's mode selection for the next game (Requirement 4). */
export type GameMode = "normal" | "team";

/** Which 2v2 team a seat belongs to (Team_Mode only). */
export type TeamId = "A" | "B";

/** A player's live connection state (Requirement 15). */
export type ConnectionState = "online" | "offline";

/** Room lifecycle phase, mirrored from `state/current.phase`. */
export type RoomPhase = "lobby" | "playing" | "paused" | "ended";

/**
 * A player as seen in the lobby / at the table. Hands are never included here;
 * the caller's own hand and (in 2v2) a partner's hand come through a separate
 * hands view so Security Rules (task 2) stay honoured.
 */
export interface PlayerView {
  /** Firebase Anonymous Auth uid — stable across reconnects (Player_ID). */
  id: string;
  /** Display name, already duplicate-suffixed by the server (Req 1.13). */
  name: string;
  /** Ascending join order; drives host succession and team fill. */
  joinOrder: number;
  /** True for the room Host (Req 3). */
  isHost: boolean;
  /** 2v2 team assignment; undefined in Normal_Mode. */
  team?: TeamId;
  /** Live presence (Req 15); defaults to "online". */
  connection: ConnectionState;
  /** Number of cards held — shown as a badge at the table (task 8.4). */
  cardCount?: number;
}

/**
 * The room as a whole — everything a screen needs about the session that is
 * not tied to a single player. Populated for the lobby (task 8.3) and reused
 * by the table/overlays (8.4–8.7).
 */
export interface RoomView {
  /** 4-char uppercase Room_Code (Req 2.x). */
  code: string;
  /** Shareable Invite_Link embedding the code (Req 1). */
  inviteLink: string;
  /** Host's mode selection for the next game. */
  mode: GameMode;
  /** Lifecycle phase. */
  phase: RoomPhase;
  /** Round counter, bumped on "Play again" (Req 12). */
  roundNumber: number;
  /** All players, in join order. */
  players: PlayerView[];
}

/** Lobby-facing projection (task 8.3 will consume this). */
export interface LobbyView {
  room: RoomView;
  /** The viewer's own player id, to distinguish host vs. guest views. */
  selfId: string;
}

/** Game-table projection (task 8.4 will flesh this out). */
export interface GameView {
  room: RoomView;
  selfId: string;
}

/** Why a join attempt failed — drives the Home error states (Req 2/3). */
export type JoinFailureReason =
  | "room-not-found"
  | "room-full"
  | "game-already-started";

/** Result of a create/join action requested from the Home screen. */
export type RoomActionResult =
  | { ok: true; room: RoomView }
  | { ok: false; reason: JoinFailureReason };
