/**
 * OfflineAvatar — a disconnected player's seat marker (design.md §5.20, screen
 * `06c-player-disconnected`).
 *
 * A 56px wrapper around a 40px avatar faded to 55% opacity, with:
 * - a top-right 22px `bg-ink` offline badge holding a 13px `WifiOff` glyph in
 *   `surface`,
 * - the bottom-right real card-count badge (kept from the normal avatar),
 * - a `CountdownRing` (§5.20) rendered ONLY when it is this player's turn
 *   (`countdown` provided); otherwise the avatar is just faded with the badge.
 *
 * The wrapper is `role="img"` with an `aria-label` describing the offline state
 * (and, when counting down, the seconds until the turn is skipped) so the ring
 * — which is `aria-hidden` — is announced. Reuses `CountdownRing`
 * (reuse-before-create); tokens only (token-policy.md). Motion (the ring drain)
 * is wired in task 7.
 */
import { cn } from "@/lib/cn";
import { CountdownRing } from "./CountdownRing";

export interface OfflineAvatarProps {
  /** Player name; the first character is shown as the faded initial. */
  name: string;
  /** Remaining card count for the bottom-right badge. */
  cardCount?: number | undefined;
  /**
   * Grace countdown, present only while it is this player's turn (§5.20):
   * `progress` 0..1 drives the ring; `secondsLeft` feeds the accessible label.
   */
  countdown?: { progress: number; secondsLeft: number };
  className?: string;
}

function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

/** WifiOff glyph for the offline badge (13px stroke icon, §5.20). */
function WifiOffIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 2l20 20M8.5 16.4a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5.2-2.8M19 12.9a10 10 0 0 0-2.3-1.7M1.4 9a15 15 0 0 1 4.3-2.7M22.6 9A15 15 0 0 0 11 5M12 20h.01" />
    </svg>
  );
}

export function OfflineAvatar({
  name,
  cardCount,
  countdown,
  className,
}: OfflineAvatarProps) {
  const label = countdown
    ? `${name} is offline, ${countdown.secondsLeft} seconds until their turn is skipped`
    : `${name} is offline`;

  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        "relative inline-grid size-14 place-items-center",
        className,
      )}
    >
      {countdown && (
        <CountdownRing
          progress={countdown.progress}
          className="absolute inset-0"
        />
      )}
      {/* 40px faded avatar. */}
      <span className="grid size-10 place-items-center rounded-full bg-avatar font-sans text-label text-ink opacity-55">
        {initialOf(name)}
      </span>
      {/* Offline badge, top-right. */}
      <span
        aria-hidden="true"
        className="absolute right-0 top-0 grid size-[22px] place-items-center rounded-full bg-ink text-surface"
      >
        <WifiOffIcon />
      </span>
      {/* Real card-count badge, bottom-right. */}
      {cardCount !== undefined && (
        <span
          aria-hidden="true"
          className="absolute bottom-0 right-0 grid min-h-[22px] min-w-[22px] place-items-center rounded-full bg-ink px-1 font-display text-caption text-surface"
        >
          {cardCount}
        </span>
      )}
    </span>
  );
}
