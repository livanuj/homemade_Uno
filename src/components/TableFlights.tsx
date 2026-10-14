/**
 * Opponent card flights over the table (Req 10.6 / 17.2).
 *
 * - Draw: when another player's card count grows (a draw, a +2/+4 penalty, or
 *   being caught without calling LAST CARD!), that many face-down backs fly
 *   from the draw pile to their seat ONE AT A TIME: each card leaves as the
 *   previous one lands, so a +4 reads as four distinct cards. The seat shows
 *   its count minus the cards still in the air (`inFlightTo`), so each card is
 *   added to the seat only as it lands.
 * - Play: when the discard top changes on another player's turn, the card
 *   flies from their seat to the discard pile, flipping face-up over 350ms.
 *   The real discard top is held back until it lands.
 *
 * Your own throw and draws are animated by the hand fan instead. Flights are
 * purely presentational: the server state is already applied underneath.
 * Reduced motion (Req 17.6) disables every flight.
 */
import { DURATION, drawSlideTransition } from "@/design/motion";
import { CATCH_PENALTY } from "@/game/view/tableEvents";
import type { CardView } from "@/game/view/types";
import { motion } from "motion/react";
import { useState, type CSSProperties } from "react";
import { CardBack } from "./CardBack";
import { MotionFlightCard } from "./MotionFlightCard";

/** At most this many backs fly for one draw (matches the 7-back seat stack). */
const MAX_DRAW_FLIGHTS = 7;

/** Seconds before drawn card `index` leaves the pile: right as the previous one lands. */
export function drawFlightDelay(index: number): number {
  return index * DURATION.drawSlide;
}

/** The pieces of the table a flight depends on. */
export interface TableSnapshot {
  selfId: string;
  /** Whose turn it is; on a discard change, the previous value is who played. */
  activeSeatId: string;
  /** Card count per OTHER player (opponents + 2v2 partner), keyed by id. */
  counts: Record<string, number>;
  discardTop: CardView;
  /** Pending +2/+4 count — tells a catch penalty from a penalty draw. */
  penaltyCount?: number;
}

export type FlightSpec =
  /** `delay` (s): a caught player's cards wait for the punishment to play. */
  | { kind: "draw"; seatId: string; count: number; delay?: number }
  | { kind: "play"; seatId: string; card: CardView };

export type Flight =
  | { kind: "draw"; key: string; seatId: string; index: number; delay?: number }
  | { kind: "play"; key: string; seatId: string; card: CardView; index: 0 };

/** What should fly between two snapshots of the table. Pure. */
export function diffFlights(prev: TableSnapshot, next: TableSnapshot): FlightSpec[] {
  const specs: FlightSpec[] = [];
  for (const [seatId, count] of Object.entries(next.counts)) {
    const before = prev.counts[seatId];
    if (before !== undefined && count > before) {
      // Caught without calling UNO (1 → 3 with nothing else moving): the cards
      // follow the punishment instead of arriving with it.
      const caught =
        before === 1 &&
        count === 1 + CATCH_PENALTY &&
        next.discardTop.id === prev.discardTop.id &&
        (next.penaltyCount ?? 0) === (prev.penaltyCount ?? 0);
      specs.push({
        kind: "draw",
        seatId,
        count: Math.min(count - before, MAX_DRAW_FLIGHTS),
        ...(caught ? { delay: DURATION.catchPunish } : {}),
      });
    }
  }
  // The state doc carries the discard and the active seat together, so the
  // player whose turn it was in `prev` is the one who just played.
  if (
    next.discardTop.id !== prev.discardTop.id &&
    prev.activeSeatId !== prev.selfId &&
    prev.activeSeatId in next.counts
  ) {
    specs.push({ kind: "play", seatId: prev.activeSeatId, card: next.discardTop });
  }
  return specs;
}

/** Stable signature of a snapshot, so unrelated re-renders spawn nothing. */
function signature(s: TableSnapshot): string {
  return JSON.stringify([s.activeSeatId, s.discardTop.id, s.counts]);
}

interface FlightState {
  sig: string;
  prev: TableSnapshot;
  flights: Flight[];
  nextKey: number;
}

/**
 * Turn table changes into live flights. State is adjusted DURING render (not
 * in an effect) so the held discard top never flashes the new card for a frame.
 */
export function useTableFlights(snapshot: TableSnapshot, reduced: boolean) {
  const sig = signature(snapshot);
  const [state, setState] = useState<FlightState>(() => ({
    sig,
    prev: snapshot,
    flights: [],
    nextKey: 0,
  }));

  let current = state;
  if (state.sig !== sig) {
    const specs = reduced ? [] : diffFlights(state.prev, snapshot);
    let nextKey = state.nextKey;
    const spawned: Flight[] = specs.flatMap((spec): Flight[] =>
      spec.kind === "play"
        ? [{ ...spec, key: `f${nextKey++}`, index: 0 }]
        : Array.from({ length: spec.count }, (_, index) => ({
            kind: "draw" as const,
            key: `f${nextKey++}`,
            seatId: spec.seatId,
            index,
            ...(spec.delay ? { delay: spec.delay } : {}),
          })),
    );
    // A newer play supersedes any play still in the air.
    const hasNewPlay = spawned.some((f) => f.kind === "play");
    const kept = hasNewPlay ? state.flights.filter((f) => f.kind !== "play") : state.flights;
    current = { sig, prev: snapshot, flights: [...kept, ...spawned], nextKey };
    setState(current);
  }

  const play = current.flights.find((f) => f.kind === "play");
  const holdTopId =
    play && play.kind === "play" && play.card.id === snapshot.discardTop.id ? play.card.id : null;

  const done = (key: string) =>
    setState((s) => ({ ...s, flights: s.flights.filter((f) => f.key !== key) }));

  // Drawn cards not yet landed, per seat: the seat holds them back until then.
  const inFlightTo: Record<string, number> = {};
  for (const f of current.flights) {
    if (f.kind === "draw") inFlightTo[f.seatId] = (inFlightTo[f.seatId] ?? 0) + 1;
  }

  return { flights: current.flights, holdTopId, inFlightTo, done };
}

export interface Point {
  x: number;
  y: number;
}

/** Table coordinates (px) the flights travel between. */
export interface FlightGeometry {
  /** Center of the draw pile. */
  drawPile: Point;
  /** Top-left of the discard top card's slot. */
  discardSlot: Point;
  /** Center of the discard top card. */
  discardCenter: Point;
  /** Where cards land at each other player's seat, keyed by player id. */
  seats: Record<string, Point>;
}

/** Side-seat back size (CardBack `side-seat`): the card that flies to a seat. */
const BACK_W = 40;
const BACK_H = 58;
/** Draw pile back is 70px wide; start the flying back at that size. */
const DRAW_PILE_SCALE = 70 / BACK_W;

/** Renders the in-flight cards. Decorative: hidden from AT, never interactive. */
export function TableFlights({
  flights,
  geometry,
  onDone,
}: {
  flights: Flight[];
  geometry: FlightGeometry;
  onDone: (key: string) => void;
}) {
  const { drawPile, discardSlot, discardCenter, seats } = geometry;
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {flights.map((flight) => {
        const seat = seats[flight.seatId];
        if (!seat) return null;

        if (flight.kind === "play") {
          const style: CSSProperties = {
            left: discardSlot.x,
            top: discardSlot.y,
            transform: "rotate(8deg)",
          };
          return (
            <div key={flight.key} className="absolute" style={style}>
              <MotionFlightCard
                kind="opponent-play"
                variant="pile"
                value={flight.card.value}
                {...(flight.card.suit ? { suit: flight.card.suit } : {})}
                from={{ x: seat.x - discardCenter.x, y: seat.y - discardCenter.y }}
                tabIndex={-1}
                onComplete={() => onDone(flight.key)}
              />
            </div>
          );
        }

        return (
          <motion.div
            key={flight.key}
            className="absolute"
            style={{ left: drawPile.x - BACK_W / 2, top: drawPile.y - BACK_H / 2 }}
            // Hidden while waiting its turn, so queued cards don't pile up on
            // the draw pile; it appears the instant it leaves.
            initial={{ x: 0, y: 0, scale: DRAW_PILE_SCALE, opacity: 0 }}
            animate={{ x: seat.x - drawPile.x, y: seat.y - drawPile.y, scale: 1, opacity: 1 }}
            transition={{
              ...drawSlideTransition,
              delay: (flight.delay ?? 0) + drawFlightDelay(flight.index),
              opacity: {
                duration: 0,
                delay: (flight.delay ?? 0) + drawFlightDelay(flight.index),
              },
            }}
            onAnimationComplete={() => onDone(flight.key)}
          >
            <CardBack variant="side-seat" />
          </motion.div>
        );
      })}
    </div>
  );
}
