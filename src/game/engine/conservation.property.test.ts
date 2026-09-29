import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildDeck } from "./deck";
import { deal } from "./deal";
import { createSeededRng } from "./rng";
import { cardIdMultiset, playerList, runLegalSequence } from "./testkit";
import type { GameMode } from "./types";

const RUNS = 100;
const MAX_STEPS = 80;

const expectedIds = () => buildDeck().map((c) => c.id).sort();

describe("Feature: homemade-uno, Property 2: Card conservation", () => {
  it("after every legal action the union of hands+draw+discard is the 108-card deck (unique ids)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 ** 31 }),
        fc.constantFrom<GameMode>("normal", "team"),
        fc.integer({ min: 2, max: 8 }),
        (seed, mode, rawCount) => {
          const count = mode === "team" ? 4 : rawCount;
          const rng = createSeededRng(seed);
          const initial = deal({ mode, players: playerList(count) }, rng);
          const expected = expectedIds();

          runLegalSequence(initial, { rng }, MAX_STEPS, (state) => {
            expect(cardIdMultiset(state)).toEqual(expected);
          });
        },
      ),
      { numRuns: RUNS },
    );
  });
});
