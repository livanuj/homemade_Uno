/**
 * SpotlightCard — an enlarged drawn card (design.md §5.17, screen
 * `06b-drew-playable-card`).
 *
 * Shows a freshly drawn card above the "drew a playable card" sheet: the
 * `hero` PlayingCard variant (84×124, §5.1) at `scale-125` with a soft drop
 * shadow, under a small `bg-surface` pill reading "You drew" (the caption is
 * overridable). The card is presentational here, so the underlying
 * PlayingCard button is disabled and marked `aria-hidden` — the actionable
 * choices ("Play it" / "Keep it") live in the sheet below.
 *
 * Reuses `PlayingCard` (reuse-before-create). Tokens only (token-policy.md);
 * the `scale-125` transform is a Tailwind utility, not an animation, so no
 * motion import is needed. `className` is the seam for the task-7 spotlight
 * scale-in.
 */
import type { CardValue, Suit } from "@/design/suits";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";
import { PlayingCard } from "./PlayingCard";

export interface SpotlightCardProps {
  /** Suit of the drawn card (omitted for wild / wild4). */
  suit?: Suit | undefined;
  /** Value of the drawn card. */
  value: CardValue;
  /** Caption shown in the pill above the card. Defaults to "You drew". */
  caption?: ReactNode;
  className?: string;
}

export function SpotlightCard({
  suit,
  value,
  caption = "You drew",
  className,
}: SpotlightCardProps) {
  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <span className="inline-flex items-center rounded-full bg-surface px-3 py-1 text-label text-ink shadow-cta">
        {caption}
      </span>
      <PlayingCard
        {...(suit ? { suit } : {})}
        value={value}
        variant="hero"
        disabled
        aria-hidden="true"
        tabIndex={-1}
        className="scale-125 drop-shadow-[0_12px_24px_rgba(40,30,40,0.35)]"
      />
    </div>
  );
}
