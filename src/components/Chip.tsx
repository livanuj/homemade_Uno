import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/**
 * Chip variants (design.md §5.5).
 *
 * - `info`    — filled `bg-surface` pill for "ROOM · K7QX".
 * - `outline` — `border-line` outlined pill for "2v2 · Round 1" / "Normal · 5 players".
 */
export type ChipVariant = "info" | "outline";

const CHIP_CLASS: Record<ChipVariant, string> = {
  info: "px-3.5 py-2.5 rounded-full bg-surface text-label tracking-[0.08em] text-ink",
  outline:
    "px-3.5 py-2.5 rounded-full border border-line text-label text-ink-muted",
};

interface ChipProps {
  variant?: ChipVariant;
  children: ReactNode;
  className?: string;
}

/**
 * Small status chip (design.md §5.5). A non-interactive label pill in either
 * the filled `info` or outlined `outline` treatment.
 */
export function Chip({ variant = "info", children, className }: ChipProps) {
  return (
    <span className={cn("inline-flex items-center", CHIP_CLASS[variant], className)}>
      {children}
    </span>
  );
}

interface HostBadgeProps {
  children?: ReactNode;
  className?: string;
}

/**
 * Host badge (design.md §5.5) — `bg-ink text-surface` micro pill shown next to
 * the host's name in the lobby. Defaults to the text "Host".
 */
export function HostBadge({ children = "Host", className }: HostBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-ink px-2 py-0.5 text-micro font-bold text-surface",
        className,
      )}
    >
      {children}
    </span>
  );
}
