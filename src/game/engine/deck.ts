import type { Card, NumberValue, Rng, Suit } from "./types";

/** The four suits, in a stable order used for deck construction. */
export const SUITS: readonly Suit[] = ["red", "yellow", "green", "blue"];

/**
 * Build the standard 108-card deck.
 *
 * Per suit: one `0`, two each of `1`–`9`, two `+2`, two `skip`, two `reverse`.
 * Plus 4 `wild` and 4 `wild4`. Total = 4×(1 + 18 + 2 + 2 + 2) + 8 = 108.
 *
 * Every card gets a stable, unique `id`. The order is deterministic; callers
 * shuffle with {@link shuffle} using an injected RNG.
 */
export function buildDeck(): Card[] {
  const cards: Card[] = [];

  for (const suit of SUITS) {
    // One 0 per suit.
    cards.push({ id: `${suit}-0-a`, suit, value: 0 });

    // Two each of 1–9.
    for (let n = 1 as NumberValue; n <= 9; n = (n + 1) as NumberValue) {
      cards.push({ id: `${suit}-${n}-a`, suit, value: n });
      cards.push({ id: `${suit}-${n}-b`, suit, value: n });
    }

    // Two each of +2, skip, reverse.
    for (const value of ["+2", "skip", "reverse"] as const) {
      cards.push({ id: `${suit}-${value}-a`, suit, value });
      cards.push({ id: `${suit}-${value}-b`, suit, value });
    }
  }

  // Four wild and four wild4 (no suit).
  for (let i = 0; i < 4; i++) {
    cards.push({ id: `wild-${i}`, value: "wild" });
    cards.push({ id: `wild4-${i}`, value: "wild4" });
  }

  return cards;
}

/**
 * Fisher–Yates shuffle using an injected {@link Rng}. Returns a new array; the
 * input is not mutated. Deterministic given the same RNG sequence.
 */
export function shuffle<T>(cards: readonly T[], rng: Rng): T[] {
  const out = cards.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/** True when the card is a plain number card (0–9). */
export function isNumberCard(card: Card): boolean {
  return typeof card.value === "number";
}

/** True when the card is a wild or wild4 (no suit). */
export function isWildCard(card: Card): boolean {
  return card.value === "wild" || card.value === "wild4";
}
