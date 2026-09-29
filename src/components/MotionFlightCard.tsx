/**
 * MotionFlightCard — the flip-in card flights (Task 7.1).
 *
 * Two related moments from design.md §9 that both animate a card flipping from
 * face-down to face-up while it moves:
 *
 *   - Opponent play (Req 17.2): the card flies from an opponent's seat to the
 *     discard top while flipping `rotateY 180 → 0` over ~350ms.
 *   - Draw (Req 10.6, 17): a card slides from the draw pile into the fan and
 *     flips face up over ~300ms with the `ease-card` curve.
 *
 * The travel (x/y) is owned by the composing screen (task 8) which knows seat
 * and pile coordinates; this component owns the flip + timing so both stay
 * consistent with the spec. Callers pass `from`/`to` offsets when they want the
 * translate handled here too.
 *
 * Reduced motion (Req 17.6): when `reduced`, the flip/slide is instant — the
 * face-up card simply appears at its destination.
 */
import {
  drawSlideTransition,
  flightFlipTransition,
  instant,
} from "@/design/motion";
import { motion } from "motion/react";
import { PlayingCard, type PlayingCardProps } from "./PlayingCard";

export type FlightKind = "opponent-play" | "draw";

export interface MotionFlightCardProps extends PlayingCardProps {
  /** Which flight this is — selects the spec timing (350ms vs 300ms). */
  kind: FlightKind;
  /** Starting translate offset in px (from the seat / draw pile). */
  from?: { x: number; y: number };
  /** Honor reduced motion (Req 17.6). */
  reduced?: boolean;
  /** Fired when the flight completes (e.g. to commit the card into state). */
  onComplete?: () => void;
}

export function MotionFlightCard({
  kind,
  from = { x: 0, y: 0 },
  reduced = false,
  onComplete,
  ...cardProps
}: MotionFlightCardProps) {
  const flip =
    kind === "opponent-play" ? flightFlipTransition : drawSlideTransition;
  const transition = reduced ? instant : flip;

  return (
    <motion.div
      style={{ transformStyle: "preserve-3d" }}
      initial={
        reduced ? false : { rotateY: 180, x: from.x, y: from.y, opacity: 0.6 }
      }
      animate={{ rotateY: 0, x: 0, y: 0, opacity: 1 }}
      transition={transition}
      {...(onComplete ? { onAnimationComplete: onComplete } : {})}
      className="inline-block"
    >
      <PlayingCard {...cardProps} />
    </motion.div>
  );
}
