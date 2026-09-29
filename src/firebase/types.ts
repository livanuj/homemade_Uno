/**
 * Firestore document model for Homemade Uno.
 *
 * These are the ON-THE-WIRE shapes of the room-rooted document tree exactly as
 * described in design.md "Data Models". They are distinct from the pure engine
 * types (`src/game/engine`) and the client view-models (`src/game/view`): the
 * engine is backend-agnostic; the view-models are what screens render; THESE
 * are what lives in Firestore.
 *
 * Tree (all under `rooms/{roomId}`):
 *   rooms/{roomId}                     → RoomDoc          (public)
 *   rooms/{roomId}/players/{playerId}  → PlayerDoc        (public within room)
 *   rooms/{roomId}/state/current       → StateDoc         (public within room)
 *   rooms/{roomId}/hands/{playerId}    → HandDoc          (self + partner only)
 *   rooms/{roomId}/actions/{autoId}    → ActionDoc        (server-written)
 *   rooms/{roomId}/private/deck        → DeckDoc          (server-only, deny-all read)
 *
 * The draw pile lives ONLY in the server-only `private/deck` doc so no client
 * can read draw order (Req 23.2).
 */
import type { Timestamp } from "firebase/firestore";
import type { Card, Suit } from "@/game/engine/types";

/** Card, discardPile, and Suit reuse the engine's card representation. */
export type { Card, Suit } from "@/game/engine/types";

/** Room lifecycle phase on the room doc (distinct from the state-doc phase). */
export type RoomPhase = "lobby" | "playing" | "ended";

/** Host's mode selection. */
export type GameMode = "normal" | "team";

/** 2v2 team assignment. */
export type Team = "A" | "B";

/** A player's live connection state (Req 15, 22). */
export type ConnectionState = "connected" | "disconnected" | "left";

/**
 * The fine-grained game phase carried on `state/current` (Req 6–25). Wider than
 * the room-doc phase: it includes the mid-turn and paused sub-states.
 */
export type StatePhase =
  | "dealing"
  | "active"
  | "wild_pending"
  | "drew_decision"
  | "paused"
  | "auto_paused"
  | "ended";

/** Which penalty card is on top of a pending +2/+4 stack (Req 9.5). */
export type PendingPenaltyKind = "two" | "four";

/** `rooms/{roomId}` — public room doc. */
export interface RoomDoc {
  /** 4 chars, A–Z/0–9 minus look-alikes `0 O 1 I L`; unique across active rooms. */
  roomCode: string;
  /** Current host's `Player_ID`. */
  hostPlayerId: string;
  gameMode: GameMode;
  phase: RoomPhase;
  /** Games played in the room; shown as "Round N". */
  roundNumber: number;
  createdAt: Timestamp;
  lastActivityAt: Timestamp;
}

/** `rooms/{roomId}/players/{playerId}` — seat/membership; doc id is the `Player_ID`. */
export interface PlayerDoc {
  /** 1–16 chars trimmed; duplicate suffixing applied. */
  displayName: string;
  /** Assigned at game start, kept for the game. */
  seatIndex: number | null;
  /** `A` | `B` in Team mode; null in Normal. */
  team: Team | null;
  /** Derived from `rooms.hostPlayerId`; retained per seat while host is offline. */
  isHost: boolean;
  /** For host succession ("longest-present"). */
  joinOrder: number;
  connectionState: ConnectionState;
  /** Server-recorded; drives the 60s Grace_Period. The one client-writable field. */
  lastSeen: Timestamp;
  /** Explicit leave (Req 22). */
  hasLeft: boolean;
}

/** Wild-color choice re-shown to a player after resume (Req 25.14). */
export interface PendingChoice {
  /** Which decision is pending. */
  kind: "wild_color" | "play_keep";
  /** Seat index the choice belongs to. */
  seatIndex: number;
  /** For a drew-a-playable-card decision, the drawn card id. */
  cardId?: string;
}

/** Winner descriptor stored on the state doc (Req 12). */
export type Winner =
  | { kind: "player"; playerId: string; seatIndex: number }
  | { kind: "team"; team: Team };

/**
 * `rooms/{roomId}/state/current` — the single public game-state doc while
 * playing. The draw pile is deliberately NOT here (see {@link DeckDoc}).
 */
export interface StateDoc {
  /** Optimistic-concurrency token; incremented every mutation (Req 14.5). */
  version: number;
  /** Public discard pile; the last element is the top / match constraint. */
  discardPile: Card[];
  activeColor: Suit;
  /** Exactly one active player (Req 6). */
  activeSeat: number;
  /** `+1` clockwise / `-1` counter-clockwise. */
  direction: 1 | -1;
  /** Pending +2/+4 total (Req 9). */
  penaltyCount: number;
  /** `two` | `four` — governs stacking eligibility (Req 9.5). */
  pendingPenaltyKind: PendingPenaltyKind | null;
  phase: StatePhase;
  /** One draw per turn (Req 10.3). */
  drewThisTurn: boolean;
  /** Current turn's Last_Card_Call (Req 11). */
  lastCardCalledSeat: number | null;
  /** Who paused (Req 25.4). */
  pausedBy: string | null;
  /** Drives "Paused for m:ss" (Req 25). */
  pausedAt: Timestamp | null;
  /** Wild-color or play/keep choice to re-show after resume (Req 25.14). */
  pendingChoice: PendingChoice | null;
  /** Winning player or team (Req 12). */
  winner: Winner | null;
}

/** `rooms/{roomId}/hands/{playerId}` — one doc per player per game; id is the `Player_ID`. */
export interface HandDoc {
  /** The player's cards, ordered as held. */
  cards: Card[];
  /** Denormalized for opponent badges (Req 13.5). */
  cardCount: number;
}

/**
 * `rooms/{roomId}/private/deck` — server-only; deny-all client read.
 * Holds the ordered face-down draw pile; readable ONLY by Cloud Functions
 * (Admin SDK) (Req 23.2). Doc id is `deck`.
 */
export interface DeckDoc {
  /** Face-down draw-pile order; index 0 is the next card to draw. */
  drawPile: Card[];
}

/** Action-log entry type (Req 14.5). */
export type ActionType =
  | "play"
  | "draw"
  | "keep"
  | "choose_color"
  | "call_last"
  | "pause"
  | "resume"
  | "continue_without"
  | "end_game"
  | "join"
  | "leave";

/** `rooms/{roomId}/actions/{autoId}` — append-only event log (server-written). */
export interface ActionDoc {
  playerId: string;
  type: ActionType;
  /** Version the client acted on (Req 14.5). */
  basedOnVersion: number;
  /** `accepted` | `rejected` + reason. */
  result: string;
  createdAt: Timestamp;
}
