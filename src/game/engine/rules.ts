import { isWildCard } from "./deck";
import type { Card, GameState, PenaltyKind } from "./types";

/** The current top card of the discard pile. */
export function discardTop(state: GameState): Card {
  return state.discardPile[state.discardPile.length - 1];
}

/**
 * Whether a non-wild card matches the current match constraint: its suit equals
 * the active color, or its value/symbol equals the discard top's (Req 7.1).
 */
export function matchesNonWild(card: Card, state: GameState): boolean {
  const top = discardTop(state);
  return card.suit === state.activeColor || card.value === top.value;
}

/**
 * Whether a card would be a legal play right now, ignoring hand membership and
 * whose turn it is (those are checked by the reducer). Covers the no-penalty
 * case (Req 7.1, 7.2) and the pending-penalty stacking case (Req 9.3, 9.5).
 */
export function isLegalPlay(card: Card, state: GameState): boolean {
  if (state.penaltyCount > 0) {
    return isLegalStack(card, state.pendingPenaltyKind);
  }
  if (isWildCard(card)) {
    // Wild / wild4 legal when no penalty is pending (Req 7.2).
    return true;
  }
  return matchesNonWild(card, state);
}

/**
 * Asymmetric stacking eligibility (Req 9.3, 9.5):
 * - a `+2` stacks only onto a pending `+2`;
 * - a `wild4` stacks onto a pending `+2` or `+4`;
 * - a `+2` onto a pending `+4` is rejected;
 * - nothing else is legal while a penalty is pending.
 */
export function isLegalStack(card: Card, pendingKind: PenaltyKind | null): boolean {
  if (pendingKind === null) return false;
  if (card.value === "+2") {
    return pendingKind === "two";
  }
  if (card.value === "wild4") {
    return pendingKind === "two" || pendingKind === "four";
  }
  return false;
}

/** The penalty value a card contributes when played: +2 → 2, wild4 → 4. */
export function penaltyValue(card: Card): number {
  if (card.value === "+2") return 2;
  if (card.value === "wild4") return 4;
  return 0;
}

/** The pending-penalty kind a card establishes when played. */
export function penaltyKindOf(card: Card): PenaltyKind | null {
  if (card.value === "+2") return "two";
  if (card.value === "wild4") return "four";
  return null;
}
