import { describe, expect, it } from "vitest";
import { deal } from "./deal";
import { buildDeck, isNumberCard } from "./deck";
import { reducer } from "./reducer";
import { createSeededRng } from "./rng";
import { discardTop } from "./rules";
import { makeState } from "./testkit";
import type { EngineContext, Seat } from "./types";

const ctx = (): EngineContext => ({ rng: createSeededRng(42) });

const twoSeats: Seat[] = [
  { playerId: "p0", seat: 0 },
  { playerId: "p1", seat: 1 },
];

describe("engine unit — reverse & skip in the exact-2-player case", () => {
  it("reverse returns the turn to the same player and keeps direction", () => {
    const state = makeState({
      seats: twoSeats,
      hands: [
        [{ id: "r", suit: "red", value: "reverse" }, { id: "k", suit: "red", value: 3 }],
        [{ id: "x", suit: "red", value: 1 }],
      ],
      discardPile: [{ id: "top", suit: "red", value: 5 }],
      activeColor: "red",
    });
    const res = reducer(state, { type: "play", playerId: "p0", cardId: "r" }, ctx());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.direction).toBe(1);
    expect(res.state.activeSeat).toBe(0);
  });

  it("skip returns the turn to the same player", () => {
    const state = makeState({
      seats: twoSeats,
      hands: [
        [{ id: "s", suit: "red", value: "skip" }, { id: "k", suit: "red", value: 3 }],
        [{ id: "x", suit: "red", value: 1 }],
      ],
      discardPile: [{ id: "top", suit: "red", value: 5 }],
      activeColor: "red",
    });
    const res = reducer(state, { type: "play", playerId: "p0", cardId: "s" }, ctx());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.activeSeat).toBe(0);
  });
});

describe("engine unit — initial-discard reshuffle when the flipped card is an action card", () => {
  it("always turns up a number card as the initial discard across many seeds", () => {
    for (let seed = 0; seed < 50; seed++) {
      const state = deal({ mode: "normal", players: [{ playerId: "p0" }, { playerId: "p1" }] }, createSeededRng(seed));
      expect(isNumberCard(discardTop(state))).toBe(true);
    }
  });
});

describe("engine unit — asymmetric stacking (+2 onto +4 rejected, wild4 onto +2 accepted)", () => {
  const threeSeats: Seat[] = [
    { playerId: "p0", seat: 0 },
    { playerId: "p1", seat: 1 },
    { playerId: "p2", seat: 2 },
  ];

  it("rejects a +2 played onto a pending +4", () => {
    const state = makeState({
      seats: threeSeats,
      hands: [
        [{ id: "two", suit: "red", value: "+2" }, { id: "f", suit: "red", value: 6 }],
        [{ id: "a", suit: "red", value: 1 }],
        [{ id: "b", suit: "red", value: 2 }],
      ],
      discardPile: [{ id: "top", value: "wild4" }],
      activeColor: "red",
      penaltyCount: 4,
      pendingPenaltyKind: "four",
    });
    const res = reducer(state, { type: "play", playerId: "p0", cardId: "two" }, ctx());
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("illegal_stack");
  });

  it("accepts a wild4 played onto a pending +2 and adds 4", () => {
    const state = makeState({
      seats: threeSeats,
      hands: [
        [{ id: "w4", value: "wild4" }, { id: "f", suit: "red", value: 6 }],
        [{ id: "a", suit: "red", value: 1 }],
        [{ id: "b", suit: "red", value: 2 }],
      ],
      discardPile: [{ id: "top", suit: "red", value: "+2" }],
      activeColor: "red",
      penaltyCount: 2,
      pendingPenaltyKind: "two",
    });
    const res = reducer(state, { type: "play", playerId: "p0", cardId: "w4" }, ctx());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.penaltyCount).toBe(6);
    expect(res.state.phase).toBe("wild_pending");
  });
});

describe("engine unit — reshuffle-on-empty vs. no-draw (only top)", () => {
  it("reshuffles the discard (except top) into the draw pile when empty and ≥2 discards", () => {
    const state = makeState({
      seats: twoSeats,
      hands: [[{ id: "h0", suit: "green", value: 9 }], [{ id: "h1", suit: "green", value: 8 }]],
      drawPile: [],
      discardPile: [
        { id: "d1", suit: "blue", value: 1 },
        { id: "d2", suit: "blue", value: 2 },
        { id: "top", suit: "red", value: 5 },
      ],
      activeColor: "red",
    });
    const before = state.hands[0].length;
    const res = reducer(state, { type: "draw", playerId: "p0" }, ctx());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // Drew one card (from the reshuffled pile); discard is just the top again.
    expect(res.state.discardPile).toHaveLength(1);
    expect(res.state.discardPile[0].id).toBe("top");
    // Either kept-and-advanced or a drew_decision, but the hand grew by one.
    const grew = res.state.hands[0].length - before;
    expect(grew).toBe(1);
  });

  it("completes the turn without drawing when the pile is empty and only the top remains", () => {
    const state = makeState({
      seats: twoSeats,
      hands: [[{ id: "h0", suit: "green", value: 9 }], [{ id: "h1", suit: "green", value: 8 }]],
      drawPile: [],
      discardPile: [{ id: "top", suit: "red", value: 5 }],
      activeColor: "red",
    });
    const res = reducer(state, { type: "draw", playerId: "p0" }, ctx());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // No card drawn; hands and discard unchanged; turn advanced.
    expect(res.state.hands[0]).toHaveLength(1);
    expect(res.state.discardPile).toHaveLength(1);
    expect(res.state.activeSeat).toBe(1);
  });
});

describe("engine unit — last-card penalty ending a turn at 1 card without calling", () => {
  it("draws 2 when the player ends the turn holding 1 card and never called", () => {
    const state = makeState({
      seats: twoSeats,
      hands: [
        [{ id: "play", suit: "red", value: 4 }, { id: "left", suit: "red", value: 7 }],
        [{ id: "x", suit: "red", value: 1 }],
      ],
      drawPile: [
        { id: "p1", suit: "blue", value: 1 },
        { id: "p2", suit: "blue", value: 2 },
      ],
      discardPile: [{ id: "top", suit: "red", value: 5 }],
      activeColor: "red",
    });
    const res = reducer(state, { type: "play", playerId: "p0", cardId: "play" }, ctx());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.hands[0]).toHaveLength(3); // 2 - 1 played + 2 penalty
  });
});

describe("engine unit — winning wild requires color before the win resolves", () => {
  it("a wild that empties the hand stays wild_pending until a color is chosen", () => {
    const state = makeState({
      seats: twoSeats,
      hands: [[{ id: "w", value: "wild" }], [{ id: "x", suit: "red", value: 1 }]],
      discardPile: [{ id: "top", suit: "red", value: 5 }],
      activeColor: "red",
      lastCardCalledSeat: 0,
    });
    const played = reducer(state, { type: "play", playerId: "p0", cardId: "w" }, ctx());
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    // The win has NOT resolved yet — color is still required.
    expect(played.state.phase).toBe("wild_pending");
    expect(played.state.winner).toBeNull();

    const colored = reducer(played.state, { type: "choose_color", playerId: "p0", color: "blue" }, ctx());
    expect(colored.ok).toBe(true);
    if (!colored.ok) return;
    expect(colored.state.phase).toBe("ended");
    expect(colored.state.activeColor).toBe("blue");
    expect(colored.state.winner).toEqual({ kind: "player", seat: 0, playerId: "p0" });
  });
});

describe("engine unit — deck sanity", () => {
  it("buildDeck has 108 unique-id cards", () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(108);
    expect(new Set(deck.map((c) => c.id)).size).toBe(108);
  });
});
