import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";
import { IconButton } from "./IconButton";

describe("Button", () => {
  it("renders a native <button> defaulting to type=button", () => {
    render(<Button>Create a room</Button>);
    const btn = screen.getByRole("button", { name: "Create a room" });
    expect(btn.tagName).toBe("BUTTON");
    expect(btn).toHaveAttribute("type", "button");
  });

  it("respects the disabled state and does not fire onClick", async () => {
    const onClick = vi.fn();
    render(
      <Button variant="primary" disabled onClick={onClick}>
        Start game
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Start game" });
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("applies the muted disabled treatment to a disabled primary (no shadow)", () => {
    render(
      <Button variant="primary" disabled>
        Start game
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Start game" });
    expect(btn.className).toContain("bg-line");
    expect(btn.className).toContain("text-ink-muted");
    expect(btn.className).not.toContain("shadow-cta");
  });
});

describe("IconButton", () => {
  it("renders its required aria-label as the accessible name", () => {
    render(
      <IconButton aria-label="Open menu">
        <svg />
      </IconButton>,
    );
    const btn = screen.getByRole("button", { name: "Open menu" });
    expect(btn.tagName).toBe("BUTTON");
    expect(btn).toHaveAttribute("aria-label", "Open menu");
  });
});
