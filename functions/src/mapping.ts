/**
 * Hydrate / dehydrate between the Firestore document model and the engine's
 * pure `GameState`.
 *
 * The engine is the single source of truth for game LOGIC; these functions only
 * shuttle plain data across the persistence boundary:
 *
 *   docs  ── hydrateState ──▶  GameState   (feed the pure reducer)
 *   GameState ── writeState ──▶ docs        (persist inside the transaction)
 *
 * Deck secrecy (Req 23.2): the draw pile lives ONLY in `private/deck`; the
 * public `state/current` never carries it. `hydrateState` reads the draw pile
 * from `DeckDoc`; `writeState` writes the new draw order back to `DeckDoc` and
 * NEVER onto `state/current`.
 */
import type { GameState, Seat } from "./engine";
import type {
  DeckDoc,
  GameMode,
  HandDoc,
  PlayerDoc,
  StateDoc,
  StatePhase,
  Winner,
} from "./model";

/** A seated player, as read from the `players` collection. */
export interface SeatedPlayer {
  readonly playerId: string;
  readonly doc: PlayerDoc;
}

/** Engine phases are a subset of the state-doc phases; map 1:1. */
function toStatePhase(phase: GameState["phase"]): StatePhase {
  switch (phase) {
    case "active":
      return "active";
    case "wild_pending":
      return "wild_pending";
    case "drew_decision":
      return "drew_decision";
    case "ended":
      return "ended";
  }
}

/** Map the engine winner shape to the state-doc winner shape. */
function toDocWinner(winner: GameState["winner"]): Winner | null {
  if (winner === null) return null;
  if (winner.kind === "team") return { kind: "team", team: winner.team };
  return { kind: "player", playerId: winner.playerId, seatIndex: winner.seat };
}

/**
 * Build the engine seats array from seated player docs, ordered by `seatIndex`.
 * Only players with an assigned seat participate (seats are set at start).
 */
export function seatsFromPlayers(players: readonly SeatedPlayer[]): Seat[] {
  const seated = players
    .filter((p) => p.doc.seatIndex !== null)
    .slice()
    .sort((a, b) => (a.doc.seatIndex as number) - (b.doc.seatIndex as number));

  return seated.map((p, index): Seat => {
    const seat: { playerId: string; seat: number; team?: "A" | "B" } = {
      playerId: p.playerId,
      seat: index,
    };
    if (p.doc.team !== null) {
      seat.team = p.doc.team;
    }
    return seat;
  });
}

/**
 * Reconstruct the engine `GameState` from the persisted documents. `hands` is
 * keyed by playerId; the draw pile comes from the server-only deck doc.
 */
export function hydrateState(
  mode: GameMode,
  state: StateDoc,
  players: readonly SeatedPlayer[],
  hands: ReadonlyMap<string, HandDoc>,
  deck: DeckDoc,
): GameState {
  const seats = seatsFromPlayers(players);
  const handsBySeat = seats.map((s) => hands.get(s.playerId)?.cards ?? []);

  return {
    mode,
    seats,
    hands: handsBySeat,
    drawPile: deck.drawPile,
    discardPile: state.discardPile,
    activeColor: state.activeColor,
    activeSeat: state.activeSeat,
    direction: state.direction,
    penaltyCount: state.penaltyCount,
    pendingPenaltyKind: state.pendingPenaltyKind,
    phase: state.phase === "paused" || state.phase === "auto_paused" || state.phase === "dealing"
      ? "active"
      : state.phase,
    drewThisTurn: state.drewThisTurn,
    lastCardCalledSeat: state.lastCardCalledSeat,
    winner: state.winner === null
      ? null
      : state.winner.kind === "team"
        ? { kind: "team", team: state.winner.team }
        : { kind: "player", seat: state.winner.seatIndex, playerId: state.winner.playerId },
  };
}

/** The public `state/current` fields derived from an engine `GameState`. */
export function stateDocFieldsFrom(next: GameState): Omit<
  StateDoc,
  "version" | "pausedBy" | "pausedAt" | "pendingChoice"
> {
  return {
    discardPile: [...next.discardPile],
    activeColor: next.activeColor,
    activeSeat: next.activeSeat,
    direction: next.direction,
    penaltyCount: next.penaltyCount,
    pendingPenaltyKind: next.pendingPenaltyKind,
    phase: toStatePhase(next.phase),
    drewThisTurn: next.drewThisTurn,
    lastCardCalledSeat: next.lastCardCalledSeat,
    winner: toDocWinner(next.winner),
  };
}

/** The draw pile to persist to `private/deck` (never to `state/current`). */
export function deckDocFrom(next: GameState): DeckDoc {
  return { drawPile: [...next.drawPile] };
}

/** The hand doc for a given seat's player. */
export function handDocForSeat(next: GameState, seatIndex: number): HandDoc {
  const cards = next.hands[seatIndex];
  return { cards: [...cards], cardCount: cards.length };
}
