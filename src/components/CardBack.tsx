/**
 * CardBack — a face-down Uno card (design.md §5.2).
 *
 * A `card-back` fill with a surface border and a centered quadrant emblem: a
 * small circle split into four suit-colored quadrants at 45% of the card
 * width. Three variants: the draw pile (a tappable stack of three offset
 * backs, one `<button aria-label="Draw a card">`), a side-seat back, and a
 * smaller top-seat back.
 *
 * Tokens only — suit fills come from the static `WILD_QUADRANT_FILL` map, sizes
 * and colors from theme.css (token-policy.md / styling.md).
 */
import { WILD_QUADRANT_FILL } from "@/design/suits";
import { cn } from "@/lib/cn";
import type { CSSProperties } from "react";

export type CardBackVariant = "draw-pile" | "side-seat" | "top-seat";

/** Per-variant card box (size + border + radius). */
const VARIANT_BOX: Record<CardBackVariant, string> = {
  "draw-pile": "w-[70px] h-[104px] border-3 rounded-card",
  "side-seat": "w-10 h-[58px] border-2 rounded-card-back",
  "top-seat": "w-[34px] h-[50px] border-2 rounded-card-back",
};

/** Emblem diameter per variant (≈45% of card width, design.md §5.2). */
const VARIANT_EMBLEM: Record<CardBackVariant, string> = {
  "draw-pile": "size-[30px]",
  "side-seat": "size-[18px]",
  "top-seat": "size-[15px]",
};

/** The four-quadrant emblem drawn on a face-down card. */
function QuadrantEmblem({ variant }: { variant: CardBackVariant }) {
  return (
    <span
      className={cn(
        "grid grid-cols-2 grid-rows-2 overflow-hidden rounded-full",
        VARIANT_EMBLEM[variant],
      )}
      aria-hidden="true"
    >
      {WILD_QUADRANT_FILL.map((fill, i) => (
        <span key={i} className={cn("h-full w-full", fill)} />
      ))}
    </span>
  );
}

export interface CardBackProps {
  variant?: CardBackVariant;
  className?: string;
  /** Overrides the default label ("Draw a card" / "Face-down card"). */
  "aria-label"?: string;
  /** Click handler — only meaningful for the tappable draw-pile variant. */
  onClick?: () => void;
  /** Inline style — e.g. CSS vars driving a decorative fan transform. */
  style?: CSSProperties;
}

export function CardBack({
  variant = "side-seat",
  className,
  "aria-label": ariaLabel,
  onClick,
  style,
}: CardBackProps) {
  const box = cn(
    "grid place-items-center border-surface bg-card-back",
    VARIANT_BOX[variant],
  );

  if (variant === "draw-pile") {
    return (
      <button
        type="button"
        aria-label={ariaLabel ?? "Draw a card"}
        className={cn(
          "relative shadow-card",
          VARIANT_BOX["draw-pile"],
          className,
        )}
        style={style}
        onClick={onClick}
      >
        {/* Three stacked backs offset by 0, 2, 4px; lower two are deeper. */}
        <span
          className={cn(
            "absolute left-1 top-1 border-surface bg-card-back-deep",
            VARIANT_BOX["draw-pile"],
          )}
          aria-hidden="true"
        />
        <span
          className={cn(
            "absolute left-0.5 top-0.5 border-surface bg-card-back-deep",
            VARIANT_BOX["draw-pile"],
          )}
          aria-hidden="true"
        />
        <span className={cn("absolute inset-0", box)} aria-hidden="true">
          <QuadrantEmblem variant="draw-pile" />
        </span>
      </button>
    );
  }

  return (
    <div
      role="img"
      aria-label={ariaLabel ?? "Face-down card"}
      className={cn(box, "shadow-card", className)}
      style={style}
    >
      <QuadrantEmblem variant={variant} />
    </div>
  );
}
