import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTO_DRAW_DELAY_MS, useAutoDrawPenalty } from "./useAutoDrawPenalty";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const prompt = (canStack: boolean) => ({ count: 4, canStack });

describe("useAutoDrawPenalty", () => {
  it("draws the penalty for you, after a short pause, when you can't stack", () => {
    const draw = vi.fn();
    renderHook(() => useAutoDrawPenalty(prompt(false), "d1", false, draw));
    expect(draw).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(AUTO_DRAW_DELAY_MS));
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it("waits for you when you can stack (you may stack or tap the deck)", () => {
    const draw = vi.fn();
    renderHook(() => useAutoDrawPenalty(prompt(true), "d1", false, draw));
    act(() => vi.advanceTimersByTime(AUTO_DRAW_DELAY_MS * 3));
    expect(draw).not.toHaveBeenCalled();
  });

  it("does nothing while paused or without a penalty", () => {
    const draw = vi.fn();
    renderHook(() => useAutoDrawPenalty(prompt(false), "d1", true, draw));
    renderHook(() => useAutoDrawPenalty(null, "d1", false, draw));
    act(() => vi.advanceTimersByTime(AUTO_DRAW_DELAY_MS * 3));
    expect(draw).not.toHaveBeenCalled();
  });

  it("draws once per penalty, even across re-renders", () => {
    const draw = vi.fn();
    const { rerender } = renderHook(
      ({ top }) => useAutoDrawPenalty(prompt(false), top, false, draw),
      { initialProps: { top: "d1" } },
    );
    act(() => vi.advanceTimersByTime(AUTO_DRAW_DELAY_MS));
    rerender({ top: "d1" });
    act(() => vi.advanceTimersByTime(AUTO_DRAW_DELAY_MS * 3));
    expect(draw).toHaveBeenCalledTimes(1);
    // A new +2/+4 on top later is a new penalty.
    rerender({ top: "d2" });
    act(() => vi.advanceTimersByTime(AUTO_DRAW_DELAY_MS));
    expect(draw).toHaveBeenCalledTimes(2);
  });
});
