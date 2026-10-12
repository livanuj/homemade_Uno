import { buildDeck, isNumberCard, shuffle } from "./deck";
import type { Card, GameMode, GameState, Rng, Seat, Suit, Team } from "./types";


/** Number of cards dealt to each player. */
export const HAND_SIZE = 7;

/** Input describing who is in the game and the mode, before seats are assigned. */
export interface DealInput {
  readonly mode: GameMode;
  /**
   * Players in join order. The first player is the host and becomes the first
   * active player. In Team mode there must be exactly 4 players.
   */
  readonly players: readonly { readonly playerId: string }[];
}

/**
 * Assign seats for the given players.
 *
 * In Normal mode seats follow join order (seat 0..n-1). In Team mode seats
 * alternate Team A / Team B so partners sit opposite each other: even seats are
 * Team A, odd seats are Team B (Req 5.7).
 */
export function assignSeats(input: DealInput): Seat[] {
  return input.players.map((p, index) => {
    if (input.mode === "team") {
      const team: Team = index % 2 === 0 ? "A" : "B";
      return { playerId: p.playerId, seat: index, team };
    }
    return { playerId: p.playerId, seat: index };
  });
}

/**
 * Deal a fresh game: shuffle, deal 7 to each seat round-robin, flip a number
 * card as the initial discard (reshuffling non-number flips back in), set the
 * active color, make the host (seat 0) active, and set direction clockwise.
 *
 * Pure and deterministic given `rng`. Returns the initial {@link GameState}.
 */
export function deal(input: DealInput, rng: Rng): GameState {
  const seats = assignSeats(input);
  const playerCount = seats.length;

  let drawPile = shuffle(buildDeck(), rng);

  // Deal 7 cards to each seat, one at a time, round-robin by seat.
  const hands: Card[][] = seats.map(() => []);
  for (let round = 0; round < HAND_SIZE; round++) {
    for (let s = 0; s < playerCount; s++) {
      const card = drawPile[0];
      drawPile = drawPile.slice(1);
      hands[s].push(card);
    }
  }

  // Flip the top card as the initial discard. If it is not a number card,
  // return it to the pile, reshuffle, and flip again until a number card is up.
  let top = drawPile[0];
  drawPile = drawPile.slice(1);
  while (!isNumberCard(top)) {
    drawPile = shuffle([...drawPile, top], rng);
    top = drawPile[0];
    drawPile = drawPile.slice(1);
  }

  // A number card always has a suit.
  const activeColor = top.suit as Suit;

  return {
    mode: input.mode,
    seats,
    hands,
    drawPile,
    discardPile: [top],
    activeColor,
    activeSeat: 0, // host is first active
    direction: 1, // clockwise
    penaltyCount: 0,
    pendingPenaltyKind: null,
    phase: "active",
    drewThisTurn: false,
    lastCardCalledSeat: null,
    winner: null,
  };
}
