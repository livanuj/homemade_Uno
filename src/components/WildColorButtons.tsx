/**
 * WildColorButtons — the four color choices for a played wild (design.md §5.16,
 * screen `06a-wild-color-picker`).
 *
 * A `grid grid-cols-2 gap-3` of four large buttons, each `h-24 rounded-section
 * border-3 border-surface shadow-card flex flex-col items-center justify-center
 * gap-1.5` filled with the suit color. Each shows the suit SHAPE (22px) over
 * the color name (`text-input font-extrabold`); text is `surface` except on
 * yellow, which uses `suit-yellow-on` for contrast. Order: Red, Yellow /
 * Green, Blue. The `aria-label` is the color name. There is NO cancel option
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

/** Grid order per §5.16: Red, Yellow / Green, Blue. */
const PICKER_ORDER: readonly Suit[] = ["red", "yellow", "green", "blue"] as const;

export interface WildColorButtonsProps {
  /** Fired with the chosen suit when a color is picked. */
  onSelect: (suit: Suit) => void;
  className?: string;
}

export function WildColorButtons({ onSelect, className }: WildColorButtonsProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      {PICKER_ORDER.map((suit) => (
        <button
          key={suit}
          type="button"
          aria-label={SUIT_NAME[suit]}
          onClick={() => onSelect(suit)}
          className={cn(
            "flex h-24 flex-col items-center justify-center gap-1.5 rounded-section border-3 border-surface shadow-card",
            SUIT_FILL[suit],
            SUIT_ON_FILL[suit],
          )}
        >
          <span aria-hidden="true" className="text-[22px] leading-none">
            {SUIT_SHAPE[suit]}
          </span>
          <span className="text-input font-extrabold">{SUIT_NAME[suit]}</span>
        </button>
      ))}
    </div>
  );
}
