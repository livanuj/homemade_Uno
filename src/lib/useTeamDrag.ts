/**
 * Pointer drag-and-drop for the 2v2 lobby rows (design.md §5.13, Req 21.2–21.5).
 *
 * The host presses a row's `DragHandle`; once the pointer travels past a small
 * threshold the row lifts and follows the finger vertically, and whatever drop
 * target is under the pointer is reported as `over`. Releasing calls `onDrop`
 * with that target (or null). A press that never crosses the threshold stays a
 * tap, so the handle's click still runs its tap/keyboard swap (Req 21.6).
 *
 * Move/up listeners live on `window`, not the handle: once the drag starts the
 * handle's row is swapped for a placeholder and unmounts, which would drop any
 * pointer capture held by it. Drop targets are found by hit-testing elements
 * tagged with `data-drop-player` / `data-drop-team` (see `dropTargetAttrs`).
 */
import type { TeamDropTarget } from "@/game/view/teams";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

/** Travel (px) before a press becomes a drag rather than a tap. */
const DRAG_THRESHOLD_PX = 6;

export interface TeamDragState {
  /** Player id of the lifted row. */
  draggingId: string;
  /** Drop target under the pointer, never the dragged row itself. */
  over: TeamDropTarget | null;
  /** Lifted row's top edge, in px from the top of the drag container. */
  liftY: number;
}

/** Data attributes that make an element a drop target for hit-testing. */
export function dropTargetAttrs(target: TeamDropTarget): Record<string, string> {
  return target.kind === "player"
    ? { "data-drop-player": target.id }
    : { "data-drop-team": target.team };
}

function targetAt(x: number, y: number): TeamDropTarget | null {
  const el = document
    .elementFromPoint?.(x, y)
    ?.closest<HTMLElement>("[data-drop-player], [data-drop-team]");
  if (!el) return null;
  const { dropPlayer, dropTeam } = el.dataset;
  if (dropPlayer) return { kind: "player", id: dropPlayer };
  if (dropTeam === "A" || dropTeam === "B") return { kind: "slot", team: dropTeam };
  return null;
}

export function useTeamDrag({
  containerRef,
  onDrop,
}: {
  containerRef: RefObject<HTMLElement | null>;
  onDrop: (draggingId: string, target: TeamDropTarget | null) => void;
}) {
  const [drag, setDrag] = useState<TeamDragState | null>(null);
  const onDropRef = useRef(onDrop);
  const stopRef = useRef<(() => void) | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    onDropRef.current = onDrop;
  });
  useEffect(() => () => stopRef.current?.(), []);

  const startDrag = useCallback(
    (id: string, event: ReactPointerEvent<HTMLElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      stopRef.current?.();
      suppressClickRef.current = false;

      const { pointerId, clientX: startX, clientY: startY } = event;
      const row = event.currentTarget.closest("[data-drop-player]");
      const grabOffset =
        startY - (row ?? event.currentTarget).getBoundingClientRect().top;
      let active = false;

      const overAt = (x: number, y: number) => {
        const over = targetAt(x, y);
        return over?.kind === "player" && over.id === id ? null : over;
      };
      const liftYAt = (y: number) =>
        y - grabOffset - (containerRef.current?.getBoundingClientRect().top ?? 0);

      const move = (e: PointerEvent) => {
        if (e.pointerId !== pointerId) return;
        if (!active) {
          const travel = Math.hypot(e.clientX - startX, e.clientY - startY);
          if (travel < DRAG_THRESHOLD_PX) return;
          active = true;
        }
        e.preventDefault();
        setDrag({
          draggingId: id,
          over: overAt(e.clientX, e.clientY),
          liftY: liftYAt(e.clientY),
        });
      };
      const up = (e: PointerEvent) => {
        if (e.pointerId !== pointerId) return;
        stop();
        if (!active) return;
        // A click may follow the release; it belongs to the drag, not a tap.
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
        onDropRef.current(id, overAt(e.clientX, e.clientY));
      };
      const cancel = (e: PointerEvent) => {
        if (e.pointerId === pointerId) stop();
      };
      const stop = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", cancel);
        stopRef.current = null;
        setDrag(null);
      };

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", cancel);
      stopRef.current = stop;
    },
    [containerRef],
  );

  /** True (once) when a click is the tail of a drag and must not act as a tap. */
  const consumeClick = useCallback(() => {
    const suppressed = suppressClickRef.current;
    suppressClickRef.current = false;
    return suppressed;
  }, []);

  return { drag, startDrag, consumeClick };
}
