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
 * Reuses `PlayingCard` (reuse-before-create). Tokens only (token-policy.md).
 *
 * Motion (Task 7.2): on mount the card scales 0.9 → 1.25 (`spotlightScale`,
 * the sheet's spring) as the bottom sheet slides up (Req 17.9). The `1.25`
 * final scale matches the design's enlarged drawn card; the Motion `scale`
 * replaces the former static `scale-125` utility so both live under one
 * preset. Reduced motion (Req 17.6): the card renders at its final `1.25`
 * scale with no scale-in.
 */
import { instant, spotlightScale } from "@/design/motion";
import type { CardValue, Suit } from "@/design/suits";
import { cn } from "@/lib/cn";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { PlayingCard } from "./PlayingCard";

export interface SpotlightCardProps {
  /** Suit of the drawn card (omitted for wild / wild4). */
  suit?: Suit | undefined;
  /** Value of the drawn card. */
  value: CardValue;
  /** Caption shown in the pill above the card. Defaults to "You drew". */
  caption?: ReactNode;
  /** Honor reduced motion (Req 17.6) — pass from `usePrefersReducedMotion()`. */
  reduced?: boolean;
  className?: string;
}

export function SpotlightCard({
  suit,
  value,
  caption = "You drew",
  reduced = false,
  className,
}: SpotlightCardProps) {
  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <span className="inline-flex items-center rounded-full bg-surface px-3 py-1 text-label text-ink shadow-cta">
        {caption}
      </span>
      <motion.div
        variants={spotlightScale}
        initial={reduced ? false : "hidden"}
        animate="visible"
        {...(reduced ? { transition: instant } : {})}
        className="drop-shadow-[0_12px_24px_rgba(40,30,40,0.35)]"
      >
        <PlayingCard
          {...(suit ? { suit } : {})}
          value={value}
          variant="hero"
          disabled
          aria-hidden="true"
          tabIndex={-1}
        />
      </motion.div>
    </div>
  );
}
