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

/**
 * A transient team-drag in progress (design.md §5.13 / screen `02e`). The real
 * pointer/keyboard DnD wiring is task 9.2; this only carries the *visual* seam
 * so `02e-lobby-dragging` is reachable from a fixture: which row is lifted and
 * which occupied row it is hovering as a swap target.
 */
export interface LobbyDrag {
  /** Player id of the lifted (dragged) row. */
  draggingId: string;
  /** Player id of the occupied row currently under the finger (swap target). */
  overId?: string;
}

/** Lobby-facing projection (task 8.3 consumes this). */
export interface LobbyView {
  room: RoomView;
  /** The viewer's own player id, to distinguish host vs. guest views. */
  selfId: string;
  /** Active team-drag, when the host is dragging a row (screen `02e`). */
  drag?: LobbyDrag;
}

/**
 * The six lobby screen states (`02a`–`02f`). Used as the `?state=` query-param
 * value so Playwright can reach each distinct fixture and so the route can pick
 * the matching `LobbyView` without a backend.
 */
export type LobbyStateId =
  | "02a" // just created — host alone, Normal
  | "02b" // Normal with 5 players (2v2 disabled + note)
  | "02c" // 2v2 waiting — 3 players, one empty slot
  | "02d" // 2v2 ready — exactly 4 players
  | "02e" // 2v2 dragging — a row lifted over a swap target
  | "02f"; // guest view — read-only mode, "Waiting for [host]" + Leave

// ---------------------------------------------------------------------------
// Game-table projection (task 8.4) — screens `03-game-2v2` / `04-game-normal`.
//
// These shapes are what the table renders from; they are DERIVED from the
// authoritative public state (`state/current`) plus the caller's own hand and,
// in 2v2, the partner's hand (the only two hands Security Rules let a client
// read, task 2). The realtime layer (task 5) will map `onSnapshot` into these
// same shapes, so the table (8.4) and the overlays that render over it
// (8.5 menu/sheets, 8.7 paused) do not change when the backend lands.
// ---------------------------------------------------------------------------

import type { CardValue, Suit } from "@/design/suits";

/** Turn direction around the table (Req 6.6/6.7). `+1` clockwise, `-1` flipped. */
export type Direction = 1 | -1;

/**
 * One card in a hand or on the discard pile. `suit` is omitted for wild /
 * wild4 (mirrors the engine `Card` and the `PlayingCard` props). `id` is the
 * stable card id used as the animation `layoutId` (task 7) — for face-up hands
 * and the discard top.
 */
export interface CardView {
  /** Stable card id (shared `layoutId` for play/throw flight). */
  id: string;
  /** Suit — omitted for wild / wild4. */
  suit?: Suit;
  /** Value or symbol. */
  value: CardValue;
}

/**
 * A card in the caller's own fanned hand — a {@link CardView} plus the
 * per-card render flags the table needs (§7.7). `playable` drives the
 * Highlight-setting dimming (Req 7.5/7.6); `selected` raises the card.
 */
export interface HandCardView extends CardView {
  /** Whether this card can be legally played right now (Req 7.1). */
  playable: boolean;
  /** Whether the card is currently raised/selected (§7.7). */
  selected?: boolean;
}

/**
 * An opponent (non-self, non-partner) seat at the table — rendered as face-down
 * backs with the 3D recipe (§6) and a real-count badge (Req 13.3/13.4/13.5).
 * The seat position is chosen by the table from the mode + index, so this only
 * carries identity + count + presence + team.
 */
export interface OpponentSeatView {
  id: string;
  name: string;
  /** Real remaining-card count — the badge shows this even when ≤7 backs (Req 13.5). */
  cardCount: number;
  /** Live presence (Req 15); drives the offline treatment in 8.5/8.7. */
  connection: ConnectionState;
  /** 2v2 team; undefined in Normal_Mode. */
  team?: TeamId;
}

/** The partner seat (2v2 only) — face-up hand shown with the partner recipe (Req 13.1/13.2). */
export interface PartnerSeatView {
  id: string;
  name: string;
  team: TeamId;
  connection: ConnectionState;
  /** The partner's actual cards, shown FACE-UP (Req 13.1). */
  hand: CardView[];
}

/**
 * The full game-table projection consumed by `GameTable` / `GameRoute`.
 * `mode` selects the 2v2 (§7.5) vs. normal (§7.6) frame.
 */
export interface GameView {
  room: RoomView;
  /** The viewer's own player id. */
  selfId: string;
  /** The viewer's display name (shown as "You" at their row). */
  selfName: string;
  /** The viewer's team (2v2 only) — drives their row ring + "Team A · N cards". */
  selfTeam?: TeamId;
  /**
   * Optional override for the meta line under "You" in the your-row (§7.5/§7.6).
   * When omitted the table composes "Team A · N cards" (2v2) or "N cards"
   * (Normal); a fixture may pass fuller flavor like "6 cards · up after Nora".
   */
  selfMeta?: string;
  /** The caller's own fanned hand (§7.7). */
  hand: HandCardView[];
  /** The partner seat (2v2 only) — face-up hand (Req 13.1/13.2). */
  partner?: PartnerSeatView;
  /** Every other player, in clockwise seating order from the viewer's left (§7.6). */
  opponents: OpponentSeatView[];
  /** The current discard top (the card in play) and the card beneath it. */
  discardTop: CardView;
  /** The previously-played card shown at −12° under the top (§7.5). */
  discardPrev?: CardView;
  /** The active color to match (Req 6.7) — drives the ring + turn-pill dot. */
  activeColor: Suit;
  /** Turn direction (Req 6.6). */
  direction: Direction;
  /** The id of the player whose turn it is (Req 6.4/6.5). */
  activeSeatId: string;
  /** The turn-pill message (§5.5), already composed for the active state. */
  turnText: string;
  /** Pending draw penalty count, if a +2/+4 chain is open (Req 9). */
  penaltyCount?: number;
  /**
   * Whether the viewer may call "LAST CARD!" right now: their turn AND exactly
   * two cards in hand (Req 11.1). The button is enabled only when true.
   */
  canCallLastCard: boolean;
}

/**
 * The two game-table screen ids (`03`/`04`), used as the `?state=` query-param
 * value so Playwright can reach each fixture and the route can pick the frame
 * without a backend.
 */
export type GameStateId =
  | "03" // 2v2 table — your turn, partner face-up, two opponent seats
  | "04"; // normal table — 5 players, another player's turn

/** Why a join attempt failed — drives the Home error states (Req 2/3). */
export type JoinFailureReason =
  | "room-not-found"
  | "room-full"
  | "game-already-started";

/** Result of a create/join action requested from the Home screen. */
export type RoomActionResult =
  | { ok: true; room: RoomView }
  | { ok: false; reason: JoinFailureReason };
