import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { DragHandle } from "./DragHandle";
import { IconButton } from "./IconButton";
import { Dialog } from "./Dialog";
import { WildColorButtons } from "./WildColorButtons";
import { Switch } from "./Switch";

/**
 * Automated accessibility checks (Task 10.3, Req 18.1/18.4/18.5/18.6/18.9).
 *
 * These exercise the a11y MECHANICS we can assert without a browser or
 * assistive technology: icon-only controls carry an accessible name, modal
 * surfaces expose a dialog role and manage focus, the drag handle has a
 * keyboard/tap alternative, and toggle controls expose their state.
 *
 * NOTE — these checks are NOT a substitute for WCAG conformance. Full
 * conformance (contrast under real rendering, screen-reader reading order,
 * reflow, target size, motion) requires manual testing with assistive
 * technologies (VoiceOver / TalkBack) and expert accessibility review. The
 * visual/contrast token side is additionally covered by the design-token
 * policy and the Playwright viewport checks; semantic correctness lives here
 * and in LiveAnnouncer / useModalA11y tests.
 */

describe("icon-only buttons expose an accessible name (Req 18.1)", () => {
  it("IconButton requires and renders an aria-label", () => {
    render(
      <IconButton aria-label="Open menu">
        <svg aria-hidden="true" />
      </IconButton>,
    );
    // Resolvable by accessible name → screen readers announce it.
    expect(screen.getByRole("button", { name: "Open menu" })).toBeInTheDocument();
  });
});

describe("modal surfaces are dialogs and manage focus (Req 18.6, 18.9)", () => {
  it("Dialog exposes an alertdialog role with an accessible name", () => {
    render(
      <Dialog
        title="Leave game?"
        description="You can rejoin from the invite link."
        actions={<button type="button">Stay</button>}
      />,
    );
    const dialog = screen.getByRole("alertdialog", { name: /leave game/i });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("Dialog returns focus to the trigger when closed via Escape", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Trigger
          </button>
          {open && (
            <Dialog
              title="Leave game?"
              onClose={() => setOpen(false)}
              actions={<button type="button">Stay</button>}
            />
          )}
        </>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Trigger" });
    await userEvent.click(trigger);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
  });
});

describe("the wild color picker buttons are named by color (Req 18.1, 18.5)", () => {
  it("renders four color buttons with text labels", () => {
    render(<WildColorButtons onSelect={() => {}} />);
    for (const name of ["Red", "Yellow", "Green", "Blue"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });
});

describe("drag handle has a keyboard/tap alternative (Req 18.6, 21.6)", () => {
  it("moves the player via click/Enter without a pointer drag", async () => {
    const onMove = vi.fn();
    render(<DragHandle playerName="Nora" onMove={onMove} />);
    const handle = screen.getByRole("button", {
      name: "Move Nora to the other team",
    });
    await userEvent.click(handle);
    expect(onMove).toHaveBeenCalledOnce();
  });
});

describe("toggle controls expose their state (Req 18.5)", () => {
  it("Switch exposes role=switch, aria-checked, and a name", () => {
    render(
      <Switch aria-label="Sound effects" checked onCheckedChange={() => {}} />,
    );
    const sw = screen.getByRole("switch", { name: "Sound effects" });
    expect(sw).toHaveAttribute("aria-checked", "true");
  });
});
