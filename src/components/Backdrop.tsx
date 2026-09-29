/**
 * Backdrop — the shared scrim behind overlays (design.md §5.10, §5.15, §5.18).
 *
 * A fixed, full-viewport `bg-ink/50` layer (token-policy.md — the documented
 * overlay is `ink` at 50%). It sits behind a drawer, bottom sheet, or dialog
 * and, when `onActivate` is provided, closes the overlay on tap.
 *
 * The backdrop is a real `<button>` when interactive so tap-to-close is
 * keyboard-operable and carries an accessible name (Requirement 18); when
 * `onActivate` is omitted it renders as an inert `aria-hidden` layer.
 *
 * The backdrop-fade motion (Task 7.2) lives in {@link "./MotionBackdrop"},
 * which reuses {@link BACKDROP_BASE} so the animated and static scrims share
 * one class. This component stays static; `className` is the seam.
 */
import { cn } from "@/lib/cn";

export interface BackdropProps {
  /** Fired when the backdrop is tapped / activated (tap-to-close). */
  onActivate?: (() => void) | undefined;
  /** Accessible name for the interactive backdrop. Defaults to "Close". */
  label?: string;
  className?: string;
}

/** Shared base classes so the static and animated (MotionBackdrop) scrims agree. */
export const BACKDROP_BASE = "fixed inset-0 bg-ink/50";

export function Backdrop({
  onActivate,
  label = "Close",
  className,
}: BackdropProps) {
  if (onActivate) {
    return (
      <button
        type="button"
        aria-label={label}
        onClick={onActivate}
        className={cn(BACKDROP_BASE, "cursor-default", className)}
      />
    );
  }

  return <div aria-hidden="true" className={cn(BACKDROP_BASE, className)} />;
}
