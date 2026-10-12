/**
 * CountdownRing — the grace-period progress ring (design.md §5.20).
 *
 * An SVG ring (r=25, stroke 3) drawn around a disconnected player's avatar
 * while it is their turn: the track is `felt-edge` and the progress arc is
 * `turn`, with round caps, starting at 12 o'clock and draining clockwise over
 * the 60-second grace period. This component is purely a function of a
 * `progress` prop in 0..1 (1 = full, 0 = drained); the live countdown that
 * feeds `progress` is wired in task 5. Rotating the SVG −90° puts the stroke
 * start at 12 o'clock.
 *
 * Motion (Task 7.2, §5.20): the progress arc's `strokeDashoffset` is animated
 * with a linear tween so the ring drains smoothly as `progress` updates rather
 * than snapping between values. The default drain is linear over the 60s grace
 * period (`countdownDrain`); callers that push discrete `progress` values get a
 * short linear tween between them. Reduced motion (Req 17.6): the offset is set
 * instantly with no tween, matching theme.css's neutralized animations.
 *
 * Tokens only — `stroke-felt-edge` / `stroke-turn` are token classes
 * (token-policy.md). Marked `aria-hidden`; the accessible countdown label is
 * carried by the OfflineAvatar wrapper (§5.20).
 */
import { instant } from "@/design/motion";
import { cn } from "@/lib/cn";
import { motion } from "motion/react";

const RADIUS = 25;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export interface CountdownRingProps {
  /** Remaining fraction of the grace period, 0..1 (1 = full ring). */
  progress: number;
  /**
   * Seconds the current `progress` step should take to drain — the tween
   * duration Motion uses to reach the new offset. Defaults to a short 1s sweep
   * suited to per-second countdown ticks; task 5 supplies the live value.
   */
  stepSeconds?: number;
  /** Honor reduced motion (Req 17.6) — pass from `usePrefersReducedMotion()`. */
  reduced?: boolean;
  className?: string;
}

export function CountdownRing({
  progress,
  stepSeconds = 1,
  reduced = false,
  className,
}: CountdownRingProps) {
  const clamped = Math.min(1, Math.max(0, progress));
  // Draw only the remaining fraction; the rest is "gap" so the arc drains.
  const dashOffset = CIRCUMFERENCE * (1 - clamped);

  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 56 56"
      fill="none"
      aria-hidden="true"
      className={cn("-rotate-90", className)}
    >
      <circle
        cx="28"
        cy="28"
        r={RADIUS}
        strokeWidth="3"
        className="stroke-felt-edge"
      />
      <motion.circle
        cx="28"
        cy="28"
        r={RADIUS}
        strokeWidth="3"
        strokeLinecap="round"
        className="stroke-turn"
        strokeDasharray={CIRCUMFERENCE}
        initial={false}
        animate={{ strokeDashoffset: dashOffset }}
        transition={
          reduced ? instant : { duration: stepSeconds, ease: "linear" }
        }
      />
    </svg>
  );
}
