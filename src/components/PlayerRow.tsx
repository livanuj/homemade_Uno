import { cn } from "@/lib/cn";
import type { ReactNode } from "react";
import { Avatar, type AvatarRing } from "./Avatar";
import { HostBadge } from "./Chip";

/**
 * Player row (design.md §5.8 / §5.11) — one filled lobby seat.
 *
 * `min-h-[46px] rounded-row bg-paper px-2.5 py-1.5 flex items-center gap-2.5`
 * containing, in order: an optional left control (the §5.13 drag handle, host
 * only), a 36px `Avatar` with the seat's team/self ring, the name (`text-body
 * flex-1`), an optional `HostBadge`, and a ready check (18px, `suit-green-ink`).
 * Guests see the same row without the handle (`02f-lobby-guest`).
 *
 * Reuses the existing `Avatar` (size 36) and `HostBadge` primitives — nothing
 * is re-created here.
 */
interface PlayerRowProps {
  /** Player display name. */
  name: string;
  /** Avatar ring: `team-a`/`team-b` in 2v2, `ink` for the host / `ink-muted` in Normal (§5.11). */
  ring: AvatarRing;
  /** Whether this player is the host — shows the `HostBadge`. */
  host?: boolean;
  /** Whether this player is ready — shows the green check. */
  ready?: boolean;
  /** Optional leading control (a §5.13 `DragHandle`, host-only in 2v2). */
  rightSlot?: ReactNode;
  className?: string;
}

/** 18px ready check (design.md §5.8 references Lucide `Check`) in `suit-green-ink`. */
function ReadyCheck() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Ready"
      className="shrink-0 text-suit-green-ink"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function PlayerRow({
  name,
  ring,
  host = false,
  ready = false,
  rightSlot,
  className,
}: PlayerRowProps) {
  return (
    <div
      className={cn(
        "flex min-h-[46px] items-center gap-2.5 rounded-row bg-paper px-2.5 py-1.5",
        className,
      )}
    >
      {rightSlot}
      <Avatar name={name} size={36} ring={ring} />
      <span className="flex-1 text-body text-ink">{name}</span>
      {host && <HostBadge />}
      {ready && <ReadyCheck />}
    </div>
  );
}
