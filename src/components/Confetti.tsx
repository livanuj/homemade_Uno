/**
 * Confetti — celebratory suit shapes on the game-over screen (design.md §5.25,
 * screen `07-game-over`).
 *
 * About 12 suit glyphs (●▲■◆) at 19–28px in the four suit colors, scattered
 * over the top ~300px at random rotations. Per the design they burst in once
 * when the screen opens and are static under reduced motion; the burst
 * animation is added in task 7, so here they render statically at their final
 * scattered positions.
 *
 * The scatter is a fixed, deterministic layout table (no runtime randomness, so
 * it renders identically for the Playwright baseline). Shapes cycle through the
 * four `SUIT_SHAPE` glyphs and `SUIT_TEXT` colors from the shared suit maps
 * (styling.md — static class strings; token-policy.md — tokens only). The whole
 * layer is `aria-hidden` since it is purely decorative (Requirement 18).
 */
import { cn } from "@/lib/cn";
import { SUITS, SUIT_SHAPE } from "@/design/suits";

/** Suit → glyph text color (tokens only). */
const SUIT_TEXT: Record<(typeof SUITS)[number], string> = {
  red: "text-suit-red",
  yellow: "text-suit-yellow",
  green: "text-suit-green",
  blue: "text-suit-blue",
};

/** Deterministic scatter: left %, top px, font-size px, rotation deg. */
const PIECES: readonly { left: number; top: number; size: number; rot: number }[] = [
  { left: 8, top: 24, size: 24, rot: -18 },
  { left: 22, top: 60, size: 20, rot: 12 },
  { left: 38, top: 18, size: 28, rot: -8 },
  { left: 54, top: 72, size: 19, rot: 22 },
  { left: 70, top: 30, size: 26, rot: -14 },
  { left: 86, top: 66, size: 21, rot: 16 },
  { left: 14, top: 150, size: 22, rot: 8 },
  { left: 32, top: 200, size: 27, rot: -20 },
  { left: 50, top: 168, size: 20, rot: 14 },
  { left: 66, top: 210, size: 25, rot: -10 },
  { left: 80, top: 150, size: 23, rot: 18 },
  { left: 46, top: 250, size: 24, rot: -6 },
];

export interface ConfettiProps {
  className?: string;
}

export function Confetti({ className }: ConfettiProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-x-0 top-0 h-[300px]", className)}
    >
      {PIECES.map((piece, i) => {
        const suit = SUITS[i % SUITS.length];
        return (
          <span
            key={i}
            className={cn("absolute leading-none", SUIT_TEXT[suit])}
            style={{
              left: `${piece.left}%`,
              top: `${piece.top}px`,
              fontSize: `${piece.size}px`,
              transform: `rotate(${piece.rot}deg)`,
            }}
          >
            {SUIT_SHAPE[suit]}
          </span>
        );
      })}
    </div>
  );
}
