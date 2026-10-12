import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildDeck, isNumberCard } from "./deck";
import { deal } from "./deal";
import { createSeededRng } from "./rng";
import { discardTop } from "./rules";
import { cardIdMultiset, playerList } from "./testkit";
import type { GameMode } from "./types";

const RUNS = 100;

const expectedIds = () => buildDeck().map((c) => c.id).sort();

describe("Feature: homemade-uno, Property 2: Card conservation (after dealing)", () => {
  it("hands + draw + discard equal the 108-card deck with unique ids", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 ** 31 }),
        fc.constantFrom<GameMode>("normal", "team"),
        fc.integer({ min: 2, max: 8 }),
        (seed, mode, rawCount) => {
          const count = mode === "team" ? 4 : rawCount;
          const state = deal({ mode, players: playerList(count) }, createSeededRng(seed));

          expect(cardIdMultiset(state)).toEqual(expectedIds());
          // Each player holds 7; the initial discard is one number card.
          for (const hand of state.hands) expect(hand).toHaveLength(7);
          expect(isNumberCard(discardTop(state))).toBe(true);
        },
      ),
      { numRuns: RUNS },
    );
  });
});

describe("Feature: homemade-uno, Property 3: Team seat alternation", () => {
  it("seats alternate A/B so each partner sits opposite", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 31 }), (seed) => {
        const state = deal({ mode: "team", players: playerList(4) }, createSeededRng(seed));

        expect(state.seats.map((s) => s.team)).toEqual(["A", "B", "A", "B"]);
        // Partners sit opposite: seat i and seat i+2 share a team.
        expect(state.seats[0].team).toBe(state.seats[2].team);
        expect(state.seats[1].team).toBe(state.seats[3].team);
        expect(state.seats[0].team).not.toBe(state.seats[1].team);
      }),
      { numRuns: RUNS },
    );
  });
});
