import type { PenaltyPrompt } from "@/game/view/penalty";
import { useEffect, useRef } from "react";

/**
 * Pause before drawing a penalty for you, so you see what hit you (and the
 * "Nothing to stack" callout) before the cards arrive.
 */
export const AUTO_DRAW_DELAY_MS = 1200;

/**
 * When a +2 / +4 is pending on you and nothing in your hand can stack on it,
 * draw it for you after {@link AUTO_DRAW_DELAY_MS} instead of waiting for a tap
 * on the deck (Req 9.4). When you CAN stack, it waits: you may stack or tap the
 * deck to take the cards. Once per penalty (keyed by the discard top that set
 * it), never while paused; the server still validates the draw.
 */
export function useAutoDrawPenalty(
  prompt: PenaltyPrompt | null,
  discardTopId: string,
  paused: boolean,
  draw: () => void,
): void {
  const drawnFor = useRef<string | null>(null);
  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
  });

  const due = !!prompt && !prompt.canStack && !paused;
  const key = `${discardTopId}:${prompt?.count ?? 0}`;

  useEffect(() => {
    if (!due || drawnFor.current === key) return;
    const t = window.setTimeout(() => {
      drawnFor.current = key;
      drawRef.current();
    }, AUTO_DRAW_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [due, key]);
}
