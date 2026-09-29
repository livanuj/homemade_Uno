import { render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toast, TOAST_DEFAULT_DURATION_MS } from "./Toast";

/**
 * jsdom has no real animation, so we assert the accessibility contract and the
 * auto-dismiss timing (Task 7.2, §5.19 / Req 17.9): the pill keeps
 * `role="status"` so it is announced, and it schedules its own dismissal after
 * the timeout while preserving that timing regardless of motion.
 */
describe("Toast (§5.19)", () => {
  it("renders as a status region with its message", () => {
    render(<Toast>Leo forgot to call last card</Toast>);
    const toast = screen.getByRole("status");
    expect(toast).toHaveTextContent("Leo forgot to call last card");
  });

  describe("auto-dismiss", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("fires onDismiss after the default 3s window", () => {
      const onDismiss = vi.fn();
      render(<Toast onDismiss={onDismiss}>Skipped</Toast>);
      expect(onDismiss).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(TOAST_DEFAULT_DURATION_MS);
      });
      expect(onDismiss).toHaveBeenCalledOnce();
    });

    it("preserves the auto-dismiss timing under reduced motion", () => {
      const onDismiss = vi.fn();
      render(
        <Toast onDismiss={onDismiss} reduced durationMs={1500}>
          Paused
        </Toast>,
      );
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(onDismiss).toHaveBeenCalledOnce();
    });
  });
});
