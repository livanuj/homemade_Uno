import { makeGameView } from "@/game/view/fixtures";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GameTable, isThrowGesture } from "./GameTable";

/**
 * Playing a card from the hand: a tap/click LIFTS the card and a second tap on
 * the lifted card THROWS it, so a stray tap never plays a card. On touch, the
 * card can also be dragged up and released to throw it (`isThrowGesture`).
 */
function renderTable() {
  const onPlayCard = vi.fn();
  render(<GameTable view={makeGameView("03")} onPlayCard={onPlayCard} />);
  return onPlayCard;
}

describe("hand — tap to lift, tap again to throw", () => {
  it("lifts a card on the first click without playing it", () => {
    const onPlayCard = renderTable();
    const card = screen.getByRole("button", { name: /^Green 9/ });
    expect(card).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(card);

    expect(onPlayCard).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /^Green 9/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("throws the lifted card on a second click", () => {
    const onPlayCard = renderTable();
    fireEvent.click(screen.getByRole("button", { name: /^Green 9/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Green 9/ }));
    expect(onPlayCard).toHaveBeenCalledTimes(1);
    expect(onPlayCard.mock.calls[0][0]).toEqual(expect.any(String));
  });

  it("moves the lift to another card instead of throwing", () => {
    const onPlayCard = renderTable();
    fireEvent.click(screen.getByRole("button", { name: /^Green 9/ }));
    const other = screen.getByRole("button", { name: /^Yellow 2/ });
    fireEvent.pointerDown(other);
    fireEvent.click(other);
    expect(onPlayCard).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /^Yellow 2/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /^Green 9/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("drops the lifted card when tapping anywhere else", () => {
    const onPlayCard = renderTable();
    fireEvent.click(screen.getByRole("button", { name: /^Green 9/ }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByRole("button", { name: /^Green 9/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(onPlayCard).not.toHaveBeenCalled();
  });
});

describe("isThrowGesture (touch drag)", () => {
  it("throws when the card is dragged far enough up", () => {
    expect(isThrowGesture({ offsetY: -120, velocityY: 0 })).toBe(true);
  });

  it("throws on a quick upward flick even over a short distance", () => {
    expect(isThrowGesture({ offsetY: -40, velocityY: -900 })).toBe(true);
  });

  it("snaps back for short drags, slow releases, or downward drags", () => {
    expect(isThrowGesture({ offsetY: -40, velocityY: -100 })).toBe(false);
    expect(isThrowGesture({ offsetY: -10, velocityY: -2000 })).toBe(false);
    expect(isThrowGesture({ offsetY: 80, velocityY: 900 })).toBe(false);
  });
});
