import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WildColorButtons } from "./WildColorButtons";

describe("WildColorButtons (§5.16)", () => {
  it("renders four suit buttons with accessible color names", () => {
    render(<WildColorButtons onSelect={() => {}} />);
    for (const name of ["Red", "Yellow", "Green", "Blue"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(screen.getAllByRole("button")).toHaveLength(4);
  });

  it("offers no cancel / dismiss button (§5.16)", () => {
    render(<WildColorButtons onSelect={() => {}} />);
    expect(
      screen.queryByRole("button", { name: /cancel|close|dismiss/i }),
    ).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(4);
  });

  it("fires onSelect with the chosen suit", async () => {
    const onSelect = vi.fn();
    render(<WildColorButtons onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: "Green" }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("green");
  });
});
