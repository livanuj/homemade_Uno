import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

/**
 * Drag handle (design.md §5.13) — the six-dot grip used on 2v2 lobby rows,
 * host only. It is a real `<button>` (styling.md — interactive elements are
 * native elements) carrying an `aria-label` so it has a keyboard/tap
 * alternative to dragging (Req 21.6): tapping or pressing Enter moves the
 * player to the other team (swapping if that team is full). The actual
 * pointer drag-and-drop wiring is task 9.2 — here we ship the accessible
 * control plus the reusable drag-state classNames below.
 *
 * The grip is a 14×20 area of 2 columns × 3 rows of 3.6px `ink-muted` dots.
 * The grip color follows the row state (default `ink-muted`, `ink` while a row
 * is lifted, §5.13) via the `tone` prop.
 */
export type DragHandleTone = "ink-muted" | "ink";

const GRIP_DOT_TONE: Record<DragHandleTone, string> = {
  "ink-muted": "bg-ink-muted",
  ink: "bg-ink",
};

interface DragHandleProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  /** Player this handle moves; used to build the accessible label. */
  playerName: string;
  /** Grip dot color; `ink` while the row is lifted (§5.13). Defaults to `ink-muted`. */
  tone?: DragHandleTone;
  /** Keyboard/tap fallback — move the player to the other team (Req 21.6). */
  onMove: () => void;
}

/** One 3.6px grip dot. */
function GripDot({ tone }: { tone: DragHandleTone }) {
  return (
    <span
      aria-hidden="true"
      className={cn("size-[3.6px] rounded-full", GRIP_DOT_TONE[tone])}
    />
  );
}

export function DragHandle({
  playerName,
  tone = "ink-muted",
  onMove,
  className,
  ...rest
}: DragHandleProps) {
  return (
    <button
      type="button"
      aria-label={`Move ${playerName} to the other team`}
      onClick={onMove}
      className={cn(
        "-ml-1.5 grid h-11 w-7 cursor-grab touch-none place-items-center bg-transparent",
        className,
      )}
      {...rest}
    >
      <span className="grid h-5 w-3.5 grid-cols-2 place-content-between justify-items-center">
        <GripDot tone={tone} />
        <GripDot tone={tone} />
        <GripDot tone={tone} />
        <GripDot tone={tone} />
        <GripDot tone={tone} />
        <GripDot tone={tone} />
      </span>
    </button>
  );
}

/**
 * Reusable drag-state classNames (design.md §5.13). The DnD wiring in task 9.2
 * applies these to the row / placeholder / drop target so the visual language
 * lives in one place.
 */
export const DRAG_STATE = {
  /** The row being dragged: lifted, tilted, and shadowed, following the finger. */
  liftedRow: "bg-surface -rotate-2 shadow-card-lifted",
  /** The row currently under the finger — a dashed swap target. */
  dropTarget: "border-2 border-dashed border-ink bg-surface",
  /** The origin slot left behind — a dashed placeholder with the muted name. */
  placeholder:
    "min-h-[46px] rounded-row border-2 border-dashed border-line px-2.5 flex items-center text-body font-semibold text-ink-muted",
} as const;
