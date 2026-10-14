/**
 * Table events worth calling out to every player (Req 6.2–6.5): a SKIP (who
 * misses their turn) and a REVERSE (play changes direction). They are derived
 * on each client by diffing two snapshots of the public state, so every screen
 * shows them — presentational only; the server state is already applied.
 */
import type { CardView, Direction, GameView } from "./types";

export type TableEvent =
  | { kind: "skip"; seatId: string }
  | { kind: "reverse"; direction: Direction }
  /** Caught on one card without calling UNO: draws {@link CATCH_PENALTY}. */
  | { kind: "caught"; seatId: string };

/** Cards drawn when caught on one card without calling UNO (Req 11.3). */
export const CATCH_PENALTY = 2;

/** The pieces of the view an event depends on. */
export interface EventSnapshot {
  discardTop: CardView;
  /** Whose turn it is; on a discard change, the previous value is who played. */
  activeSeatId: string;
  direction: Direction;
  /** Every player id in seat order (direction 1 = this order). */
  turnOrder: string[];
}

/**
 * Player ids in seat order, starting with the viewer. Uses `view.turnOrder`
 * when the mapper supplied it; otherwise the viewer, then the seats clockwise
 * (in 2v2 the partner sits across, between the two opponents).
 */
export function turnOrderOf(view: GameView): string[] {
  if (view.turnOrder?.length) return view.turnOrder;
  if (view.partner) {
    const [left, right] = view.opponents;
    return [view.selfId, left?.id, view.partner.id, right?.id].filter(
      (id): id is string => !!id,
    );
  }
  return [view.selfId, ...view.opponents.map((o) => o.id)];
}

/** The player `steps` seats after `fromId` in `direction`, wrapping. */
function seatAfter(order: string[], fromId: string, direction: Direction): string | null {
  const i = order.indexOf(fromId);
  if (i < 0 || order.length < 2) return null;
  const n = order.length;
  return order[(((i + direction) % n) + n) % n];
}

/** What, if anything, the newest play did to the turn order. Pure. */
export function detectTableEvent(
  prev: EventSnapshot,
  next: EventSnapshot,
): TableEvent | null {
  if (next.discardTop.id === prev.discardTop.id) return null;
  const value = next.discardTop.value;
  const player = prev.activeSeatId;
  const order = next.turnOrder;

  if (value === "skip") {
    const seatId = seatAfter(order, player, next.direction);
    return seatId ? { kind: "skip", seatId } : null;
  }
  if (value === "reverse") {
    // With 2 players a reverse works like a skip (Req 6.3).
    if (order.length === 2) {
      const seatId = seatAfter(order, player, next.direction);
      return seatId ? { kind: "skip", seatId } : null;
    }
    if (next.direction !== prev.direction) {
      return { kind: "reverse", direction: next.direction };
    }
  }
  return null;
}

/**
 * Players who have just called UNO (Req 11): ids in `next` that were not in
 * `prev`. A call that is cleared (the hand grew again) is not an event. Pure.
 */
export function newUnoCalls(
  prev: readonly string[] | undefined,
  next: readonly string[] | undefined,
): string[] {
  const before = new Set(prev ?? []);
  return (next ?? []).filter((id) => !before.has(id));
}

/** The pieces of the view a catch is spotted from. */
export interface CatchSnapshot {
  /** Card count per player id (the viewer's hand included). */
  counts: Record<string, number>;
  discardTopId: string;
  penaltyCount: number;
}

/**
 * Players who were just caught without calling UNO (Req 11.3): their count
 * jumped from 1 to 1 + {@link CATCH_PENALTY} while nothing else moved — no new
 * discard (not a play) and the same pending penalty (not a +2/+4 draw). Pure.
 */
export function detectCatches(prev: CatchSnapshot, next: CatchSnapshot): string[] {
  if (
    prev.discardTopId !== next.discardTopId ||
    prev.penaltyCount !== next.penaltyCount
  ) {
    return [];
  }
  return Object.keys(next.counts).filter(
    (id) => prev.counts[id] === 1 && next.counts[id] === 1 + CATCH_PENALTY,
  );
}
