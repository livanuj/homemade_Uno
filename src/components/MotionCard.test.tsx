import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MotionCard } from "./MotionCard";

/**
 * jsdom has no layout engine, so these tests deliberately check only that
 * wrapping PlayingCard in MotionCard preserves its behavior and accessibility
 * (Req 18.2) — the actual flight/spring is a browser/visual concern verified
 * elsewhere. We assert the card is still a real, labelled, clickable button
 * with its selected state reflected.
 */
describe("MotionCard (behavior unchanged when wrapped in motion)", () => {
  it("still renders a real <button> with the correct aria-label", () => {
    render(<MotionCard cardId="c1" suit="red" value={7} />);
    const btn = screen.getByRole("button", { name: "Red 7" });
    expect(btn).toBeInTheDocument();
    expect(btn.tagName).toBe("BUTTON");
    expect(btn).toHaveAttribute("type", "button");
  });

  it("labels wild cards through the wrapper", () => {
    render(<MotionCard cardId="w1" value="wild4" />);
    expect(
      screen.getByRole("button", { name: "Wild draw four" }),
    ).toBeInTheDocument();
  });

  it("reflects the selected (raised) state via aria-pressed", () => {
    render(<MotionCard cardId="c2" suit="blue" value={1} selected />);
    expect(screen.getByRole("button", { name: "Blue 1" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("forwards clicks to the underlying card button", async () => {
    const onClick = vi.fn();
    render(<MotionCard cardId="c3" suit="green" value={3} onClick={onClick} />);
    await userEvent.click(screen.getByRole("button", { name: "Green 3" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders at the final position when reduced motion is requested", () => {
    // Reduced motion drops the shared layoutId; the card must still render fine.
    render(<MotionCard cardId="c4" suit="yellow" value="skip" reduced />);
    expect(
      screen.getByRole("button", { name: "Yellow skip" }),
    ).toBeInTheDocument();
  });

  it("still renders when the shared transition is interrupted (Req 17.7)", () => {
    // interrupted commits the card directly at the discard top — it must not
    // vanish or be left in an intermediate/missing state.
    render(
      <MotionCard cardId="c5" suit="red" value="+2" onDiscard interrupted />,
    );
    expect(
      screen.getByRole("button", { name: "Red draw two" }),
    ).toBeInTheDocument();
  });
});
