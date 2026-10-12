/**
 * Confetti — celebratory suit shapes on the game-over screen (design.md §5.25,
 * screen `07-game-over`).
 *
 * About 12 suit glyphs (●▲■◆) at 19–28px in the four suit colors, scattered
 * over the top ~300px at random rotations.
 *
 * Motion (Task 7.2, §5.25): the pieces burst in once when the screen opens —
 * each scales 0 → 1 from a small upward offset over 900ms (`confettiBurst`),
 * lightly staggered. Reduced motion (Req 17.6): the burst is skipped entirely
 * and the pieces render statically at their final scattered positions (no
 * animation) — the reduced path is the plain static markup.
 *
 * The scatter is a fixed, deterministic layout table (no runtime randomness, so
 * it renders identically for the Playwright baseline). Shapes cycle through the
 * four `SUIT_SHAPE` glyphs and `SUIT_TEXT` colors from the shared suit maps
 * (styling.md — static class strings; token-policy.md — tokens only). The whole
 * layer is `aria-hidden` since it is purely decorative (Requirement 18).
 */
import { confettiBurst } from "@/design/motion";
import { SUITS, SUIT_SHAPE } from "@/design/suits";
import { cn } from "@/lib/cn";
import { motion } from "motion/react";

/** Suit → glyph text color (tokens only). */
const SUIT_TEXT: Record<(typeof SUITS)[number], string> = {
  red: "text-suit-red",
  yellow: "text-suit-yellow",
  green: "text-suit-green",
  blue: "text-suit-blue",
};

/** Deterministic scatter: left %, top px, font-size px, rotation deg. */
const PIECES: readonly {
  left: number;
  top: number;
  size: number;
  rot: number;
}[] = [
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
  /**
   * Render statically with no burst under reduced motion (Req 17.6) — pass from
   * `usePrefersReducedMotion()`.
   */
  reduced?: boolean;
  className?: string;
}

export function Confetti({ reduced = false, className }: ConfettiProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 h-[300px]",
        className,
      )}
    >
      {PIECES.map((piece, i) => {
        const suit = SUITS[i % SUITS.length];
        const position = {
          left: `${piece.left}%`,
          top: `${piece.top}px`,
          fontSize: `${piece.size}px`,
        } as const;

        // Reduced motion: static glyph at its final position, no burst
        // (Req 17.6 / §5.25).
        if (reduced) {
          return (
            <span
              key={i}
              className={cn("absolute leading-none", SUIT_TEXT[suit])}
              style={{ ...position, transform: `rotate(${piece.rot}deg)` }}
            >
              {SUIT_SHAPE[suit]}
            </span>
          );
        }

        return (
          <motion.span
            key={i}
            className={cn("absolute leading-none", SUIT_TEXT[suit])}
            // Motion drives scale/y for the burst; the settled scatter angle is
            // kept via `rotate` in the style so pieces land at their design angle.
            style={{ ...position, rotate: `${piece.rot}deg` }}
            variants={confettiBurst}
            initial="hidden"
            animate="burst"
            // Light per-piece stagger for one cohesive burst (§5.25).
            transition={{ delay: i * 0.03 }}
          >
            {SUIT_SHAPE[suit]}
          </motion.span>
        );
      })}
    </div>
  );
}
