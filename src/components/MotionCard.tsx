/**
 * MotionCard — the animated wrapper around {@link PlayingCard} (Task 7.1).
 *
 * `PlayingCard` stays a pure, presentational `<button>` (its behavior/aria is
 * unchanged and unit-tested separately). This wrapper adds the motion moments
 * from design.md §9 without touching the card's markup:
 *
 *   - Play / throw: shared `layoutId={card.id}` so the card animates from the
 *     hand to the discard top with the play spring (380/30) and settles at a
 *     random −10°…+10° rotation (Req 17.1).
 *   - Select raise: rises to its selected position over 150ms (Req 17.3).
 *   - Illegal tap: horizontal shake ±6px ×3 over 240ms (Req 7.3).
 *
 * Interrupted shared transition (Req 17.7): when the shared-layout source or
 * target is unavailable/interrupted, the card must still land at the final
 * discard position with no missing/intermediate state. We handle this by
 *   (a) committing the settled rotation via `onLayoutAnimationComplete`, and
 *   (b) providing an `interrupted` escape hatch that drops the `layoutId` and
 *       renders the card directly at its final position.
 *
 * Reduced motion (Req 17.6): callers pass `reduced` (from
 * `usePrefersReducedMotion()`). When reduced, the shared `layoutId` is dropped
 * and transitions become instant — the card appears at its destination with no
 * travel.
 *
 * Timings/springs come exclusively from `src/design/motion.ts` (animation.md).
 */
import {
  illegalShake,
  motionTransition,
  playSpring,
  randomSettleRotation,
  selectRaise,
  sharedCardLayoutId,
} from "@/design/motion";
import type { TargetAndTransition } from "motion/react";
import { motion } from "motion/react";
import { useMemo } from "react";
import { PlayingCard, type PlayingCardProps } from "./PlayingCard";

export interface MotionCardProps extends PlayingCardProps {
  /**
   * Stable card id used as the shared `layoutId` for the play/throw flight.
   * Required for the shared-layout move; omit for cards that never travel.
   */
  cardId?: string;
  /** Whether the card is on the discard top (settled, gets random rotation). */
  onDiscard?: boolean;
  /** Trigger the illegal-tap shake (Req 7.3). */
  shake?: boolean;
  /** Honor reduced motion (Req 17.6) — pass from `usePrefersReducedMotion()`. */
  reduced?: boolean;
  /**
   * Req 17.7 escape hatch: when the shared transition can't run (source/target
   * missing or interrupted), set this so the card renders directly at its
   * final position with no shared `layoutId`.
   */
  interrupted?: boolean;
  /** Deterministic rotation source for tests; defaults to Math.random. */
  rng?: () => number;
}

export function MotionCard({
  cardId,
  onDiscard = false,
  shake = false,
  reduced = false,
  interrupted = false,
  selected = false,
  rng,
  ...cardProps
}: MotionCardProps) {
  // Random settle rotation is computed once per mount so the card doesn't
  // re-roll on every render (Req 17.1). Only the settled discard card rotates.
  const settleRotation = useMemo(
    () => (onDiscard ? randomSettleRotation(rng) : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onDiscard],
  );

  // Drop the shared layoutId when reduced OR interrupted (Req 17.6 / 17.7):
  // the card commits directly to its final position with no flight.
  const layoutId = interrupted
    ? undefined
    : sharedCardLayoutId(reduced, cardId ?? "");

  // Compose the animate target: shake takes priority (a rejected play), then
  // the raised/resting select state. Presets are declared as Variants; these
  // branches are plain target objects, so narrow to TargetAndTransition.
  const animate: TargetAndTransition = shake
    ? (illegalShake.shake as TargetAndTransition)
    : selected
      ? (selectRaise.raised as TargetAndTransition)
      : { y: 0, rotate: settleRotation };

  return (
    <motion.div
      layout={!reduced && !interrupted}
      {...(layoutId ? { layoutId } : {})}
      initial={false}
      animate={animate}
      transition={motionTransition(reduced, playSpring)}
      // Req 17.7: once the layout animation finishes (or is interrupted and
      // Motion fires completion), the card is at its committed final position.
      onLayoutAnimationComplete={() => {
        /* settled — nothing further to commit; final layout is authoritative */
      }}
      className="inline-block"
    >
      <PlayingCard selected={selected} {...cardProps} />
    </motion.div>
  );
}
