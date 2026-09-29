import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { reducer } from "./reducer";
import { createSeededRng } from "./rng";
import { discardTop, isLegalPlay } from "./rules";
import { ALL_SUITS, makeState } from "./testkit";
import type { Card, CardValue, Seat, Suit } from "./types";

const RUNS = 100;

const twoSeats: Seat[] = [
  { playerId: "p0", seat: 0 },
  { playerId: "p1", seat: 1 },
];

const suitArb = fc.constantFrom<Suit>(...ALL_SUITS);
const nonWildValueArb = fc.constantFrom<CardValue>(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, "+2", "skip", "reverse");

describe("Feature: homemade-uno, Property 8: Match legality", () => {
  it("accepts a non-wild play only on suit/value match; rejections leave state unchanged", () => {
    fc.assert(
      fc.property(
        suitArb,
        nonWildValueArb,
        suitArb,
        nonWildValueArb,
        (activeColor, topValue, cardSuit, cardValue) => {
          const topSuit: Suit = "red";
          const card: Card = { id: "c", suit: cardSuit, value: cardValue };
          const state = makeState({
            seats: twoSeats,
            // p0 also holds a filler so playing `card` never ends the game.
            hands: [[card, { id: "keep", suit: "blue", value: 8 }], [{ id: "x", suit: "green", value: 1 }]],
            discardPile: [{ id: "top", suit: topSuit, value: topValue }],
            activeColor,
          });

          const legal = cardSuit === activeColor || cardValue === topValue;
          expect(isLegalPlay(card, state)).toBe(legal);

          const before = JSON.stringify(state);
          const res = reducer(state, { type: "play", playerId: "p0", cardId: "c" }, { rng: createSeededRng(1) });

          if (legal) {
            expect(res.ok).toBe(true);
            if (res.ok) {
              expect(discardTop(res.state)).toEqual(card);
              expect(res.state.activeColor).toBe(cardSuit);
            }
          } else {
            expect(res.ok).toBe(false);
            // hand, discard top, active color, active seat all unchanged.
            expect(JSON.stringify(state)).toBe(before);
          }
        },
      ),
      { numRuns: RUNS },
    );
  });
});

describe("Feature: homemade-uno, Property 9: Wild selection sets the active color", () => {
  it("after playing a wild/wild4 and choosing suit S, the active color is exactly S", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<CardValue>("wild", "wild4"),
        suitArb,
        (wildValue, chosen) => {
          const wild: Card = { id: "w", value: wildValue };
          const state = makeState({
            seats: twoSeats,
            hands: [[wild, { id: "keep", suit: "red", value: 2 }], [{ id: "x", suit: "red", value: 4 }]],
            discardPile: [{ id: "top", suit: "red", value: 5 }],
            activeColor: "red",
          });

          const played = reducer(state, { type: "play", playerId: "p0", cardId: "w" }, { rng: createSeededRng(1) });
          expect(played.ok).toBe(true);
          if (!played.ok) return;
          expect(played.state.phase).toBe("wild_pending");

          const colored = reducer(
            played.state,
            { type: "choose_color", playerId: "p0", color: chosen },
            { rng: createSeededRng(1) },
          );
          expect(colored.ok).toBe(true);
          if (!colored.ok) return;
          expect(colored.state.activeColor).toBe(chosen);
        },
      ),
      { numRuns: RUNS },
    );
  });
});
