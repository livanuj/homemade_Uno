import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/**
 * Small turn-colored tag that marks whose turn it is: "Your turn" in your row,
 * "Playing" under the active opponent or partner. `bg-turn` with
 * `text-suit-yellow-on` (the documented dark ink for text on yellow, which
 * passes contrast where white or the turn color on paper would not).
 */
export function TurnTag({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-turn px-2 py-0.5 text-micro font-extrabold text-suit-yellow-on",
        className,
      )}
    >
      {children}
    </span>
  );
}
