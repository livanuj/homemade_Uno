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

  it("does not burst for calls already made when the table first loads", () => {
    render(<GameTable view={{ ...base, unoCalledIds: [nora] }} />);
    expect(screen.queryByText("UNO!")).not.toBeInTheDocument();
  });

  it("clears the burst after a moment", () => {
    const { rerender } = render(<GameTable view={{ ...base, unoCalledIds: [] }} />);
    rerender(<GameTable view={{ ...base, unoCalledIds: [nora] }} />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByRole("status")).not.toHaveTextContent("called UNO");
  });
});
