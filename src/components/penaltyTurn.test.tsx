import { makeGameView } from "@/game/view/fixtures";
import type { GameView, HandCardView } from "@/game/view/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GameTable } from "./GameTable";

/** A +2/+4 pending on you: stack with an eligible card, or take it from the deck. */
const base = makeGameView("03"); // your turn
const hand: HandCardView[] = [
  { id: "s", suit: "blue", value: "+2", playable: true },
  { id: "n", suit: "green", value: 9, playable: false },
];

function renderPenalty(over: Partial<GameView>) {
  render(<GameTable view={{ ...base, penaltyCount: 2, ...over }} highlight={false} />);
}

describe("GameTable — a +2/+4 pending on you", () => {
  it("only the cards that can stack are enabled (whatever the highlight setting)", () => {
    renderPenalty({ hand });
    expect(screen.getByRole("button", { name: /^Blue draw two/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /^Green 9/ })).toBeDisabled();
  });

  it("marks the deck so you can take the cards instead of stacking", () => {
    renderPenalty({ hand });
    expect(screen.getByRole("button", { name: "Draw 2 cards" })).toBeEnabled();
    expect(screen.getByText("Draw 2")).toBeInTheDocument();
  });

  it("says it is drawing for you when nothing can stack", () => {
    renderPenalty({ hand: [hand[1]] });
    expect(screen.getByText("Nothing to stack · drawing 2")).toBeInTheDocument();
  });
});
