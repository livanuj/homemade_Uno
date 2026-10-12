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

describe("engine unit — last card: call it, or get caught", () => {
  const threeSeats: Seat[] = [
    { playerId: "p0", seat: 0 },
    { playerId: "p1", seat: 1 },
    { playerId: "p2", seat: 2 },
  ];
  const teamSeats: Seat[] = [
    { playerId: "a0", seat: 0, team: "A" },
    { playerId: "b0", seat: 1, team: "B" },
    { playerId: "a1", seat: 2, team: "A" },
    { playerId: "b1", seat: 3, team: "B" },
  ];
  const drawPile = [
    { id: "d0", suit: "blue", value: 0 },
    { id: "d1", suit: "blue", value: 1 },
    { id: "d2", suit: "blue", value: 2 },
  ] as const;

  /** p0 holds 2 cards and plays one, leaving 1 card and the turn with p1. */
  const playedDownToOne = (called: boolean) => {
    const state = makeState({
      seats: threeSeats,
      hands: [
        [{ id: "play", suit: "red", value: 4 }, { id: "left", suit: "green", value: 7 }],
        [{ id: "x", suit: "green", value: 1 }, { id: "y", suit: "green", value: 2 }],
        [{ id: "z", suit: "green", value: 3 }, { id: "w", suit: "green", value: 6 }],
      ],
      drawPile: [...drawPile],
      discardPile: [{ id: "top", suit: "red", value: 5 }],
      activeColor: "red",
      lastCardCalledSeats: called ? [0] : [],
    });
    const res = reducer(state, { type: "play", playerId: "p0", cardId: "play" }, ctx());
    if (!res.ok) throw new Error(`play rejected: ${res.reason}`);
    return res.state;
  };

  it("ending a turn on 1 card without calling draws NO automatic penalty", () => {
    const state = playedDownToOne(false);
    expect(state.hands[0]).toHaveLength(1);
    expect(state.activeSeat).toBe(1);
    expect(state.lastCardCalledSeats).toEqual([]);
  });

  it("an opponent catching an uncalled 1-card player makes them draw 2; the turn is unchanged", () => {
    const state = playedDownToOne(false);
    const res = reducer(state, { type: "catch_last", playerId: "p2", targetPlayerId: "p0" }, ctx());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.hands[0]).toHaveLength(3);
    expect(res.state.activeSeat).toBe(1);
    expect(res.state.phase).toBe("active");
    expect(res.state.drawPile).toHaveLength(1);
  });

  it("the second catch of the same player is rejected (first catch wins)", () => {
    const caught = reducer(playedDownToOne(false), { type: "catch_last", playerId: "p1", targetPlayerId: "p0" }, ctx());
    if (!caught.ok) throw new Error("first catch rejected");
    const again = reducer(caught.state, { type: "catch_last", playerId: "p2", targetPlayerId: "p0" }, ctx());
    expect(again).toEqual({ ok: false, reason: "not_catchable" });
  });

  it("a player who called before playing cannot be caught", () => {
    const res = reducer(playedDownToOne(true), { type: "catch_last", playerId: "p1", targetPlayerId: "p0" }, ctx());
    expect(res).toEqual({ ok: false, reason: "not_catchable" });
  });

  it("the 1-card player can call late, on someone else's turn, and is then safe", () => {
    const state = playedDownToOne(false);
    const called = reducer(state, { type: "call_last", playerId: "p0" }, ctx());
    expect(called.ok).toBe(true);
    if (!called.ok) return;
    expect(called.state.lastCardCalledSeats).toEqual([0]);
    const caught = reducer(called.state, { type: "catch_last", playerId: "p1", targetPlayerId: "p0" }, ctx());
    expect(caught).toEqual({ ok: false, reason: "not_catchable" });
  });

  it("calling twice is rejected", () => {
    const called = reducer(playedDownToOne(false), { type: "call_last", playerId: "p0" }, ctx());
    if (!called.ok) throw new Error("call rejected");
    expect(reducer(called.state, { type: "call_last", playerId: "p0" }, ctx())).toEqual({
      ok: false,
      reason: "already_called",
    });
  });

  it("calling off-turn with more than 1 card is rejected", () => {
    const state = playedDownToOne(false);
    expect(reducer(state, { type: "call_last", playerId: "p2" }, ctx())).toEqual({
      ok: false,
      reason: "not_two_cards",
    });
  });

  it("a player cannot catch themselves, and players with 2+ cards are not catchable", () => {
    const state = playedDownToOne(false);
    expect(reducer(state, { type: "catch_last", playerId: "p0", targetPlayerId: "p0" }, ctx())).toEqual({
      ok: false,
      reason: "not_catchable",
    });
    expect(reducer(state, { type: "catch_last", playerId: "p0", targetPlayerId: "p1" }, ctx())).toEqual({
      ok: false,
      reason: "not_catchable",
    });
  });

  it("in Team mode a partner cannot catch; an opponent can", () => {
    const state = makeState({
      mode: "team",
      seats: teamSeats,
      hands: [
        [{ id: "solo", suit: "green", value: 7 }],
        [{ id: "x", suit: "green", value: 1 }, { id: "y", suit: "green", value: 2 }],
        [{ id: "z", suit: "green", value: 3 }, { id: "w", suit: "green", value: 6 }],
        [{ id: "u", suit: "green", value: 8 }, { id: "v", suit: "green", value: 9 }],
      ],
      drawPile: [...drawPile],
      discardPile: [{ id: "top", suit: "red", value: 5 }],
      activeColor: "red",
      activeSeat: 1,
    });
    expect(reducer(state, { type: "catch_last", playerId: "a1", targetPlayerId: "a0" }, ctx())).toEqual({
      ok: false,
      reason: "not_catchable",
    });
    const res = reducer(state, { type: "catch_last", playerId: "b1", targetPlayerId: "a0" }, ctx());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.hands[0]).toHaveLength(3);
  });

  it("a recorded call clears once that player draws (hand grows above 1)", () => {
    // p0 called on 1 card and it is their turn again with nothing to play.
    const state = makeState({
      seats: twoSeats,
      hands: [[{ id: "solo", suit: "green", value: 7 }], [{ id: "x", suit: "green", value: 1 }, { id: "y", suit: "blue", value: 2 }]],
      drawPile: [{ id: "d0", suit: "red", value: 9 }],
      discardPile: [{ id: "top", suit: "red", value: 5 }],
      activeColor: "red",
      lastCardCalledSeats: [0],
    });
    const drew = reducer(state, { type: "draw", playerId: "p0" }, ctx());
    expect(drew.ok).toBe(true);
    if (!drew.ok) return;
    expect(drew.state.phase).toBe("drew_decision");
    expect(drew.state.lastCardCalledSeats).toEqual([]);
    // Playing the drawn card puts them back on 1 card, uncalled → catchable.
    const played = reducer(drew.state, { type: "play", playerId: "p0", cardId: "d0" }, ctx());
    if (!played.ok) throw new Error("play rejected");
    const caught = reducer(played.state, { type: "catch_last", playerId: "p1", targetPlayerId: "p0" }, ctx());
    expect(caught.ok).toBe(true);
  });
});

describe("engine unit — drew a playable card: play it or keep it", () => {
  const drewPlayable = () => {
    const state = makeState({
      seats: twoSeats,
      hands: [
        [
          { id: "a", suit: "blue", value: 1 },
          { id: "b", suit: "green", value: 2 },
        ],
        [{ id: "x", suit: "red", value: 1 }],
      ],
      drawPile: [{ id: "drawn", suit: "red", value: 3 }],
      discardPile: [{ id: "top", suit: "red", value: 5 }],
      activeColor: "red",
    });
    const drew = reducer(state, { type: "draw", playerId: "p0" }, ctx());
    if (!drew.ok) throw new Error("draw rejected");
    expect(drew.state.phase).toBe("drew_decision");
    return drew.state;
  };

  it("'Play it' plays the drawn card and advances the turn", () => {
    const res = reducer(drewPlayable(), { type: "play", playerId: "p0", cardId: "drawn" }, ctx());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(discardTop(res.state).id).toBe("drawn");
    expect(res.state.hands[0].map((c) => c.id)).toEqual(["a", "b"]);
    expect(res.state.phase).toBe("active");
    expect(res.state.activeSeat).toBe(1);
  });

  it("only the drawn card may be played during the decision", () => {
    const res = reducer(drewPlayable(), { type: "play", playerId: "p0", cardId: "a" }, ctx());
    expect(res).toEqual({ ok: false, reason: "wrong_phase" });
  });

  it("'Keep it' keeps the drawn card and advances the turn", () => {
    const res = reducer(drewPlayable(), { type: "keep", playerId: "p0" }, ctx());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.hands[0].map((c) => c.id)).toEqual(["a", "b", "drawn"]);
    expect(res.state.activeSeat).toBe(1);
  });
});

describe("engine unit — winning wild requires color before the win resolves", () => {
  it("a wild that empties the hand stays wild_pending until a color is chosen", () => {
    const state = makeState({
      seats: twoSeats,
      hands: [[{ id: "w", value: "wild" }], [{ id: "x", suit: "red", value: 1 }]],
      discardPile: [{ id: "top", suit: "red", value: 5 }],
      activeColor: "red",
      lastCardCalledSeats: [0],
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
