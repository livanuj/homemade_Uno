import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { deal } from "./deal";
import { reducer } from "./reducer";
import { createSeededRng } from "./rng";
import { makeState, playerList, runLegalSequence } from "./testkit";
import type { Card, Seat, Suit } from "./types";

const RUNS = 100;
const MAX_STEPS = 60;

const twoSeats: Seat[] = [
  { playerId: "p0", seat: 0 },
  { playerId: "p1", seat: 1 },
];

/**
 * A state where p0 holds exactly two cards: a playable non-symbol card and one
 * other. Playing the first leaves p0 on 1 card, ending their turn — the
 * forgot-to-call trigger unless a call was recorded.
 */
function twoCardState(called: boolean, color: Suit): ReturnType<typeof makeState> {
  const playable: Card = { id: "play", suit: color, value: 4 };
  const other: Card = { id: "other", suit: color, value: 8 };
  return makeState({
    seats: twoSeats,
    hands: [[playable, other], [{ id: "x", suit: color, value: 2 }]],
    drawPile: [
      { id: "d0", suit: "blue", value: 0 },
      { id: "d1", suit: "blue", value: 1 },
    ],
    discardPile: [{ id: "top", suit: color, value: 5 }],
    activeColor: color,
    lastCardCalledSeat: called ? 0 : null,
  });
}

describe("Feature: homemade-uno, Property 12: Last-card penalty", () => {
  it("ending a turn on exactly 1 card with no call recorded draws exactly 2", () => {
    fc.assert(
      fc.property(fc.constantFrom<Suit>("red", "yellow", "green", "blue"), (color) => {
        const state = twoCardState(false, color);
        const res = reducer(state, { type: "play", playerId: "p0", cardId: "play" }, { rng: createSeededRng(1) });
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        // Started with 2, played 1 (→1), then +2 penalty → 3 cards.
        expect(res.state.hands[0].length).toBe(3);
      }),
      { numRuns: RUNS },
    );
  });

  it("no penalty is drawn when the last-card call was recorded", () => {
    fc.assert(
      fc.property(fc.constantFrom<Suit>("red", "yellow", "green", "blue"), (color) => {
        const state = twoCardState(true, color);
        const res = reducer(state, { type: "play", playerId: "p0", cardId: "play" }, { rng: createSeededRng(1) });
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.hands[0].length).toBe(1);
      }),
      { numRuns: RUNS },
    );
  });
});

describe("Feature: homemade-uno, Property 13: Last-card flag hygiene", () => {
  it("no seat holding more than one card retains a recorded last-card call", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 31 }), fc.integer({ min: 2, max: 8 }), (seed, count) => {
        const rng = createSeededRng(seed);
        const initial = deal({ mode: "normal", players: playerList(count) }, rng);
        runLegalSequence(initial, { rng }, MAX_STEPS, (state) => {
          if (state.lastCardCalledSeat !== null) {
            expect(state.hands[state.lastCardCalledSeat].length).toBeLessThanOrEqual(1);
          }
        });
      }),
      { numRuns: RUNS },
    );
  });
});
