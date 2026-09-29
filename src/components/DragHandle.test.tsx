import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DragHandle } from "./DragHandle";

describe("DragHandle", () => {
  it("is a button with a descriptive aria-label", () => {
    render(<DragHandle playerName="Leo" onMove={() => {}} />);
    expect(
      screen.getByRole("button", { name: "Move Leo to the other team" }),
    ).toBeInTheDocument();
  });

  it("calls onMove when activated (tap/Enter fallback)", async () => {
    const onMove = vi.fn();
    render(<DragHandle playerName="Leo" onMove={onMove} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Move Leo to the other team" }),
    );
    expect(onMove).toHaveBeenCalledTimes(1);
  });
});
