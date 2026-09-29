/**
 * Suit → token-class maps and card-value helpers, shared by the card
 * primitives (PlayingCard, CardBack) and reusable by later components.
 *
 * These are STATIC maps of complete Tailwind class strings (styling.md): the
 * compiler must see whole class names, so there is no `bg-suit-${suit}`
 * interpolation anywhere. Every value traces to a token in
 * `design/uno-design/theme.css` (token-policy.md) — no hex/arbitrary values.
 */

/** The four Uno suits (design.md §5.1). */
export type Suit = "red" | "yellow" | "green" | "blue";

/** Playable card values / symbols (design.md §5.1). */
export type CardValue =
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | "+2"
  | "skip"
  | "reverse"
  | "wild"
  | "wild4";

export const SUITS: readonly Suit[] = ["red", "yellow", "green", "blue"] as const;

/**
 * Distinct geometric glyph per suit so a card is never identified by color
 * alone (Req 18.3 — accessibility). Red ●, yellow ▲, green ■, blue ◆.
 */
export const SUIT_SHAPE: Record<Suit, string> = {
  red: "●",
  yellow: "▲",
  green: "■",
  blue: "◆",
};

/** Human-readable suit name for aria-labels ("Red 7"). */
export const SUIT_NAME: Record<Suit, string> = {
  red: "Red",
  yellow: "Yellow",
  green: "Green",
  blue: "Blue",
};

/** Card face fill — the suit color background (token classes only). */
export const SUIT_FILL: Record<Suit, string> = {
  red: "bg-suit-red",
  yellow: "bg-suit-yellow",
  green: "bg-suit-green",
  blue: "bg-suit-blue",
};

/** Center-numeral ink color, tuned for contrast on the surface circle. */
export const SUIT_INK: Record<Suit, string> = {
  red: "text-suit-red-ink",
  yellow: "text-suit-yellow-ink",
  green: "text-suit-green-ink",
  blue: "text-suit-blue-ink",
};

/**
 * Corner index / shape text color drawn directly on the suit fill. White works
 * on every suit except yellow, where white fails contrast, so yellow uses the
 * dedicated `suit-yellow-on` token (theme.css).
 */
export const SUIT_ON_FILL: Record<Suit, string> = {
  red: "text-surface",
  yellow: "text-suit-yellow-on",
  green: "text-surface",
  blue: "text-surface",
};

/**
 * The four wild-grid quadrant fills in reading order:
 * red top-left, yellow top-right, blue bottom-left, green bottom-right
 * (design.md §5.1).
 */
export const WILD_QUADRANT_FILL: readonly string[] = [
  "bg-suit-red",
  "bg-suit-yellow",
  "bg-suit-blue",
  "bg-suit-green",
] as const;

/** Whether a value renders as the wild 2×2 grid rather than a suited face. */
export function isWild(value: CardValue): value is "wild" | "wild4" {
  return value === "wild" || value === "wild4";
}

/** The short glyph shown in a card corner / center for a value. */
export function valueGlyph(value: CardValue): string {
  switch (value) {
    case "+2":
      return "+2";
    case "skip":
      return "⊘";
    case "reverse":
      return "⇄";
    case "wild":
      return "";
    case "wild4":
      return "+4";
    default:
      return String(value);
  }
}

/**
 * Accessible label for a card (Req 18.2 / 18.3), e.g. "Red 7", "Blue skip",
 * "Yellow draw two", "Wild", "Wild draw four".
 */
export function cardAriaLabel(value: CardValue, suit?: Suit): string {
  if (value === "wild") return "Wild";
  if (value === "wild4") return "Wild draw four";
  const suffix =
    value === "+2"
      ? "draw two"
      : value === "skip"
        ? "skip"
        : value === "reverse"
          ? "reverse"
          : String(value);
  const prefix = suit ? SUIT_NAME[suit] : "";
  return prefix ? `${prefix} ${suffix}` : suffix;
}
