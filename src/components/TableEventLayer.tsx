/**
 * Skip / reverse callouts over the table (Req 6.2–6.5), shown on EVERY
 * player's screen:
 * - skip, on the skipped player's own screen: a large ⊘ "You're skipped!"
 *   stamp over the piles;
 * - skip, everyone else: a "⊘ Leo is skipped" banner (the seat itself also
 *   gets a Skipped badge, see `GameTable`);
 * - reverse: a "⇄ Reversed · now clockwise" banner (the direction ring also
 *   pulses and turns the other way).
 *
 * Presentational only: the server state is already applied underneath.
 */
import {
  DURATION,
  instant,
  tableEventPop,
} from "@/design/motion";
import {
  detectTableEvent,
  turnOrderOf,
  type EventSnapshot,
  type TableEvent,
} from "@/game/view/tableEvents";
import type { GameView } from "@/game/view/types";
import { cn } from "@/lib/cn";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

export interface ShownTableEvent {
  event: TableEvent;
  /** Changes for every new event, so a repeat skip pops again. */
  key: number;
}

function snapshotOf(view: GameView): EventSnapshot {
  return {
    discardTop: view.discardTop,
    activeSeatId: view.activeSeatId,
    direction: view.direction,
    turnOrder: turnOrderOf(view),
  };
}

/**
 * The skip / reverse event caused by the newest play, held on screen for
 * {@link DURATION.tableEvent}. Null when nothing is showing.
 */
export function useTableEvent(view: GameView): ShownTableEvent | null {
  const prev = useRef<EventSnapshot>(snapshotOf(view));
  const [shown, setShown] = useState<ShownTableEvent | null>(null);
  const discardId = view.discardTop.id;

  useEffect(() => {
    const next = snapshotOf(view);
    const event = detectTableEvent(prev.current, next);
    prev.current = next;
    if (!event) return;
    setShown((s) => ({ event, key: (s?.key ?? 0) + 1 }));
    const t = window.setTimeout(
      () => setShown(null),
      DURATION.tableEvent * 1000,
    );
    return () => window.clearTimeout(t);
    // Only a new discard can carry a new event.
  }, [discardId]); // eslint-disable-line react-hooks/exhaustive-deps

  return shown;
}

/** The sentence for an event, as shown and announced. */
export function tableEventText(
  event: TableEvent,
  view: Pick<GameView, "selfId" | "opponents" | "partner">,
): string {
  if (event.kind === "reverse") {
    return `Reversed · now ${event.direction === 1 ? "clockwise" : "counter-clockwise"}`;
  }
  if (event.seatId === view.selfId) return "You're skipped!";
  const name =
    view.opponents.find((o) => o.id === event.seatId)?.name ??
    (view.partner?.id === event.seatId ? view.partner.name : "Someone");
  return `${name} is skipped`;
}

export function TableEventLayer({
  shown,
  view,
  bannerClassName,
  stampClassName,
  reduced,
}: {
  shown: ShownTableEvent | null;
  view: GameView;
  /** Banner position (per table layout). */
  bannerClassName: string;
  /** Your-skipped stamp position (per table layout). */
  stampClassName: string;
  reduced: boolean;
}) {
  const event = shown?.event;
  const selfSkipped = event?.kind === "skip" && event.seatId === view.selfId;
  const transition = reduced ? { transition: instant } : {};

  return (
    <AnimatePresence>
      {shown && event && selfSkipped && (
        <motion.div
          key={`stamp-${shown.key}`}
          variants={tableEventPop}
          initial="hidden"
          animate="visible"
          exit="exit"
          {...transition}
          className={cn(
            "pointer-events-none absolute inset-x-0 z-30 flex flex-col items-center gap-2",
            stampClassName,
          )}
        >
          <span className="grid size-24 place-items-center rounded-full border-4 border-surface bg-danger font-display text-hero text-surface shadow-cta">
            <span aria-hidden="true">⊘</span>
          </span>
          <span className="rounded-full bg-danger px-4 py-1.5 font-display text-cta text-surface shadow-cta">
            {tableEventText(event, view)}
          </span>
        </motion.div>
      )}
      {shown && event && !selfSkipped && (
        <motion.div
          key={`banner-${shown.key}`}
          variants={tableEventPop}
          initial="hidden"
          animate="visible"
          exit="exit"
          {...transition}
          className={cn(
            "pointer-events-none absolute inset-x-0 z-30 flex justify-center",
            bannerClassName,
          )}
        >
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2 text-body shadow-cta",
              event.kind === "skip"
                ? "bg-danger text-surface"
                : "bg-ink text-surface",
            )}
          >
            <span aria-hidden="true" className="text-cta leading-none">
              {event.kind === "skip" ? "⊘" : "⇄"}
            </span>
            {tableEventText(event, view)}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
