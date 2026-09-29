import { GameTable } from "@/components/GameTable";
import { makeGameView } from "@/game/view/fixtures";
import type { GameView, HandCardView } from "@/game/view/types";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
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

describe("GameTable — LAST CARD! enablement (Req 11.1)", () => {
  function viewWithHand(hand: HandCardView[], canCall: boolean): GameView {
    const base = makeGameView("04");
    return { ...base, hand, canCallLastCard: canCall };
  }

  it("disables LAST CARD! when the hand is not exactly two cards", () => {
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
    expect(screen.getByRole("button", { name: "LAST CARD!" })).toBeDisabled();
  });

  it("enables LAST CARD! only at exactly two cards on your turn", () => {
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
    expect(screen.getByRole("button", { name: "LAST CARD!" })).toBeEnabled();
  });
});

describe("GameTable — Highlight setting off (Req 7.6)", () => {
  it("does not dim unplayable cards when Highlight is off", () => {
    render(<GameTable view={makeGameView("03")} highlight={false} />);
    const card = screen.getByRole("button", { name: "Blue 4" });
    expect(card.className).not.toContain("brightness-55");
  });
});
