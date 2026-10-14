/**
 * WildColorButtons — the four color choices for a played wild (design.md §5.16,
 * screen `06a-wild-color-picker`).
 *
 * One row of four buttons on the table, just above the hand (so the hand stays
 * visible while choosing), each `h-14 rounded-section border-3 border-surface
 * shadow-card` filled with the suit color, showing the suit SHAPE over the
 * color name; `compact` (a phone on its side) is a shorter `h-10` row with the
 * shape beside the name. Text is `surface` except on yellow, which uses
 * `suit-yellow-on` for contrast. Order: Red, Yellow, Green, Blue. The `aria-label` is the color name. There is NO cancel option
 * (§5.16) — the only way out is to pick a color.
 *
 * Suit → class lookups use the shared static maps in `src/design/suits.ts`
 * (styling.md — whole class names, no interpolation); tokens only
 * (token-policy.md). Reuses `Suit` / `SUIT_*` (reuse-before-create).
 */
import { cn } from "@/lib/cn";
import {
  SUIT_FILL,
  SUIT_NAME,
  SUIT_ON_FILL,
  SUIT_SHAPE,
  type Suit,
} from "@/design/suits";

/** Order per §5.16: Red, Yellow, Green, Blue. */
const PICKER_ORDER: readonly Suit[] = ["red", "yellow", "green", "blue"] as const;

export interface WildColorButtonsProps {
  /** Fired with the chosen suit when a color is picked. */
  onSelect: (suit: Suit) => void;
  /** Shorter row for a phone on its side. */
  compact?: boolean;
  className?: string;
}

export function WildColorButtons({
  onSelect,
  compact = false,
  className,
}: WildColorButtonsProps) {
  return (
    <div className={cn("grid grid-cols-4 gap-2", className)}>
      {PICKER_ORDER.map((suit) => (
        <button
          key={suit}
          type="button"
          aria-label={SUIT_NAME[suit]}
          onClick={() => onSelect(suit)}
          className={cn(
            "flex items-center justify-center rounded-section border-3 border-surface shadow-card",
            compact ? "h-10 flex-row gap-1.5" : "h-14 flex-col gap-0.5",
            SUIT_FILL[suit],
            SUIT_ON_FILL[suit],
          )}
        >
          <span aria-hidden="true" className="text-label leading-none">
            {SUIT_SHAPE[suit]}
          </span>
          <span className="text-body font-extrabold">{SUIT_NAME[suit]}</span>
        </button>
      ))}
    </div>
  );
}
