import { cn } from "@/lib/cn";

/**
 * Empty slot (design.md §5.12) — a dashed placeholder the same size as a
 * `PlayerRow`, used for an unfilled team seat or an empty lobby list.
 *
 * `min-h-[46px] rounded-row border-2 border-dashed border-line px-2.5` with a
 * 36px dashed circle and muted text (`text-body font-semibold text-ink-muted`).
 * Messages: "Waiting for a player" (2v2) and "Share the link to invite
 * friends" (lobby with only the host) — passed in via `message`.
 */
interface EmptySlotProps {
  /** The muted prompt shown in the slot (e.g. "Waiting for a player"). */
  message: string;
  className?: string;
}

export function EmptySlot({ message, className }: EmptySlotProps) {
  return (
    <div
      className={cn(
        "flex min-h-[46px] items-center gap-2.5 rounded-row border-2 border-dashed border-line px-2.5",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="size-9 shrink-0 rounded-full border-2 border-dashed border-line"
      />
      <span className="text-body font-semibold text-ink-muted">{message}</span>
    </div>
  );
}
