import { makeGameView } from "@/game/view/fixtures";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameTable } from "./GameTable";

/** A "UNO!" burst pops over whoever just called UNO, on every screen. */
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const base = makeGameView("04");
const nora = base.opponents.find((o) => o.name === "Nora")!.id;

describe("GameTable — UNO call burst", () => {
  it("bursts over an opponent who calls UNO and announces it", () => {
    const { rerender } = render(<GameTable view={{ ...base, unoCalledIds: [] }} />);
    expect(screen.queryByText("UNO!")).not.toBeInTheDocument();
    rerender(<GameTable view={{ ...base, unoCalledIds: [nora] }} />);
    expect(screen.getByText("UNO!")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Nora called UNO");
  });

  it("bursts over your own row when you call it", () => {
    const { rerender } = render(<GameTable view={{ ...base, unoCalledIds: [] }} />);
    rerender(<GameTable view={{ ...base, unoCalledIds: [base.selfId] }} />);
    expect(screen.getByText("UNO!")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("You called UNO");
  });

  it("keeps the UNO tag while the call stands — already-made calls included", () => {
    render(<GameTable view={{ ...base, unoCalledIds: [nora] }} />);
    expect(screen.getByText("UNO!")).toBeInTheDocument();
    // A call that was already made is not announced again.
    expect(screen.getByRole("status")).not.toHaveTextContent("called UNO");
  });

  it("keeps the tag after the announcement clears, and drops it when the call does", () => {
    const { rerender } = render(<GameTable view={{ ...base, unoCalledIds: [] }} />);
    rerender(<GameTable view={{ ...base, unoCalledIds: [nora] }} />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByRole("status")).not.toHaveTextContent("called UNO");
    expect(screen.getByText("UNO!")).toBeInTheDocument();

    // Nora drew (her hand grew past 1): the call is cleared, so is the tag.
    rerender(<GameTable view={{ ...base, unoCalledIds: [] }} />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByText("UNO!")).not.toBeInTheDocument();
  });
});
