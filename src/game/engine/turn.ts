import type { Direction, GameState } from "./types";

/**
 * The seat index reached by stepping `steps` positions from `fromSeat` in the
 * given direction, wrapping around the table. All seats in the engine are
 * occupied and in-game (departures are handled by the server layer), so the
 * next occupied seat is simple modular arithmetic.
 */
export function seatAfter(state: GameState, fromSeat: number, direction: Direction, steps = 1): number {
  const n = state.seats.length;
  return (((fromSeat + direction * steps) % n) + n) % n;
}

/**
 * Advance the active seat by one step in the current direction. Used after a
 * normal (non-reverse, non-skip) play or a resolved draw (Req 6.1).
 */
export function advanceActive(state: GameState): number {
  return seatAfter(state, state.activeSeat, state.direction);
}

/**
 * Resolve turn advancement for a reverse card (Req 6.2, 6.3).
 * - 3+ players: invert direction, then advance one step in the new direction.
 * - exactly 2 players: direction unchanged, opponent skipped, same player again.
 *
 * @returns the new direction and the next active seat.
 */
export function resolveReverse(state: GameState): { direction: Direction; activeSeat: number } {
  if (state.seats.length === 2) {
    // Same player acts again; direction unchanged.
    return { direction: state.direction, activeSeat: state.activeSeat };
  }
  const direction = (state.direction * -1) as Direction;
  const activeSeat = seatAfter(state, state.activeSeat, direction);
  return { direction, activeSeat };
}

/**
 * Resolve turn advancement for a skip card (Req 6.4, 6.5).
 * - 3+ players: advance past the next player (two steps).
 * - exactly 2 players: same player acts again (two steps wraps to self).
 *
 * @returns the next active seat (direction is unchanged by a skip).
 */
export function resolveSkip(state: GameState): number {
  return seatAfter(state, state.activeSeat, state.direction, 2);
}
