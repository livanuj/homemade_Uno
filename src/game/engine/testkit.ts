// Shared test helpers for the engine property/unit tests. Not part of the
// public engine API; imported only by *.test.ts files. Kept pure and
// deterministic (any randomness is derived from an injected Rng).

import { isWildCard } from "./deck";
import { reducer } from "./reducer";
import { discardTop, isLegalPlay } from "./rules";
import type { Card, EngineContext, GameMode, GameState, Rng, Suit } from "./types";

export const ALL_SUITS: readonly Suit[] = ["red", "yellow", "green", "blue"];

/** Every card currently in play: all hands + draw pile + discard pile. */
export function allCards(state: GameState): Card[] {
  return [...state.hands.flat(), ...state.drawPile, ...state.discardPile];
}

/** The multiset of card ids across the whole state, sorted for comparison. */
export function cardIdMultiset(state: GameState): string[] {
  return allCards(state)
    .map((c) => c.id)
    .sort();
}

/** Count of distinct occupied+in-game active seats — should always be 1. */
export function activeSeatIsValid(state: GameState): boolean {
  return (
    Number.isInteger(state.activeSeat) &&
    state.activeSeat >= 0 &&
    state.activeSeat < state.seats.length
  );
}

/**
 * Choose one legal action for the current state, or `null` if the active player
 * has no obvious legal move (which the driver resolves by drawing). This drives
 * the random-legal-sequence generator used by the conservation property.
 *
 * The choice is deterministic given `rng`.
 */
export function pickLegalAction(state: GameState, rng: Rng): DriverAction | null {
  if (state.phase === "ended") return null;

  if (state.phase === "wild_pending") {
    const color = ALL_SUITS[Math.floor(rng() * ALL_SUITS.length)];
    return { type: "choose_color", playerId: activePlayerId(state), color };
  }

  if (state.phase === "drew_decision") {
    // Half the time keep, half the time play the (playable) drawn card.
    const hand = state.hands[state.activeSeat];
    const drawn = hand[hand.length - 1];
    if (rng() < 0.5 && isLegalPlay(drawn, state)) {
      return { type: "play", playerId: activePlayerId(state), cardId: drawn.id };
    }
    return { type: "keep", playerId: activePlayerId(state) };
  }

  // phase === "active": find a legal card to play, else draw.
  const hand = state.hands[state.activeSeat];
  const legal = hand.filter((c) => isLegalPlay(c, state));
  if (legal.length > 0) {
    const card = legal[Math.floor(rng() * legal.length)];
    return { type: "play", playerId: activePlayerId(state), cardId: card.id };
  }
  return { type: "draw", playerId: activePlayerId(state) };
}

/** The action shape the driver emits (mirrors the engine Action union). */
export type DriverAction =
  | { type: "play"; playerId: string; cardId: string }
  | { type: "choose_color"; playerId: string; color: Suit }
  | { type: "draw"; playerId: string }
  | { type: "keep"; playerId: string };

/**
 * Run up to `maxSteps` random legal actions, invoking `onStep(state)` after
 * every accepted transition (and once for the initial state). Stops early if
 * the game ends. Returns the final state.
 */
export function runLegalSequence(
  initial: GameState,
  ctx: EngineContext,
  maxSteps: number,
  onStep: (state: GameState) => void,
): GameState {
  let state = initial;
  onStep(state);
  for (let i = 0; i < maxSteps; i++) {
    if (state.phase === "ended") break;
    const action = pickLegalAction(state, ctx.rng);
    if (action === null) break;
    const result = reducer(state, action, ctx);
    if (!result.ok) {
      // The driver only proposes legal actions; a rejection is unexpected but
      // we simply stop the sequence rather than loop forever.
      break;
    }
    state = result.state;
    onStep(state);
  }
  return state;
}

export function activePlayerId(state: GameState): string {
  return state.seats[state.activeSeat].playerId;
}

/** Build a DealInput's players list of the given size. */
export function playerList(count: number): { playerId: string }[] {
  return Array.from({ length: count }, (_, i) => ({ playerId: `p${i}` }));
}

/** Pick a valid player count for a mode (2–8 Normal, exactly 4 Team). */
export function playerCountForMode(mode: GameMode, raw: number): number {
  if (mode === "team") return 4;
  return raw;
}

/**
 * Construct a minimal, valid custom GameState for targeted unit tests. Callers
 * supply hands and the discard top; the draw pile defaults to whatever cards
 * are passed. This bypasses `deal` so tests can set up exact scenarios.
 */
export function makeState(overrides: Partial<GameState> & Pick<GameState, "seats" | "hands" | "discardPile" | "activeColor">): GameState {
  return {
    mode: "normal",
    drawPile: [],
    activeSeat: 0,
    direction: 1,
    penaltyCount: 0,
    pendingPenaltyKind: null,
    phase: "active",
    drewThisTurn: false,
    lastCardCalledSeat: null,
    winner: null,
    ...overrides,
  };
}

/** True when the discard top is a wild (used by tests reasoning about color). */
export function topIsWild(state: GameState): boolean {
  return isWildCard(discardTop(state));
}
