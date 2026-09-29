import { cn } from "@/lib/cn";
import { useId } from "react";
import { Button } from "./Button";

/**
 * Start control with reason (design.md §5.14) — the host's "Start game" CTA
 * plus its reason caption.
 *
 * A centered column (`gap-2`): the primary `Button` (or its disabled
 * treatment, §5.4), then one caption line (`text-label font-semibold
 * text-ink-muted text-center`) whose `id` is referenced by the button's
 * `aria-describedby`. Captions in use (supplied by the lobby route):
 * "Everyone is ready" (enabled), "Invite at least 1 more player to start",
 * "2v2 needs exactly 4 players. N of 4 have joined." (disabled).
 *
 * Reuses the existing `Button` primitive (its documented disabled-primary
 * treatment) rather than restyling a CTA here.
 */
interface StartControlProps {
  /** Reason/status line under the button (read out via `aria-describedby`). */
  caption: string;
  /** Whether the start action is unavailable (constraints unmet). */
  disabled?: boolean;
  /** Fired when the host starts the game. */
  onStart: () => void;
  className?: string;
}

export function StartControl({
  caption,
  disabled = false,
  onStart,
  className,
}: StartControlProps) {
  const captionId = useId();

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <Button
        variant="primary"
        disabled={disabled}
        aria-describedby={captionId}
        onClick={onStart}
      >
        Start game
      </Button>
      <p
        id={captionId}
        className="text-center text-label font-semibold text-ink-muted"
      >
        {caption}
      </p>
    </div>
  );
}
