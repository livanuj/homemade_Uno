import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useModalA11y } from "./useModalA11y";

/**
 * A minimal modal harness that uses the hook. A trigger button opens the
 * modal; the modal has two focusable buttons; the hook wires focus-in,
 * return-focus, focus-trap, and Escape.
 */
function Harness({
  escapeCloses = true,
  onCloseSpy,
}: {
  escapeCloses?: boolean;
  onCloseSpy?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = () => {
    onCloseSpy?.();
    setOpen(false);
  };
  useModalA11y(ref, {
    open,
    onClose: close,
    escapeCloses,
  });
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      {open && (
        <div ref={ref} role="dialog" aria-label="Test dialog">
          <button type="button">First</button>
          <button type="button">Second</button>
        </div>
      )}
    </div>
  );
}

describe("useModalA11y (Req 18.6, 18.9, 18.10)", () => {
  it("moves focus into the dialog when it opens", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
  });

  it("returns focus to the trigger when it closes (Req 18.9)", async () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open" });
    await userEvent.click(trigger);
    await userEvent.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
  });

  it("closes on Escape by default (Req 18.9)", async () => {
    const onCloseSpy = vi.fn();
    render(<Harness onCloseSpy={onCloseSpy} />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    await userEvent.keyboard("{Escape}");
    expect(onCloseSpy).toHaveBeenCalledOnce();
  });

  it("does NOT close on Escape when escapeCloses is false (wild picker / paused, Req 18.9/18.10)", async () => {
    const onCloseSpy = vi.fn();
    render(<Harness escapeCloses={false} onCloseSpy={onCloseSpy} />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    await userEvent.keyboard("{Escape}");
    expect(onCloseSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("traps Tab within the dialog (Req 18.6)", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    const first = screen.getByRole("button", { name: "First" });
    const second = screen.getByRole("button", { name: "Second" });

    expect(first).toHaveFocus();
    await userEvent.tab();
    expect(second).toHaveFocus();
    // Tab from the last focusable wraps back to the first (trap).
    await userEvent.tab();
    expect(first).toHaveFocus();
    // Shift+Tab from the first wraps to the last.
    await userEvent.tab({ shift: true });
    expect(second).toHaveFocus();
  });
});
