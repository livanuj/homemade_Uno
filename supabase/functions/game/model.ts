/**
 * Room document model (server side).
 *
 * These are the SAME JSON shapes the client reads (`src/backend/types.ts`),
 * with timestamps as epoch milliseconds. The game LOGIC is never duplicated —
 * only the plain document field shapes live here so reads/writes are typed.
 * The card/state semantics come from the shared engine (`./engine.ts`).
 */
import type { Timestamp } from "./refs.ts";
import type { Card, Suit } from "./engine.ts";

export type RoomPhase = "lobby" | "playing" | "ended";
export type GameMode = "normal" | "team";
export type Team = "A" | "B";
export type ConnectionState = "connected" | "disconnected" | "left";

export type StatePhase =
  | "dealing"
  | "active"
  | "wild_pending"
  | "drew_decision"
  | "paused"
  | "auto_paused"
  | "ended";

export type PendingPenaltyKind = "two" | "four";

export interface RoomDoc {
  roomCode: string;
  hostPlayerId: string;
  gameMode: GameMode;
  phase: RoomPhase;
  roundNumber: number;
  createdAt: Timestamp;
  lastActivityAt: Timestamp;
}

export interface PlayerDoc {
  displayName: string;
  seatIndex: number | null;
  team: Team | null;
  isHost: boolean;
  joinOrder: number;
  connectionState: ConnectionState;
  lastSeen: Timestamp;
  hasLeft: boolean;
  /**
   * Denormalized remaining-card count for opponent badges (Req 13.5). A client
   * cannot read another player's hand doc (RLS), so the server
   * mirrors the count here — a public, non-secret integer — on every hand
   * change. Undefined before the first deal.
   */
  cardCount?: number;
}

export interface PendingChoice {
  kind: "wild_color" | "play_keep";
  seatIndex: number;
  cardId?: string;
}

export type Winner =
  | { kind: "player"; playerId: string; seatIndex: number }
  | { kind: "team"; team: Team };

export interface StateDoc {
  version: number;
  discardPile: Card[];
  activeColor: Suit;
  activeSeat: number;
  direction: 1 | -1;
  penaltyCount: number;
  pendingPenaltyKind: PendingPenaltyKind | null;
  phase: StatePhase;
  drewThisTurn: boolean;
  /** Seats with a recorded Last_Card_Call (uncalled 1-card seats are catchable). */
  lastCardCalledSeats: number[];
  pausedBy: string | null;
  pausedAt: Timestamp | null;
  pendingChoice: PendingChoice | null;
  winner: Winner | null;
}

export interface HandDoc {
  cards: Card[];
  cardCount: number;
}

export interface DeckDoc {
  drawPile: Card[];
}

export type ActionType =
  | "play"
  | "draw"
  | "keep"
  | "choose_color"
  | "call_last"
  | "catch_last"
  | "pause"
  | "resume"
  | "continue_without"
  | "end_game"
  | "join"
  | "leave";

export interface ActionDoc {
  playerId: string;
  type: ActionType;
  basedOnVersion: number;
  result: string;
  createdAt: Timestamp;
}
