/**
 * CountdownRing — the grace-period progress ring (design.md §5.20).
 *
 * An SVG ring (r=25, stroke 3) drawn around a disconnected player's avatar
 * while it is their turn: the track is `felt-edge` and the progress arc is
 * `turn`, with round caps, starting at 12 o'clock and draining clockwise over
 * the 60-second grace period. This component is purely a function of a
 * `progress` prop in 0..1 (1 = full, 0 = drained); the live countdown that
 * feeds `progress` is wired in task 5, and the smooth drain animation in task
 * 7. Rotating the SVG −90° puts the stroke start at 12 o'clock.
 *
 * Tokens only — `stroke-felt-edge` / `stroke-turn` are token classes
 * (token-policy.md). Marked `aria-hidden`; the accessible countdown label is
 * carried by the OfflineAvatar wrapper (§5.20).
 */
import { cn } from "@/lib/cn";

const RADIUS = 25;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export interface CountdownRingProps {
  /** Remaining fraction of the grace period, 0..1 (1 = full ring). */
  progress: number;
  className?: string;
}

export function CountdownRing({ progress, className }: CountdownRingProps) {
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
      <circle cx="28" cy="28" r={RADIUS} strokeWidth="3" className="stroke-felt-edge" />
      <circle
        cx="28"
        cy="28"
        r={RADIUS}
        strokeWidth="3"
        strokeLinecap="round"
        className="stroke-turn"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={dashOffset}
      />
    </svg>
  );
}
