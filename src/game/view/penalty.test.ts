import { describe, expect, it } from "vitest";
import { makeGameView } from "./fixtures";
import { penaltyPrompt } from "./penalty";
import type { GameView, HandCardView } from "./types";

const base = makeGameView("03"); // your turn
const card = (id: string, playable: boolean): HandCardView => ({
  id,
  suit: "red",
  value: "+2",
  playable,
});

function view(over: Partial<GameView>): GameView {
  return { ...base, ...over };
}

describe("penaltyPrompt", () => {
  it("is null when no +2/+4 is pending on you", () => {
    expect(penaltyPrompt(view({ penaltyCount: 0 }))).toBeNull();
    expect(
      penaltyPrompt(view({ penaltyCount: 2, activeSeatId: base.opponents[0].id })),
    ).toBeNull();
  });

  it("offers stacking when you hold a card that can go on it", () => {
    expect(
      penaltyPrompt(view({ penaltyCount: 4, hand: [card("a", true), card("b", false)] })),
    ).toEqual({ count: 4, canStack: true });
  });

  it("says you can't stack when nothing in your hand can go on it", () => {
    expect(
      penaltyPrompt(view({ penaltyCount: 2, hand: [card("a", false)] })),
    ).toEqual({ count: 2, canStack: false });
  });
});
