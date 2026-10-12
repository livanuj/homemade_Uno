/**
 * PlayingCard — a face-up Uno card (design.md §5.1).
 *
 * Every card is a real `<button type="button">` with an accessible label such
 * as "Red 7", "Blue skip", "Wild draw four" (Req 18.2). A distinct geometric
 * suit shape is drawn at ALL sizes so a card is never identified by color
 * alone (Req 18.3). Wild / Wild+4 render as a 2×2 grid of the four suit colors
 * on a `card-back-deep` base with a surface oval in the middle (+4 text on
 * wild4).
 *
 * Styling: suit → class lookups use STATIC maps (styling.md, `src/design/
 * suits.ts`); classes merge via `cn()`. Tokens only — no hex or arbitrary
 * values (token-policy.md / design-fidelity.md).
 */
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import {
  cardAriaLabel,
  isWild,
  SUIT_FILL,
  SUIT_INK,
  SUIT_ON_FILL,
  SUIT_SHAPE,
  valueGlyph,
  WILD_QUADRANT_FILL,
  type CardValue,
  type Suit,
} from "@/design/suits";

export type CardVariant = "hero" | "pile" | "hand" | "partner";

type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "value" | "aria-pressed"
>;

export interface PlayingCardProps extends NativeButtonProps {
  /** Suit — omitted for wild / wild4. */
  suit?: Suit;
  /** Card value or symbol. */
  value: CardValue;
  /** Size / context variant (design.md §5.1). Defaults to `hand`. */
  variant?: CardVariant;
  /** Selected (raised) state — reflected as `aria-pressed`. */
  selected?: boolean;
  /** Not-playable dimming (only when "Highlight playable cards" is on). */
  dim?: boolean;
}

/** Per-variant geometry (size, border, numeral, corner visibility). */
const VARIANT_BOX: Record<CardVariant, string> = {
  hero: "w-[84px] h-[124px] border-4 rounded-card-lg",
  pile: "w-[74px] h-[108px] border-3 rounded-card",
  hand: "w-[70px] h-[104px] border-3 rounded-card",
  partner: "w-[46px] h-[68px] border-2 rounded-card-sm",
};

/** Center circle size per variant. */
const VARIANT_CIRCLE: Record<CardVariant, string> = {
  hero: "size-12",
  pile: "size-[42px]",
  hand: "size-10",
  partner: "size-7",
};

/** Center numeral type token per variant. */
const VARIANT_NUMERAL: Record<CardVariant, string> = {
  hero: "text-card",
  pile: "text-card-lg",
  hand: "text-card",
  partner: "text-card-corner",
};

/** Partner cards are too small for corner indices (design.md §5.1). */
function showsCorners(variant: CardVariant): boolean {
  return variant !== "partner";
}

export function PlayingCard({
  suit,
  value,
  variant = "hand",
  selected = false,
  dim = false,
  className,
  ...rest
}: PlayingCardProps) {
  const label = cardAriaLabel(value, suit);

  const base = cn(
    "relative grid place-items-center border-surface shadow-card select-none",
    VARIANT_BOX[variant],
    dim && "brightness-55",
    selected && "shadow-card-lifted",
    className,
  );

  if (isWild(value)) {
    return (
      <button
        type="button"
        aria-label={label}
        aria-pressed={selected}
        className={cn(base, "overflow-hidden bg-card-back-deep p-1.5")}
        {...rest}
      >
        {/* 2×2 suit-color grid: red TL, yellow TR, blue BL, green BR. */}
        <span className="absolute inset-1.5 grid grid-cols-2 grid-rows-2 gap-0.5 rounded-card-sm">
          {WILD_QUADRANT_FILL.map((fill, i) => (
            <span
              key={i}
              className={cn("h-full w-full rounded-card-back", fill)}
            />
          ))}
        </span>
        {/* Surface oval in the middle; +4 text on wild4, empty on plain wild. */}
        <span
          className={cn(
            "relative z-10 grid place-items-center rounded-full bg-surface font-display text-ink",
            VARIANT_CIRCLE[variant],
            VARIANT_NUMERAL[variant],
          )}
        >
          {valueGlyph(value)}
        </span>
      </button>
    );
  }

  // Suited card. `suit` is required for a non-wild face; guard defensively.
  const resolvedSuit: Suit = suit ?? "red";
  const glyph = valueGlyph(value);

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      className={cn(base, SUIT_FILL[resolvedSuit])}
      {...rest}
    >
      {showsCorners(variant) && (
        <span
          className={cn(
            "absolute left-[7px] top-1 font-display text-card-corner",
            SUIT_ON_FILL[resolvedSuit],
          )}
          aria-hidden="true"
        >
          {glyph}
        </span>
      )}
      {/* Distinct suit SHAPE — present at every size (Req 18.3). */}
      <span
        className={cn(
          "absolute bottom-1 right-[7px] text-label leading-none",
          SUIT_ON_FILL[resolvedSuit],
        )}
        aria-hidden="true"
      >
        {SUIT_SHAPE[resolvedSuit]}
      </span>
      <span
        className={cn(
          "grid place-items-center rounded-full bg-surface font-display",
          VARIANT_CIRCLE[variant],
          VARIANT_NUMERAL[variant],
          SUIT_INK[resolvedSuit],
        )}
        aria-hidden="true"
      >
        {glyph}
      </span>
    </button>
  );
}
