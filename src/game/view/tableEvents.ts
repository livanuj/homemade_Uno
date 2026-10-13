/**
 * Table events worth calling out to every player (Req 6.2–6.5): a SKIP (who
 * misses their turn) and a REVERSE (play changes direction). They are derived
 * on each client by diffing two snapshots of the public state, so every screen
 * shows them — presentational only; the server state is already applied.
 */
import type { CardView, Direction, GameView } from "./types";

export type TableEvent =
  | { kind: "skip"; seatId: string }
  | { kind: "reverse"; direction: Direction };

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
