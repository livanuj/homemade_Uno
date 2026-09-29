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
 * Motion (backdrop fade) is wired in task 7; this component stays static and
 * accepts `className` as the seam for those animation classes.
 */
import { cn } from "@/lib/cn";

export interface BackdropProps {
  /** Fired when the backdrop is tapped / activated (tap-to-close). */
  onActivate?: (() => void) | undefined;
  /** Accessible name for the interactive backdrop. Defaults to "Close". */
  label?: string;
  className?: string;
}

export function Backdrop({
  onActivate,
  label = "Close",
  className,
}: BackdropProps) {
  const base = "fixed inset-0 bg-ink/50";

  if (onActivate) {
    return (
      <button
        type="button"
        aria-label={label}
        onClick={onActivate}
        className={cn(base, "cursor-default", className)}
      />
    );
  }

  return <div aria-hidden="true" className={cn(base, className)} />;
}
