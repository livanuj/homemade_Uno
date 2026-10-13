import { makeGameView } from "@/game/view/fixtures";
import type { GameView } from "@/game/view/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GameTable } from "./GameTable";
import { PlayingCard } from "./PlayingCard";

/**
 * After a wild is played and a color chosen, the wild on the discard pile takes
 * that color (with the suit shape, never color alone) so every player can see
 * what to match.
 */
describe("PlayingCard — wild with a chosen color", () => {
  it("fills with the chosen color, shows its shape, and names it", () => {
    render(<PlayingCard value="wild4" chosenColor="blue" variant="pile" />);
    const card = screen.getByRole("button", {
      name: "Wild draw four, blue chosen",
    });
    expect(card.querySelectorAll(".bg-suit-blue")).toHaveLength(4);
    expect(card.querySelector(".bg-suit-red")).toBeNull();
    expect(card).toHaveTextContent("◆");
  });

  it("keeps the four-color face when no color is chosen", () => {
    render(<PlayingCard value="wild" variant="pile" />);
    const card = screen.getByRole("button", { name: "Wild" });
    expect(card.querySelector(".bg-suit-red")).not.toBeNull();
    expect(card.querySelector(".bg-suit-blue")).not.toBeNull();
  });
});

describe("GameTable — wild on the discard pile", () => {
  function tableWithWildTop(colorPending: boolean) {
    const view: GameView = {
      ...makeGameView("04"),
      discardTop: { id: "w1", value: "wild4" },
      activeColor: "blue",
      colorPending,
    };
    render(<GameTable view={view} />);
  }

  it("shows the chosen color once it has been picked", () => {
    tableWithWildTop(false);
    expect(
      screen.getByRole("button", { name: "Wild draw four, blue chosen" }),
    ).toBeInTheDocument();
  });

  it("stays four-color while the player is still choosing", () => {
    tableWithWildTop(true);
    expect(
      screen.queryByRole("button", { name: /chosen/ }),
    ).not.toBeInTheDocument();
  });
});
