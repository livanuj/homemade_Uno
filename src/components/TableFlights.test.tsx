import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CardView } from "@/game/view/types";
import { DURATION } from "@/design/motion";
import { diffFlights, drawFlightDelay, useTableFlights, type TableSnapshot } from "./TableFlights";

/**
 * Opponent draw + play flights (Req 10.6 / 17.2). `diffFlights` decides what
 * flies between two snapshots of the table; `useTableFlights` turns that into
 * live flights and holds the discard top until an opponent's card lands.
 */
const red7: CardView = { id: "r7", suit: "red", value: 7 };
const blue2: CardView = { id: "b2", suit: "blue", value: 2 };

function snap(overrides: Partial<TableSnapshot> = {}): TableSnapshot {
  return {
    selfId: "me",
    activeSeatId: "maya",
    counts: { maya: 5, leo: 3 },
    discardTop: red7,
    ...overrides,
  };
}

describe("diffFlights", () => {
  it("flies nothing when the table did not change", () => {
    expect(diffFlights(snap(), snap())).toEqual([]);
  });

  it("flies one card to an opponent who drew one", () => {
    expect(diffFlights(snap(), snap({ counts: { maya: 6, leo: 3 } }))).toEqual([
      { kind: "draw", seatId: "maya", count: 1 },
    ]);
  });

  it("flies every card of a multi-card draw (+4 → 4 cards)", () => {
    expect(diffFlights(snap(), snap({ counts: { maya: 5, leo: 7 } }))).toEqual([
      { kind: "draw", seatId: "leo", count: 4 },
    ]);
  });

  it("caps a huge stacked penalty at 7 visible cards", () => {
    expect(diffFlights(snap(), snap({ counts: { maya: 17, leo: 3 } }))).toEqual([
      { kind: "draw", seatId: "maya", count: 7 },
    ]);
  });

  it("flies the played card from the player whose turn it was", () => {
    const next = snap({ activeSeatId: "leo", counts: { maya: 4, leo: 3 }, discardTop: blue2 });
    expect(diffFlights(snap(), next)).toEqual([{ kind: "play", seatId: "maya", card: blue2 }]);
  });

  it("does not fly your own play (the hand's shared-layout throw covers it)", () => {
    const prev = snap({ activeSeatId: "me" });
    expect(diffFlights(prev, snap({ activeSeatId: "maya", discardTop: blue2 }))).toEqual([]);
  });

  it("ignores seats that are new or gone (no count to compare)", () => {
    expect(diffFlights(snap(), snap({ counts: { maya: 5, leo: 3, nora: 7 } }))).toEqual([]);
  });
});

describe("drawFlightDelay", () => {
  it("sends drawn cards one at a time: each leaves as the previous one lands", () => {
    expect(drawFlightDelay(0)).toBe(0);
    for (let i = 1; i < 4; i++) {
      expect(drawFlightDelay(i) - drawFlightDelay(i - 1)).toBeGreaterThanOrEqual(DURATION.drawSlide - 1e-9);
    }
  });
});

describe("useTableFlights", () => {
  it("spawns one flight per drawn card, staggered by index", () => {
    const { result, rerender } = renderHook(({ s }) => useTableFlights(s, false), {
      initialProps: { s: snap() },
    });
    act(() => rerender({ s: snap({ counts: { maya: 5, leo: 5 } }) }));
    expect(result.current.flights.map((f) => [f.kind, f.seatId, f.index])).toEqual([
      ["draw", "leo", 0],
      ["draw", "leo", 1],
    ]);
  });

  it("holds the discard top until an opponent's play lands, then releases it", () => {
    const { result, rerender } = renderHook(({ s }) => useTableFlights(s, false), {
      initialProps: { s: snap() },
    });
    act(() => rerender({ s: snap({ activeSeatId: "leo", discardTop: blue2 }) }));
    expect(result.current.holdTopId).toBe("b2");

    const play = result.current.flights.find((f) => f.kind === "play")!;
    act(() => result.current.done(play.key));
    expect(result.current.holdTopId).toBeNull();
    expect(result.current.flights).toEqual([]);
  });

  it("counts cards still in the air per seat, so the seat can add each one as it lands", () => {
    const { result, rerender } = renderHook(({ s }) => useTableFlights(s, false), {
      initialProps: { s: snap() },
    });
    act(() => rerender({ s: snap({ counts: { maya: 7, leo: 3 } }) }));
    expect(result.current.inFlightTo).toEqual({ maya: 2 });
    act(() => result.current.done(result.current.flights[0]!.key));
    expect(result.current.inFlightTo).toEqual({ maya: 1 });
    act(() => result.current.done(result.current.flights[0]!.key));
    expect(result.current.inFlightTo).toEqual({});
  });

  it("does not respawn flights on an unrelated re-render", () => {
    const { result, rerender } = renderHook(({ s }) => useTableFlights(s, false), {
      initialProps: { s: snap() },
    });
    act(() => rerender({ s: snap({ counts: { maya: 6, leo: 3 } }) }));
    act(() => rerender({ s: snap({ counts: { maya: 6, leo: 3 } }) }));
    expect(result.current.flights).toHaveLength(1);
  });

  it("flies nothing under reduced motion", () => {
    const { result, rerender } = renderHook(({ s }) => useTableFlights(s, true), {
      initialProps: { s: snap() },
    });
    act(() => rerender({ s: snap({ activeSeatId: "leo", counts: { maya: 9, leo: 3 }, discardTop: blue2 }) }));
    expect(result.current.flights).toEqual([]);
    expect(result.current.holdTopId).toBeNull();
  });
});
