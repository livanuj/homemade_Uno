import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { deal } from "./deal";
import { reducer } from "./reducer";
import { createSeededRng } from "./rng";
import { makeState, playerList, runLegalSequence } from "./testkit";
import type { Card, Seat, Suit } from "./types";

const RUNS = 100;
const MAX_STEPS = 60;

const threeSeats: Seat[] = [
  { playerId: "p0", seat: 0 },
  { playerId: "p1", seat: 1 },
  { playerId: "p2", seat: 2 },
];

/**
 * A state where p0 holds exactly two cards: a playable non-symbol card and one
 * other. Playing the first leaves p0 on 1 card and passes the turn to p1.
 */
function twoCardState(called: boolean, color: Suit): ReturnType<typeof makeState> {
  const playable: Card = { id: "play", suit: color, value: 4 };
  const other: Card = { id: "other", suit: color, value: 8 };
  return makeState({
    seats: threeSeats,
    hands: [
      [playable, other],
      [{ id: "x", suit: color, value: 2 }, { id: "y", suit: color, value: 3 }],
      [{ id: "z", suit: color, value: 6 }, { id: "w", suit: color, value: 7 }],
    ],
    drawPile: [
      { id: "d0", suit: "blue", value: 0 },
      { id: "d1", suit: "blue", value: 1 },
    ],
    discardPile: [{ id: "top", suit: color, value: 5 }],
    activeColor: color,
    lastCardCalledSeats: called ? [0] : [],
  });
}

describe("Feature: homemade-uno, Property 12: Last-card penalty", () => {
  it("an uncalled 1-card player draws exactly 2 only when an opponent catches them; the turn is unchanged", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Suit>("red", "yellow", "green", "blue"),
        fc.constantFrom("p1", "p2"),
        (color, catcher) => {
          const rng = createSeededRng(1);
          const played = reducer(twoCardState(false, color), { type: "play", playerId: "p0", cardId: "play" }, { rng });
          expect(played.ok).toBe(true);
          if (!played.ok) return;
          // No automatic penalty when the turn ends on 1 card.
          expect(played.state.hands[0].length).toBe(1);

          const caught = reducer(played.state, { type: "catch_last", playerId: catcher, targetPlayerId: "p0" }, { rng });
          expect(caught.ok).toBe(true);
          if (!caught.ok) return;
          expect(caught.state.hands[0].length).toBe(3);
          expect(caught.state.activeSeat).toBe(played.state.activeSeat);
          expect(caught.state.phase).toBe(played.state.phase);
        },
      ),
      { numRuns: RUNS },
    );
  });

  it("a player who recorded the call cannot be caught", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Suit>("red", "yellow", "green", "blue"),
        fc.constantFrom("p1", "p2"),
        (color, catcher) => {
          const rng = createSeededRng(1);
          const played = reducer(twoCardState(true, color), { type: "play", playerId: "p0", cardId: "play" }, { rng });
          expect(played.ok).toBe(true);
          if (!played.ok) return;
          const caught = reducer(played.state, { type: "catch_last", playerId: catcher, targetPlayerId: "p0" }, { rng });
          expect(caught).toEqual({ ok: false, reason: "not_catchable" });
          expect(played.state.hands[0].length).toBe(1);
        },
      ),
      { numRuns: RUNS },
    );
  });
});

describe("Feature: homemade-uno, Property 13: Last-card flag hygiene", () => {
  it("a recorded call is only held by a seat on 1 card, or the active seat pre-calling on 2", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 31 }), fc.integer({ min: 2, max: 8 }), (seed, count) => {
        const rng = createSeededRng(seed);
        const initial = deal({ mode: "normal", players: playerList(count) }, rng);
        runLegalSequence(initial, { rng }, MAX_STEPS, (state) => {
          for (const seat of state.lastCardCalledSeats) {
            const size = state.hands[seat].length;
            expect(size <= 1 || (size === 2 && seat === state.activeSeat)).toBe(true);
          }
        });
      }),
      { numRuns: RUNS },
    );
  });
});
