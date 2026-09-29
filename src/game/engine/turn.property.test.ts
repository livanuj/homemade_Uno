import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { deal } from "./deal";
import { reducer } from "./reducer";
import { createSeededRng } from "./rng";
import {
  activePlayerId,
  activeSeatIsValid,
  makeState,
  playerList,
  runLegalSequence,
} from "./testkit";
import type { Card, GameMode, GameState, Seat, Suit } from "./types";

const RUNS = 100;
const MAX_STEPS = 60;

/** Seats for `n` players in Normal mode. */
function normalSeats(n: number): Seat[] {
  return Array.from({ length: n }, (_, i) => ({ playerId: `p${i}`, seat: i }));
}

/**
 * A state where the active player (seat 0) holds a single symbol card of the
 * given kind, matching the active color so the play is legal. Other seats hold
 * a filler card each. Used to test reverse/skip advancement precisely.
 */
function stateWithSymbol(playerCount: number, symbol: "reverse" | "skip", color: Suit): GameState {
  const seats = normalSeats(playerCount);
  const symbolCard: Card = { id: "sym", suit: color, value: symbol };
  const hands: Card[][] = seats.map((_, i) =>
    i === 0 ? [symbolCard, { id: `f0`, suit: color, value: 5 }] : [{ id: `f${i}`, suit: color, value: 3 }],
  );
  return makeState({
    seats,
    hands,
    discardPile: [{ id: "top", suit: color, value: 7 }],
    activeColor: color,
  });
}

describe("Feature: homemade-uno, Property 4: Exactly one active player", () => {
  it("every reachable non-ended state has a valid single active seat", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 ** 31 }),
        fc.constantFrom<GameMode>("normal", "team"),
        fc.integer({ min: 2, max: 8 }),
        (seed, mode, rawCount) => {
          const count = mode === "team" ? 4 : rawCount;
          const rng = createSeededRng(seed);
          const initial = deal({ mode, players: playerList(count) }, rng);
          runLegalSequence(initial, { rng }, MAX_STEPS, (state) => {
            if (state.phase !== "ended") {
              expect(activeSeatIsValid(state)).toBe(true);
            }
          });
        },
      ),
      { numRuns: RUNS },
    );
  });
});

describe("Feature: homemade-uno, Property 5: Reverse turn order", () => {
  it("3+ players invert direction; exactly 2 players keep direction and same player again", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 8 }), (count) => {
        const state = stateWithSymbol(count, "reverse", "red");
        const res = reducer(state, { type: "play", playerId: "p0", cardId: "sym" }, { rng: createSeededRng(1) });
        expect(res.ok).toBe(true);
        if (!res.ok) return;

        if (count === 2) {
          expect(res.state.direction).toBe(1);
          expect(activePlayerId(res.state)).toBe("p0");
        } else {
          expect(res.state.direction).toBe(-1);
          // With direction inverted, the next seat is the previous one (wraps to last).
          expect(res.state.activeSeat).toBe(count - 1);
        }
      }),
      { numRuns: RUNS },
    );
  });
});

describe("Feature: homemade-uno, Property 6: Skip turn order", () => {
  it("3+ players skip the next player; exactly 2 players return to the same player", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 8 }), (count) => {
        const state = stateWithSymbol(count, "skip", "red");
        const res = reducer(state, { type: "play", playerId: "p0", cardId: "sym" }, { rng: createSeededRng(1) });
        expect(res.ok).toBe(true);
        if (!res.ok) return;

        if (count === 2) {
          expect(activePlayerId(res.state)).toBe("p0");
        } else {
          // Skipped seat 1; seat 2 becomes active.
          expect(res.state.activeSeat).toBe(2 % count);
        }
      }),
      { numRuns: RUNS },
    );
  });
});

describe("Feature: homemade-uno, Property 7: Actions from a forbidden context are no-ops", () => {
  it("out-of-turn / wrong-phase / post-end actions are rejected and leave state unchanged", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 ** 31 }),
        fc.integer({ min: 2, max: 8 }),
        (seed, count) => {
          const rng = createSeededRng(seed);
          const state = deal({ mode: "normal", players: playerList(count) }, rng);
          const nonActiveId = state.seats[(state.activeSeat + 1) % count].playerId;
          const before = JSON.stringify(state);

          // A non-active player's play/draw is rejected, state unchanged (Req 6.9).
          const someCardId = state.hands[(state.activeSeat + 1) % count][0].id;
          const rPlay = reducer(state, { type: "play", playerId: nonActiveId, cardId: someCardId }, { rng });
          expect(rPlay.ok).toBe(false);
          const rDraw = reducer(state, { type: "draw", playerId: nonActiveId }, { rng });
          expect(rDraw.ok).toBe(false);
          expect(JSON.stringify(state)).toBe(before);

          // choose_color while not wild_pending is rejected (wrong phase).
          const rColor = reducer(
            state,
            { type: "choose_color", playerId: activePlayerId(state), color: "blue" as Suit },
            { rng },
          );
          expect(rColor.ok).toBe(false);

          // After the game has ended, every action is rejected.
          const ended: GameState = { ...state, phase: "ended" };
          const rEnded = reducer(ended, { type: "draw", playerId: activePlayerId(ended) }, { rng });
          expect(rEnded.ok).toBe(false);
        },
      ),
      { numRuns: RUNS },
    );
  });
});
