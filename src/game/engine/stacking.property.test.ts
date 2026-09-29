import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { deal } from "./deal";
import { reducer } from "./reducer";
import { createSeededRng } from "./rng";
import { isLegalStack } from "./rules";
import { makeState, playerList, runLegalSequence } from "./testkit";
import type { Card, PenaltyKind, Seat } from "./types";

const RUNS = 100;
const MAX_STEPS = 60;

const threeSeats: Seat[] = [
  { playerId: "p0", seat: 0 },
  { playerId: "p1", seat: 1 },
  { playerId: "p2", seat: 2 },
];

/** A pending-penalty state: p0 is active facing `count` of `kind`. */
function pendingPenaltyState(count: number, kind: PenaltyKind, activeCard: Card): ReturnType<typeof makeState> {
  return makeState({
    seats: threeSeats,
    hands: [
      [activeCard, { id: "f0", suit: "red", value: 6 }],
      [{ id: "f1", suit: "red", value: 1 }],
      [{ id: "f2", suit: "red", value: 2 }],
    ],
    drawPile: [
      { id: "d0", suit: "green", value: 0 },
      { id: "d1", suit: "green", value: 1 },
      { id: "d2", suit: "green", value: 2 },
      { id: "d3", suit: "green", value: 3 },
      { id: "d4", suit: "green", value: 4 },
      { id: "d5", suit: "green", value: 5 },
      { id: "d6", suit: "green", value: 6 },
    ],
    discardPile: [{ id: "top", suit: "red", value: 9 }],
    activeColor: "red",
    penaltyCount: count,
    pendingPenaltyKind: kind,
  });
}

describe("Feature: homemade-uno, Property 10: Penalty accumulation and asymmetric stacking", () => {
  it("+2 stacks only onto +2; wild4 onto +2 or +4; each accepted stack adds its value", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<PenaltyKind>("two", "four"),
        fc.constantFrom<CardKind>("+2", "wild4"),
        fc.integer({ min: 2, max: 4 }),
        (pendingKind, playedValue, pendingCount) => {
          const card: Card =
            playedValue === "+2" ? { id: "s", suit: "red", value: "+2" } : { id: "s", value: "wild4" };
          const state = pendingPenaltyState(pendingCount, pendingKind, card);

          const expectedLegal = isLegalStack(card, pendingKind);
          const res = reducer(state, { type: "play", playerId: "p0", cardId: "s" }, { rng: createSeededRng(1) });

          if (expectedLegal) {
            expect(res.ok).toBe(true);
            if (!res.ok) return;
            const added = playedValue === "+2" ? 2 : 4;
            expect(res.state.penaltyCount).toBe(pendingCount + added);
            // The penalty passes to the next player (seat 1) — for +2 immediately;
            // for a wild4 the same player must first choose a color.
            if (playedValue === "+2") {
              expect(res.state.activeSeat).toBe(1);
            } else {
              expect(res.state.phase).toBe("wild_pending");
              expect(res.state.activeSeat).toBe(0);
            }
          } else {
            // Specifically: +2 onto a pending +4 is rejected.
            expect(res.ok).toBe(false);
          }
        },
      ),
      { numRuns: RUNS },
    );
  });
});

type CardKind = "+2" | "wild4";

describe("Feature: homemade-uno, Property 11: Penalty clears only by drawing", () => {
  it("across legal sequences, penaltyCount drops to 0 only via a targeted penalty draw", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 31 }), fc.integer({ min: 2, max: 8 }), (seed, count) => {
        const rng = createSeededRng(seed);
        const initial = deal({ mode: "normal", players: playerList(count) }, rng);

        let prev = initial;
        let steps = 0;
        runLegalSequence(initial, { rng }, MAX_STEPS, (state) => {
          if (steps > 0) {
            if (prev.penaltyCount > 0 && state.penaltyCount === 0) {
              // The only way the count cleared is a penalty draw: the targeted
              // seat's hand grew by exactly the old count and the turn advanced.
              const targetSeat = prev.activeSeat;
              const grew = state.hands[targetSeat].length - prev.hands[targetSeat].length;
              expect(grew).toBe(prev.penaltyCount);
              expect(state.activeSeat).not.toBe(prev.activeSeat);
            }
          }
          prev = state;
          steps++;
        });
      }),
      { numRuns: RUNS },
    );
  });

  it("a non-stacking response draws exactly penaltyCount, resets to 0, and advances", () => {
    const card: Card = { id: "unplayable", suit: "blue", value: 8 };
    const state = pendingPenaltyState(6, "four", card);
    const res = reducer(state, { type: "draw", playerId: "p0" }, { rng: createSeededRng(1) });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.hands[0].length).toBe(state.hands[0].length + 6);
    expect(res.state.penaltyCount).toBe(0);
    expect(res.state.pendingPenaltyKind).toBeNull();
    expect(res.state.activeSeat).toBe(1);
  });
});
