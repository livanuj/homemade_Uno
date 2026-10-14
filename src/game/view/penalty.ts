/**
 * A +2 / +4 pending on the viewer (Req 9): how many cards it is, and whether
 * they hold a card that can stack on it. The hand's `playable` flags already
 * follow the asymmetric stacking rules (Req 9.3/9.5), so "can stack" is simply
 * "something in the hand is playable". Pure.
 */
import type { GameView } from "./types";

export interface PenaltyPrompt {
  /** Cards to draw if the viewer takes it rather than stacking. */
  count: number;
  /** Whether any card in the hand can stack on it. */
  canStack: boolean;
}

export function penaltyPrompt(view: GameView): PenaltyPrompt | null {
  const count = view.penaltyCount ?? 0;
  if (count <= 0 || view.activeSeatId !== view.selfId) return null;
  return { count, canStack: view.hand.some((c) => c.playable) };
}
