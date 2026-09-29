import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DragHandle } from "./DragHandle";
import { MotionDragRow } from "./MotionDragRow";

/**
 * jsdom has no layout engine, so we assert that the lift/tilt/drop wrapper
 * (Task 7.2, Req 17.8) preserves the row's contents and the DragHandle's
 * tap/keyboard fallback (Req 21.6) — the actual spring is a visual concern.
 */
describe("MotionDragRow (lift/tilt/drop visual, Req 17.8)", () => {
  it("renders its children unchanged whether resting or lifted", () => {
    const { rerender } = render(
      <MotionDragRow>
        <span>Leo</span>
      </MotionDragRow>,
    );
    expect(screen.getByText("Leo")).toBeInTheDocument();

    rerender(
      <MotionDragRow lifted>
        <span>Leo</span>
      </MotionDragRow>,
    );
    expect(screen.getByText("Leo")).toBeInTheDocument();
  });

  it("keeps the DragHandle's tap/keyboard move fallback working inside it", async () => {
    const onMove = vi.fn();
    render(
      <MotionDragRow lifted>
        <DragHandle playerName="Leo" onMove={onMove} />
      </MotionDragRow>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Move Leo to the other team" }),
    );
    expect(onMove).toHaveBeenCalledOnce();
  });
});
