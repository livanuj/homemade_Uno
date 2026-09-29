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

// ---------------------------------------------------------------------------
// Paused-overlay projection (task 8.7) — screens `08a-paused`,
// `08b-paused-waiting`, `08c-paused-team-offline`.
//
// The paused states render the `PausedOverlay` (§11/§12) OVER the game table.
// They are STATE on top of a `GameView`, not separate routes, so the table
// underneath keeps rendering (and its menu stays reachable, Req 25.15) while
// the overlay drives which variant/copy shows. The realtime layer (task 5) will
// derive this same shape from `state/current` (`phase` `paused`/`auto_paused`,
// `pausedBy`, `pausedAt`, plus player `connection`); the interactions
// (resume / continue-without / end-game wiring) are task 9.6. Nothing here
// imports firebase.
// ---------------------------------------------------------------------------

import type { PausedVariant } from "@/components/PausedOverlay";

/**
 * The projection that drives the `PausedOverlay` over the table. Carries the
 * variant, the copy the design screens show, and the offline-player details the
 * `waiting` / `auto` headers need. The `elapsedLabel` is the "Paused for m:ss"
 * text — a static value from the fixture for the capture; the live ticking
 * clock is task 9.6.
 */
export interface PausedView {
  /** Which `PausedOverlay` variant to show (`break` / `waiting` / `auto`). */
  variant: PausedVariant;
  /** Heading, e.g. "Game paused", "Waiting for Nora", "Team B lost connection". */
  title: string;
  /** Explanation paragraph under the title. */
  body: string;
  /** "Paused for m:ss" pill text (static in the fixture). */
  elapsedLabel: string;
  /** Offline player's name — shown in the `waiting` / `auto` avatar header. */
  offlineName?: string;
  /** Offline player's remaining card count (badge on the header avatar). */
  offlineCardCount?: number;
  /** Team label for the `auto` variant header (e.g. "B"). */
  offlineTeam?: TeamId;
  /** Helper caption under the primary action (used by the `waiting` variant). */
  primaryCaption?: string;
  /**
   * Which underlying table (`03` 2v2 / `04` normal) the overlay sits over —
   * the reference screens show `08a` over 2v2 and `08b`/`08c` over normal.
   */
  tableState: GameStateId;
}

/**
 * The three paused screen states, used as the `?overlay=` query-param value so
 * Playwright can reach each fixture and the route can pick the matching
 * `PausedView` without a backend. Kept distinct from the menu/sheet overlay
 * values (task 8.5) so the two never collide.
 */
export type PausedOverlayId =
  | "paused-break" // `08a` — manual pause ("Game paused" + Resume game)
  | "paused-waiting" // `08b` — waiting for a disconnected player (Continue without)
  | "paused-auto"; // `08c` — auto-pause, a whole team offline (End game)

// ---------------------------------------------------------------------------
// Game-over projection (task 8.6) — screen `07-game-over` and its variants.
//
// Shown to everyone once `state/current.phase === "ended"`. It is DERIVED from
// the authoritative public state: the `winner` field (Normal → a player, Team →
// a team, or none when the game was ended from an Auto_Pause), plus each
// player's remaining-card count and who played the last card. No hands are
// needed here — only counts — so this stays inside what Security Rules expose.
//
// The realtime layer (task 5) maps `onSnapshot` on `state/current` + `players`
// into this shape; today the result fixtures (`fixtures.ts`) produce it, keyed
// by `?state=` so Playwright and links reach each variant. The screen + these
// types are ADD-only over the existing lobby/table view-models.
// ---------------------------------------------------------------------------

/**
 * What kind of outcome the game ended with (Req 12.1/12.2, Req 25.13):
 * - `player` — Normal_Mode: a single winner emptied their hand.
 * - `team`   — Team_Mode: a whole team wins (either partner emptied a hand).
 * - `none`   — the game was ended from an Auto_Pause ("Game ended"); there is
 *              no winner and no confetti.
 */
export type ResultKind = "player" | "team" | "none";

/**
 * One row in the "CARDS LEFT" results card (§5.25). Carries just what the row
 * renders: the player's identity, their remaining count, whether they are on
 * the winning side (drives the winner ring), and whether they went out (the
 * team-colored "Went out" badge on the player who played the last card).
 */
export interface ResultPlayerView {
  id: string;
  name: string;
  /** Remaining cards held when the game ended (Req 12.3). */
  cardCount: number;
  /** 2v2 team assignment; undefined in Normal_Mode. */
  team?: TeamId;
  /** True when this player is on the winning player/team — winning-ring + grouping. */
  isWinner: boolean;
  /** True for the player who played the final card ("Went out" badge, Req 12.3). */
  wentOut: boolean;
}

/**
 * The full game-over projection consumed by `GameOverRoute`. Everything the
 * result screen and its four variants need, with nothing tied to a live turn.
 */
export interface GameResultView {
  room: RoomView;
  /** The viewer's own player id. */
  selfId: string;
  /** Outcome kind — selects confetti/title treatment and the "Game ended" variant. */
  kind: ResultKind;
  /** Game mode of the finished game — 2v2 groups the results card by team. */
  mode: GameMode;
  /**
   * The result title, already composed for the outcome:
   * "Team A wins!" / "Maya wins!" / "Game ended" (Req 12.1, 25.13).
   */
  title: string;
  /**
   * Optional subtitle naming who played the last card, e.g. "Maya played her
   * last card" (Req 12.3). Omitted for the no-winner "Game ended" variant.
   */
  subtitle?: string;
  /**
   * The winners shown as overlapping avatars at the top (§5.25): one in Normal,
   * two in 2v2, none for "Game ended". Ordered as displayed.
   */
  winners: ResultPlayerView[];
  /** Every player's remaining-count row for the "CARDS LEFT" card (Req 12.3). */
  players: ResultPlayerView[];
  /**
   * Whether the viewer is the Host — the Host sees "Play again"; guests see
   * "Waiting for the host" (Req 12.5). After host transfer (Req 12.7) the new
   * host is reflected here.
   */
  selfIsHost: boolean;
}

/**
 * The game-over screen states used as the `?state=` query-param value so
 * Playwright can reach each variant and the route can pick the matching
 * `GameResultView` without a backend.
 */
export type ResultStateId =
  | "team-win" // 2v2 team win (the `07-game-over` reference), host view
  | "normal-win" // Normal single winner ("Maya wins!"), host view
  | "guest" // guest view — "Waiting for the host" instead of "Play again"
  | "ended"; // "Game ended" — no winner, no confetti (Req 25.13)
