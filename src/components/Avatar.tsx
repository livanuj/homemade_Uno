/**
 * Avatar — a player circle with ring, initial, card-count badge, and turn
 * pulse (design.md §5.3).
 *
 * A circle with `avatar` fill and a 3px ring showing the player's initial.
 * Three sizes: 44 (game table), 40 (partner), 36 (lobby rows). The ring color
 * conveys team / self / active turn. The card-count badge shows the player's
 * REAL remaining-card count (Req 13.5) as a min 22×22 `bg-ink text-surface`
 * pill at the table-facing corner. When it is the player's turn, the avatar
 * gets `animate-turn-pulse`.
 *
 * Ring colors come from a static map (styling.md); every value is a token
 * (token-policy.md).
 */
import { cn } from "@/lib/cn";

export type AvatarSize = 44 | 40 | 36;
export type AvatarRing = "team-a" | "team-b" | "ink-muted" | "ink" | "turn";

/** Per-size circle box. */
const SIZE_BOX: Record<AvatarSize, string> = {
  44: "size-11",
  40: "size-10",
  36: "size-9",
};

/** Ring color → ring utility (3px ring, design.md §5.3). */
const RING_COLOR: Record<AvatarRing, string> = {
  "team-a": "ring-team-a",
  "team-b": "ring-team-b",
  "ink-muted": "ring-ink-muted",
  ink: "ring-ink",
  turn: "ring-turn",
};

export interface AvatarProps {
  /** Player name; the first character is shown as the initial. */
  name: string;
  /** Circle diameter in px (design.md §5.3). Defaults to 44 (game table). */
  size?: AvatarSize;
  /** Ring color. Defaults to `ink-muted` (neutral). */
  ring?: AvatarRing;
  /** Remaining card count; renders the real-count badge when provided (Req 13.5). */
  cardCount?: number;
  /** Whether it is this player's turn — applies `animate-turn-pulse`. */
  activeTurn?: boolean;
  className?: string;
}

function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export function Avatar({
  name,
  size = 44,
  ring = "ink-muted",
  cardCount,
  activeTurn = false,
  className,
}: AvatarProps) {
  return (
    <span className={cn("relative inline-grid place-items-center", className)}>
      <span
        className={cn(
          "grid place-items-center rounded-full bg-avatar font-sans text-label text-ink ring-3",
          SIZE_BOX[size],
          RING_COLOR[ring],
          activeTurn && "animate-turn-pulse",
        )}
      >
        {initialOf(name)}
      </span>
      {cardCount !== undefined && (
        <span
          className="absolute -bottom-2 grid min-h-[22px] min-w-[22px] place-items-center rounded-full bg-ink px-1 font-display text-caption text-surface"
          aria-hidden="true"
        >
          {cardCount}
        </span>
      )}
    </span>
  );
}
