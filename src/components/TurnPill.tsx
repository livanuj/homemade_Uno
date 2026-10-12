import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/**
 * The four card suits plus a neutral `turn` state used for the pill dot color
 * (design.md §5.5). When it is someone else's turn the dot uses `turn`; on your
 * turn it uses the current active color.
 */
export type TurnPillTone = "red" | "yellow" | "green" | "blue" | "turn";

/**
 * Static suit → dot-fill class map (styling.md — no interpolated class names).
 * Uses the suit fill tokens and the `turn` token from theme.css.
 */
const DOT_CLASS: Record<TurnPillTone, string> = {
  red: "bg-suit-red",
  yellow: "bg-suit-yellow",
  green: "bg-suit-green",
  blue: "bg-suit-blue",
  turn: "bg-turn",
};

interface TurnPillProps {
  /** Dot color: the current suit, or `turn` when it's another player's turn. */
  tone: TurnPillTone;
  children: ReactNode;
  className?: string;
}

/**
 * Turn pill (design.md §5.5) — a `bg-surface` pill with a 12px suit-colored dot
 * and a status message such as "Your turn · match red or play a wild".
 */
export function TurnPill({ tone, children, className }: TurnPillProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full bg-surface px-3.5 py-2 text-label text-ink",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-3 rounded-full", DOT_CLASS[tone])}
      />
      <span>{children}</span>
    </div>
  );
}
