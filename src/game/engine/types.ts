// Pure rules-engine types for Homemade Uno.
//
// This module is the correctness surface: it is pure and deterministic given an
// injected RNG. No React, no I/O, no globals, no time. See
// .kiro/steering/conventions/game-engine.md.

/** The four card suits. Wild cards have no suit. */
export type Suit = "red" | "yellow" | "green" | "blue";

/** Number values 0–9. */
export type NumberValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** Action-card symbols that belong to a suit. */
export type ActionValue = "+2" | "skip" | "reverse";

/** Wild-card symbols; these carry no suit. */
export type WildValue = "wild" | "wild4";

/** Every value a card can carry. */
export type CardValue = NumberValue | ActionValue | WildValue;

/**
 * A playing card. `suit` is absent for wild cards. `id` is a stable, unique
 * identifier reused for the shared-layout play animation (design Req 17.1).
 */
export interface Card {
  readonly id: string;
  readonly suit?: Suit;
  readonly value: CardValue;
}

/** Game mode selected by the host. */
export type GameMode = "normal" | "team";

/** Team assignment in Team mode. */
export type Team = "A" | "B";

/** Play direction: +1 clockwise, -1 counter-clockwise. */
export type Direction = 1 | -1;

/** Which kind of penalty card is currently on top of the pending stack. */
export type PenaltyKind = "two" | "four";

/**
 * Engine phase. Governs which actions are permitted.
 * - `active`         — normal play; the active player may play/draw/call.
 * - `wild_pending`   — a wild was played; the same player must choose a color.
 * - `drew_decision`  — the player drew a playable card; must play it or keep it.
 * - `ended`          — the game is over; all game actions are rejected.
 */
export type Phase = "active" | "wild_pending" | "drew_decision" | "ended";

/** A player's seat at the table. Seats are ordered by `seat` ascending. */
export interface Seat {
  readonly playerId: string;
  readonly seat: number;
  readonly team?: Team;
}

/**
 * The authoritative game state. All fields are treated as immutable; every
 * transition returns a new object rather than mutating the input.
 */
export interface GameState {
  readonly mode: GameMode;
  /** Occupied seats, sorted by `seat` ascending. */
  readonly seats: readonly Seat[];
  /** Hand per seat index (parallel to `seats`), ordered as held. */
  readonly hands: readonly (readonly Card[])[];
  /** Server-only draw pile; index 0 is the next card to draw. */
  readonly drawPile: readonly Card[];
  /** Public discard pile; the last element is the top card. */
  readonly discardPile: readonly Card[];
  readonly activeColor: Suit;
  /** Index into `seats` of the active player. */
  readonly activeSeat: number;
  readonly direction: Direction;
  readonly penaltyCount: number;
  readonly pendingPenaltyKind: PenaltyKind | null;
  readonly phase: Phase;
  /** True once the active player has drawn their one card this turn. */
  readonly drewThisTurn: boolean;
  /** Seat index that recorded a Last_Card_Call this turn, or null. */
  readonly lastCardCalledSeat: number | null;
  /** Winner once the game has ended: a seat index (Normal) or a team (Team). */
  readonly winner: Winner | null;
}

/** The winner of a finished game. */
export type Winner =
  | { readonly kind: "player"; readonly seat: number; readonly playerId: string }
  | { readonly kind: "team"; readonly team: Team };

/** The action union accepted by {@link reducer}. */
export type Action =
  | { readonly type: "play"; readonly playerId: string; readonly cardId: string }
  | { readonly type: "choose_color"; readonly playerId: string; readonly color: Suit }
  | { readonly type: "draw"; readonly playerId: string }
  | { readonly type: "keep"; readonly playerId: string }
  | { readonly type: "call_last"; readonly playerId: string };

/** Reasons an action can be rejected. Rejections are values, never thrown. */
export type RejectionReason =
  | "not_active"
  | "wrong_phase"
  | "card_not_in_hand"
  | "illegal_card"
  | "illegal_stack"
  | "already_drew"
  | "no_penalty_pending"
  | "not_two_cards"
  | "game_ended";

/** A rejection: the action was refused and state is left unchanged. */
export interface Rejection {
  readonly ok: false;
  readonly reason: RejectionReason;
}

/** A successful transition producing a new state. */
export interface Success {
  readonly ok: true;
  readonly state: GameState;
}

/** The result of applying an action: success (new state) or rejection. */
export type Result = Success | Rejection;

/** Context injected into the reducer: an RNG (and, in future, a clock). */
export interface EngineContext {
  readonly rng: Rng;
}

/** A deterministic random generator returning a float in [0, 1). */
export type Rng = () => number;

/** Connection state of a player, used by the auto-pause predicate. */
export type ConnectionState = "connected" | "disconnected" | "left";

/** A player's connection snapshot for the auto-pause predicate. */
export interface ConnectionSnapshot {
  readonly playerId: string;
  readonly team?: Team;
  readonly connection: ConnectionState;
}
