import { GameTable } from "@/components/GameTable";
import { makeGameView } from "@/game/view/fixtures";
import type { GameView, HandCardView } from "@/game/view/types";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { GameRoute } from "./GameRoute";

/**
 * Tests for the game table (screens `03-game-2v2` / `04-game-normal`, task
 * 8.4). The view-model comes from the fixtures seam keyed by `?state=`, so a
 * route reaches each screen; a few cases render `GameTable` directly with a
 * tailored `GameView` to exercise the last-card and Highlight edge cases.
 */

function renderGame(state: string) {
  render(
    <MemoryRouter initialEntries={[`/room/K7QX/game?state=${state}`]}>
      <GameRoute />
    </MemoryRouter>,
  );
}

describe("GameRoute — 2v2 table (03)", () => {
  it("renders the partner's hand FACE-UP with accessible card labels (Req 13.1/13.2)", () => {
    renderGame("03");
    // Maya's partner hand is face-up: each card carries its "<Suit> <Value>"
    // aria-label — a face-down back never would.
    expect(
      screen.getByRole("button", { name: "Yellow 5" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Blue 8" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Red draw two" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Partner · 5 cards")).toBeInTheDocument();
  });

  it("renders opponents as face-down backs with their real count badges (Req 13.3/13.4/13.5)", () => {
    renderGame("03");
    // Opponents are named and their real counts (6, 4) show as badges even
    // though ≤7 backs are drawn. Scope each assertion to the opponent's seat so
    // a stray "4" on a card face (Blue 4 in hand) can't satisfy the badge.
    const leoSeat = screen.getByText("Leo").closest("div") as HTMLElement;
    expect(within(leoSeat).getByText("6")).toBeInTheDocument();
    const saraSeat = screen.getByText("Sara").closest("div") as HTMLElement;
    expect(within(saraSeat).getByText("4")).toBeInTheDocument();
    // The opponents are face-down: none of their cards expose a face-up
    // "<Suit> <Value>" button (only your hand + the partner's do).
    expect(
      screen.queryByRole("button", { name: "Blue 8" }),
    ).toBeInTheDocument(); // partner card is face-up
    expect(within(leoSeat).queryAllByRole("button")).toHaveLength(0);
  });

  it("shows the '2v2 · Round N' mode chip (Req 12.6)", () => {
    renderGame("03");
    expect(screen.getByText("2v2 · Round 1")).toBeInTheDocument();
  });

  it("dims the unplayable hand cards when Highlight is on (Req 7.5/7.6)", () => {
    renderGame("03");
    // The fixture's unplayable blue 4 is dimmed; the selected red skip is not.
    const unplayable = screen.getByRole("button", { name: "Blue 4" });
    expect(unplayable.className).toContain("brightness-55");
    const playable = screen.getByRole("button", { name: "Red skip" });
    expect(playable.className).not.toContain("brightness-55");
  });
});

describe("GameRoute — normal table (04)", () => {
  it("renders every opponent as a face-down back (no face-up opponent cards)", () => {
    renderGame("04");
    expect(screen.getByText("Nora")).toBeInTheDocument();
    expect(screen.getByText("Omar")).toBeInTheDocument();
    expect(screen.getByText("Leo")).toBeInTheDocument();
    expect(screen.getByText("Sara")).toBeInTheDocument();
    // There is no partner meta line in Normal mode.
    expect(screen.queryByText(/^Partner ·/)).not.toBeInTheDocument();
  });

  it("names the active player in the turn pill (Req 6.4/6.5)", () => {
    renderGame("04");
    expect(
      screen.getByText("Nora's turn · color is green"),
    ).toBeInTheDocument();
  });

  it("shows the 'Normal · N players' mode chip", () => {
    renderGame("04");
    expect(screen.getByText("Normal · 5 players")).toBeInTheDocument();
  });
});

describe("GameTable — UNO button enablement (Req 11.1)", () => {
  function viewWithHand(hand: HandCardView[], canCall: boolean): GameView {
    const base = makeGameView("04");
    return { ...base, hand, canCallLastCard: canCall };
  }

  it("hides UNO while the hand holds more than two cards", () => {
    render(
      <GameTable
        view={viewWithHand(
          [
            { id: "a", suit: "red", value: 5, playable: true },
            { id: "b", suit: "blue", value: 1, playable: true },
            { id: "c", suit: "green", value: 9, playable: true },
          ],
          false,
        )}
      />,
    );
    expect(screen.queryByRole("button", { name: "UNO" })).not.toBeInTheDocument();
  });

  it("shows UNO (disabled) at two cards when it can't be called yet", () => {
    render(
      <GameTable
        view={viewWithHand(
          [
            { id: "a", suit: "red", value: 5, playable: true },
            { id: "b", suit: "blue", value: 1, playable: true },
          ],
          false,
        )}
      />,
    );
    const uno = screen.getByRole("button", { name: "UNO" });
    expect(uno).toBeDisabled();
    // Visibly different from the callable state: faint outline, not red.
    expect(uno.className).toContain("text-ink-faint");
    expect(uno.className).not.toContain("bg-suit-red");
  });

  it("enables UNO only at exactly two cards on your turn, as a round button", () => {
    render(
      <GameTable
        view={viewWithHand(
          [
            { id: "a", suit: "red", value: 5, playable: true },
            { id: "b", suit: "blue", value: 1, playable: true },
          ],
          true,
        )}
      />,
    );
    const uno = screen.getByRole("button", { name: "UNO" });
    expect(uno).toBeEnabled();
    expect(uno.className).toContain("size-14");
    expect(uno.className).toContain("bg-suit-red");
    expect(uno.className).toContain("rounded-full");
  });
});

describe("GameTable — catch an uncalled last card (Req 11.3)", () => {
  it("shows no catch button when nobody is catchable", () => {
    render(<GameTable view={makeGameView("04")} />);
    expect(screen.queryByRole("button", { name: /^Catch / })).not.toBeInTheDocument();
  });

  it("shows a catch button per catchable opponent and reports who was caught", () => {
    const onCatch = vi.fn();
    const view: GameView = {
      ...makeGameView("04"),
      catchTargets: [
        { id: "p1", name: "Nora" },
        { id: "p2", name: "Leo" },
      ],
    };
    render(<GameTable view={view} onCatch={onCatch} />);
    fireEvent.click(screen.getByRole("button", { name: "Catch Leo!" }));
    expect(onCatch).toHaveBeenCalledWith("p2");
    expect(screen.getByRole("button", { name: "Catch Nora!" })).toBeInTheDocument();
  });
});

describe("GameTable — opponent card flights (Req 10.6 / 17.2)", () => {
  it("keeps the old discard top showing while an opponent's played card flies in", () => {
    const before = makeGameView("04"); // Nora's turn, green 3 on top
    const { rerender, container } = render(<GameTable view={before} reduced={false} />);
    const after: GameView = {
      ...before,
      activeSeatId: "omar",
      discardTop: { id: "played", suit: "blue", value: 3 },
      discardPrev: before.discardTop,
      opponents: before.opponents.map((o) =>
        o.id === "nora" ? { ...o, cardCount: o.cardCount - 1 } : o,
      ),
    };
    rerender(<GameTable view={after} reduced={false} />);
    // The pile still shows green 3; the only blue 3 is the in-flight card.
    const flightLayer = container.querySelector("[aria-hidden='true'].pointer-events-none")!;
    expect(within(flightLayer as HTMLElement).getByLabelText("Blue 3")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Blue 3")).toHaveLength(1);
    expect(screen.getByLabelText("Green 3")).toBeInTheDocument();
  });

  it("flies one back per card an opponent draws", () => {
    const before = makeGameView("04");
    const { rerender, container } = render(<GameTable view={before} reduced={false} />);
    const after: GameView = {
      ...before,
      opponents: before.opponents.map((o) =>
        o.id === "nora" ? { ...o, cardCount: o.cardCount + 4 } : o,
      ),
    };
    rerender(<GameTable view={after} reduced={false} />);
    const flightLayer = container.querySelector("[aria-hidden='true'].pointer-events-none")!;
    expect(flightLayer.children).toHaveLength(4);
    // Nora's seat still shows her old 5 cards until the flying ones land.
    const seat = screen.getByText("Nora").parentElement!;
    expect(within(seat).getByText("5")).toBeInTheDocument();
    expect(seat.querySelectorAll("[aria-label='Face-down card']")).toHaveLength(5);
  });
});

describe("GameTable — Highlight setting off (Req 7.6)", () => {
  it("does not dim unplayable cards when Highlight is off", () => {
    render(<GameTable view={makeGameView("03")} highlight={false} />);
    const card = screen.getByRole("button", { name: "Blue 4" });
    expect(card.className).not.toContain("brightness-55");
  });
});
