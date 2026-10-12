import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

interface InfoNoteProps {
  children: ReactNode;
  className?: string;
}

/**
 * Info note (design.md §5.22) — a muted note explaining why something is
 * unavailable, e.g. "2v2 needs exactly 4 players. It unlocks if the room gets
 * back to 4." shown under the disabled "Play 2v2" option (§5.9).
 *
 * `bg-paper rounded-row px-3 py-2.5 flex gap-2 text-label font-semibold text-ink`
 * with a 16px `Info` glyph in `ink-muted`.
 */
export function InfoNote({ children, className }: InfoNoteProps) {
  return (
    <div
      className={cn(
        "flex gap-2 rounded-row bg-paper px-3 py-2.5 text-label font-semibold text-ink",
        className,
      )}
    >
      <InfoIcon />
      <span>{children}</span>
    </div>
  );
}

/**
 * 16px Info glyph (design.md §5.22 references Lucide `Info`) in `ink-muted`.
 * Inlined as a 2px-stroke SVG so no icon dependency is required.
 */
function InfoIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="mt-0.5 shrink-0 text-ink-muted"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}
