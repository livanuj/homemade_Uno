import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildDeck } from "./deck";
import type { CardValue } from "./types";

const RUNS = 100;

/**
 * The exact expected multiset of the 108-card deck, keyed by "suit|value" for
 * suited cards and "wild"/"wild4" for wilds.
 */
function expectedCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const suit of ["red", "yellow", "green", "blue"] as const) {
    counts.set(`${suit}|0`, 1);
    for (let n = 1; n <= 9; n++) counts.set(`${suit}|${n}`, 2);
    counts.set(`${suit}|+2`, 2);
    counts.set(`${suit}|skip`, 2);
    counts.set(`${suit}|reverse`, 2);
  }
  counts.set("wild", 4);
  counts.set("wild4", 4);
  return counts;
}

function keyOf(suit: string | undefined, value: CardValue): string {
  if (value === "wild" || value === "wild4") return value;
  return `${suit}|${value}`;
}

describe("Feature: homemade-uno, Property 1: Deck composition", () => {
  it("a freshly built deck is exactly the 108-card multiset with unique ids", () => {
    fc.assert(
      // buildDeck takes no input; the seed varies the run but the output is
      // constant — the property asserts that constant is the exact deck.
      fc.property(fc.integer(), () => {
        const deck = buildDeck();

        expect(deck).toHaveLength(108);

        // No duplicate ids.
        const ids = new Set(deck.map((c) => c.id));
        expect(ids.size).toBe(108);

        // Exact multiset by suit/value.
        const counts = new Map<string, number>();
        for (const card of deck) {
          const k = keyOf(card.suit, card.value);
          counts.set(k, (counts.get(k) ?? 0) + 1);
        }
        expect(counts).toEqual(expectedCounts());
      }),
      { numRuns: RUNS },
    );
  });
});
