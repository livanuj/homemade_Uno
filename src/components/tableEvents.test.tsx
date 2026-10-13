import { makeGameView } from "@/game/view/fixtures";
import type { GameView } from "@/game/view/types";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameTable } from "./GameTable";

/**
 * Skip and reverse callouts (Req 6.2–6.5): every screen sees them, and the
 * skipped player sees their own stamp. Normal fixture: You, then Leo, Nora,
 * Omar, Sara clockwise; it is Nora's turn.
 */
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const base = makeGameView("04");
const order = [base.selfId, ...base.opponents.map((o) => o.id)];
const idOf = (name: string) => base.opponents.find((o) => o.name === name)!.id;

function play(next: Partial<GameView>) {
  const { rerender } = render(<GameTable view={base} />);
  rerender(<GameTable view={{ ...base, ...next }} />);
}

describe("GameTable — skip and reverse callouts", () => {
  it("shows everyone who was skipped, with a badge on their seat", () => {
    // Nora plays a skip: Omar (next clockwise) is skipped; Sara is up.
    play({
      discardTop: { id: "s1", suit: "green", value: "skip" },
      activeSeatId: idOf("Sara"),
    });
    expect(screen.getByText("Omar is skipped")).toBeInTheDocument();
    expect(screen.getByText("Skipped")).toBeInTheDocument();
  });

  it("stamps the skipped player's own screen", () => {
    // Counter-clockwise from Leo, the next player is You.
    const { rerender } = render(
      <GameTable view={{ ...base, activeSeatId: idOf("Leo"), direction: -1 }} />,
    );
    rerender(
      <GameTable
        view={{
          ...base,
          activeSeatId: idOf("Sara"),
          direction: -1,
          discardTop: { id: "s2", suit: "green", value: "skip" },
        }}
      />,
    );
    expect(screen.getByText("You're skipped!")).toBeInTheDocument();
  });

  it("announces a reverse with the new direction, then clears", () => {
    play({
      discardTop: { id: "r1", suit: "green", value: "reverse" },
      direction: -1,
      activeSeatId: order[2],
    });
    expect(
      screen.getByText("Reversed · now counter-clockwise"),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Reversed · now counter-clockwise",
    );
    // The callout's time is up: the event clears (its exit animation runs in
    // the browser; the live region drops it at once).
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByRole("status")).not.toHaveTextContent("Reversed");
  });
});
