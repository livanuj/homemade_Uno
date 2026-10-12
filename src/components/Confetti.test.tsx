import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Confetti } from "./Confetti";

/**
 * jsdom has no real animation, so we assert structure/props, not visual motion
 * (Task 7.2). The behavioral contract for Confetti is Req 17.6 / §5.25: it
 * bursts once when animated and renders STATICALLY (no burst) under reduced
 * motion. We check that the decorative layer stays `aria-hidden` in both modes
 * and that the same set of pieces is present either way — the reduced path
 * simply omits the burst animation, not the pieces.
 */
describe("Confetti (§5.25, Req 17.6)", () => {
  it("renders a purely decorative, aria-hidden layer", () => {
    const { container } = render(<Confetti />);
    const layer = container.firstElementChild as HTMLElement;
    expect(layer).toHaveAttribute("aria-hidden", "true");
    // 12 scattered suit glyphs (the deterministic PIECES table).
    expect(layer.childElementCount).toBe(12);
  });

  it("renders the same pieces statically under reduced motion (no burst)", () => {
    const { container } = render(<Confetti reduced />);
    const layer = container.firstElementChild as HTMLElement;
    expect(layer).toHaveAttribute("aria-hidden", "true");
    expect(layer.childElementCount).toBe(12);

    // Under reduced motion the pieces carry no burst opacity/scale styling —
    // they sit at their final rotation with no initial hidden transform.
    const first = layer.firstElementChild as HTMLElement;
    expect(first.style.transform).toContain("rotate");
    // The animated (non-reduced) path drives opacity/scale via Motion, which
    // starts hidden (opacity 0); the static path never sets opacity.
    expect(first.style.opacity).toBe("");
  });
});
