import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useDrawInOrder } from "./GameTable";

/**
 * Unit tests for the draw-in detection that drives the hand's draw / penalty
 * animations (Req 10.6 + the staggered +2/+4/forgot-UNO fan-in).
 *
 * The hook reports, per current card id, its 0-based index among the cards that
 * arrived in the LATEST batch (or absence = not new). We assert:
 *   - nothing is "new" on first render (the opening hand doesn't deal-in here),
 *   - a single drawn card is index 0,
 *   - a multi-card penalty draw yields 0..N-1 in arrival order (stagger order),
 *   - playing a card (a removal) produces no new entries,
 *   - a stable hand clears the batch so cards don't re-animate.
 */
describe("useDrawInOrder", () => {
  it("marks nothing new on the first render", () => {
    const { result } = renderHook(({ ids }) => useDrawInOrder(ids), {
      initialProps: { ids: ["a", "b", "c"] },
    });
    expect(result.current.size).toBe(0);
  });

  it("marks a single drawn card as batch index 0", () => {
    const { result, rerender } = renderHook(({ ids }) => useDrawInOrder(ids), {
      initialProps: { ids: ["a", "b"] },
    });
    act(() => rerender({ ids: ["a", "b", "c"] }));
    expect(result.current.get("c")).toBe(0);
    // Pre-existing cards are not re-animated.
    expect(result.current.has("a")).toBe(false);
    expect(result.current.has("b")).toBe(false);
  });

  it("staggers a multi-card penalty draw (+4) as 0..3 in arrival order", () => {
    const { result, rerender } = renderHook(({ ids }) => useDrawInOrder(ids), {
      initialProps: { ids: ["a", "b"] },
    });
    act(() => rerender({ ids: ["a", "b", "p1", "p2", "p3", "p4"] }));
    expect(result.current.get("p1")).toBe(0);
    expect(result.current.get("p2")).toBe(1);
    expect(result.current.get("p3")).toBe(2);
    expect(result.current.get("p4")).toBe(3);
  });

  it("produces no new entries when a card is PLAYED (removed)", () => {
    const { result, rerender } = renderHook(({ ids }) => useDrawInOrder(ids), {
      initialProps: { ids: ["a", "b", "c"] },
    });
    act(() => rerender({ ids: ["a", "c"] }));
    expect(result.current.size).toBe(0);
  });

  it("clears the batch once the hand is stable again", () => {
    const { result, rerender } = renderHook(({ ids }) => useDrawInOrder(ids), {
      initialProps: { ids: ["a"] },
    });
    act(() => rerender({ ids: ["a", "b"] }));
    expect(result.current.get("b")).toBe(0);
    // A no-op re-render with the same ids must not keep re-flagging "b".
    act(() => rerender({ ids: ["a", "b"] }));
    expect(result.current.size).toBe(0);
  });
});
