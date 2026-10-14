import { makeGameView } from "@/game/view/fixtures";
import type { GameView } from "@/game/view/types";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { diffFlights } from "./TableFlights";
import { GameTable } from "./GameTable";

/**
 * Being caught without calling UNO (Req 11.3) plays as a punishment on every
 * screen first — banner, seat badge, or your own stamp — and only then do the
 * two penalty cards arrive.
 */
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const base = makeGameView("04");
const leo = base.opponents.find((o) => o.name === "Leo")!;

function withCount(view: GameView, id: string, n: number): GameView {
  return {
    ...view,
    opponents: view.opponents.map((o) => (o.id === id ? { ...o, cardCount: n } : o)),
  };
}

describe("GameTable — caught without calling UNO", () => {
  it("shows everyone who was caught, with a badge on their seat", () => {
    const { rerender } = render(<GameTable view={withCount(base, leo.id, 1)} />);
    rerender(<GameTable view={withCount(base, leo.id, 3)} />);
    expect(screen.getByText("Leo was caught!")).toBeInTheDocument();
    expect(screen.getByText("Caught!")).toBeInTheDocument();
  });

  it("stamps the caught player's own screen", () => {
    const one: GameView = { ...base, hand: base.hand.slice(0, 1) };
    const three: GameView = {
      ...base,
      hand: [
        ...one.hand,
        { id: "p1", suit: "red", value: 9, playable: false },
        { id: "p2", suit: "blue", value: 2, playable: false },
      ],
    };
    const { rerender } = render(<GameTable view={one} />);
    rerender(<GameTable view={three} />);
    expect(screen.getByText("Caught! You forgot UNO")).toBeInTheDocument();
  });
});

describe("diffFlights — catch penalty", () => {
  const snap = {
    selfId: "me",
    activeSeatId: "nora",
    counts: { leo: 1 },
    discardTop: { id: "d1", suit: "red" as const, value: 5 as const },
    penaltyCount: 0,
  };

  it("delays a caught player's two cards until after the punishment", () => {
    const specs = diffFlights(snap, { ...snap, counts: { leo: 3 } });
    expect(specs).toEqual([
      { kind: "draw", seatId: "leo", count: 2, delay: expect.any(Number) },
    ]);
    expect((specs[0] as { delay: number }).delay).toBeGreaterThan(0);
  });

  it("does not delay ordinary draws", () => {
    const specs = diffFlights({ ...snap, counts: { leo: 4 } }, { ...snap, counts: { leo: 5 } });
    expect(specs).toEqual([{ kind: "draw", seatId: "leo", count: 1 }]);
  });
});
