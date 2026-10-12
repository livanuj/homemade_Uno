/**
 * MotionBackdrop — the backdrop scrim with the backdrop-fade motion (Task 7.2,
 * design.md §9). The scrim fades in as an overlay mounts and back out as it
 * unmounts (Req 17.5), paired with a drawer / bottom sheet / dialog / pause
 * overlay.
 *
 * It renders the SAME element the static {@link Backdrop} does — an interactive
 * `<button>` when `onActivate` is given (keyboard-operable tap-to-close with an
 * accessible name, Req 18), or an inert `aria-hidden` layer otherwise — reusing
 * `BACKDROP_BASE` so the two never drift. The only addition is the opacity
 * fade, so no extra stacking layer and no aria change.
 *
 * Reduced motion (Req 17.6): the fade becomes instant, matching theme.css's
 * reduced-motion neutralization. The `bg-ink/50` token encodes the 50% target,
 * so the wrapper animates `opacity` 0 → 1 (fully applying that token).
 *
 * Timing lives implicitly with the paired overlay's 250ms entrance
 * (animation.md — presets centralized in `src/design/motion.ts`).
 */
import { instant } from "@/design/motion";
import { cn } from "@/lib/cn";
import { motion } from "motion/react";
import { BACKDROP_BASE, type BackdropProps } from "./Backdrop";

export interface MotionBackdropProps extends BackdropProps {
  /** Honor reduced motion (Req 17.6) — pass from `usePrefersReducedMotion()`. */
  reduced?: boolean;
}

export function MotionBackdrop({
  onActivate,
  label = "Close",
  reduced = false,
  className,
}: MotionBackdropProps) {
  const fade = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: reduced ? instant : { duration: 0.25 },
  } as const;

  if (onActivate) {
    return (
      <motion.button
        type="button"
        aria-label={label}
        onClick={onActivate}
        className={cn(BACKDROP_BASE, "cursor-default", className)}
        {...fade}
      />
    );
  }

  return (
    <motion.div
      aria-hidden="true"
      className={cn(BACKDROP_BASE, className)}
      {...fade}
    />
  );
}
