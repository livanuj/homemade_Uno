/**
 * Skip / reverse callouts over the table (Req 6.2–6.5), shown on EVERY
 * player's screen:
 * - skip, on the skipped player's own screen: a large ⊘ "You're skipped!"
 *   stamp over the piles;
 * - skip, everyone else: a "⊘ Leo is skipped" banner (the seat itself also
 *   gets a Skipped badge, see `GameTable`);
 * - reverse: a "⇄ Reversed · now clockwise" banner (the direction arrows
 *   also pulse and flip);
 * - caught without calling UNO: the same as a skip with "+2" — the caught
 *   player's own stamp, or everyone else's banner and seat badge — shown
 *   before the two penalty cards arrive.
 *
 * Presentational only: the server state is already applied underneath.
 */
import {
  DURATION,
  instant,
  tableEventPop,
} from "@/design/motion";
import {
  detectCatches,
  detectTableEvent,
  newUnoCalls,
  turnOrderOf,
  type CatchSnapshot,
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

/**
 * Players to show a "UNO!" burst over: those who have just called UNO (Req
 * 11), each for {@link DURATION.tableEvent}. Calls already made when the table
 * loads don't burst.
 */
export function useUnoBursts(view: GameView): string[] {
  const prev = useRef<string[]>(view.unoCalledIds ?? []);
  const timers = useRef<number[]>([]);
  const [ids, setIds] = useState<string[]>([]);
  const calledKey = (view.unoCalledIds ?? []).join(",");

  useEffect(() => {
    const added = newUnoCalls(prev.current, view.unoCalledIds);
    prev.current = view.unoCalledIds ?? [];
    if (added.length === 0) return;
    setIds((cur) => [...new Set([...cur, ...added])]);
    timers.current.push(
      window.setTimeout(
        () => setIds((cur) => cur.filter((id) => !added.includes(id))),
        DURATION.tableEvent * 1000,
      ),
    );
  }, [calledKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => timers.current.forEach((t) => window.clearTimeout(t)),
    [],
  );

  return ids;
}

function catchSnapshotOf(view: GameView): CatchSnapshot {
  const counts: Record<string, number> = { [view.selfId]: view.hand.length };
  for (const o of view.opponents) counts[o.id] = o.cardCount;
  if (view.partner) counts[view.partner.id] = view.partner.hand.length;
  return {
    counts,
    discardTopId: view.discardTop.id,
    penaltyCount: view.penaltyCount ?? 0,
  };
}

/**
 * Catches without a UNO call (Req 11.3). `justCaught` is computed during
 * render against the last committed table, so the caught player's own new
 * cards can be held back in the very render that adds them; `shown` keeps the
 * punishment callout up for {@link DURATION.tableEvent}.
 */
export function useCatchEvent(view: GameView): {
  justCaught: string[];
  shown: ShownTableEvent | null;
} {
  const snap = catchSnapshotOf(view);
  const committed = useRef<CatchSnapshot>(snap);
  const justCaught = detectCatches(committed.current, snap);
  const [shown, setShown] = useState<ShownTableEvent | null>(null);
  const sig = JSON.stringify(snap);

  useEffect(() => {
    const caught = detectCatches(committed.current, snap);
    committed.current = snap;
    if (caught.length === 0) return;
    setShown((s) => ({
      event: { kind: "caught", seatId: caught[0] },
      key: (s?.key ?? 0) + 1,
    }));
    const t = window.setTimeout(
      () => setShown(null),
      DURATION.tableEvent * 1000,
    );
    return () => window.clearTimeout(t);
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  return { justCaught, shown };
}

/** "Nora called UNO" / "You called UNO", as announced. */
export function unoCallText(
  id: string,
  view: Pick<GameView, "selfId" | "opponents" | "partner">,
): string {
  if (id === view.selfId) return "You called UNO";
  const name =
    view.opponents.find((o) => o.id === id)?.name ??
    (view.partner?.id === id ? view.partner.name : "Someone");
  return `${name} called UNO`;
}

/** The sentence for an event, as shown and announced. */
export function tableEventText(
  event: TableEvent,
  view: Pick<GameView, "selfId" | "opponents" | "partner">,
): string {
  if (event.kind === "reverse") {
    return `Reversed · now ${event.direction === 1 ? "clockwise" : "counter-clockwise"}`;
  }
  const self = event.seatId === view.selfId;
  const name =
    view.opponents.find((o) => o.id === event.seatId)?.name ??
    (view.partner?.id === event.seatId ? view.partner.name : "Someone");
  if (event.kind === "caught") {
    return self ? "Caught! You forgot UNO" : `${name} was caught!`;
  }
  return self ? "You're skipped!" : `${name} is skipped`;
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
  // Skips and catches land on one player: their own screen gets the stamp.
  const selfSkipped =
    (event?.kind === "skip" || event?.kind === "caught") &&
    event.seatId === view.selfId;
  const glyph =
    event?.kind === "caught" ? "+2" : event?.kind === "reverse" ? "⇄" : "⊘";
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
            <span aria-hidden="true">{glyph}</span>
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
              event.kind === "reverse"
                ? "bg-ink text-surface"
                : "bg-danger text-surface",
            )}
          >
            <span aria-hidden="true" className="text-cta leading-none">
              {glyph}
            </span>
            {tableEventText(event, view)}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
