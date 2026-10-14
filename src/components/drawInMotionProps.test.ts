import { describe, expect, it } from "vitest";
import { drawInMotionProps } from "./GameTable";

/**
 * The hand card's draw-in motion props must keep `animate` stable for the
 * card's whole lifetime. If a re-render mid-flight (the 1s clock tick, a
 * snapshot) drops `animate`, Motion animates the removed keys back to their
 * mount-time `initial` values — leaving the card stuck at the draw pile.
 */
describe("drawInMotionProps", () => {
  it("a freshly drawn card starts at the draw pile and animates to its slot", () => {
    const props = drawInMotionProps(0, false);
    expect(props.initial).toEqual({ opacity: 0.6, y: -320, x: 40, rotateY: 180 });
    expect(props.animate).toEqual({ opacity: 1, y: 0, x: 0, rotateY: 0 });
  });

  it("keeps the same animate target on the re-render after the batch is consumed", () => {
    const drawn = drawInMotionProps(0, false);
    const settled = drawInMotionProps(undefined, false);
    expect(settled.animate).toEqual(drawn.animate);
    expect(settled.transition).toBeDefined();
    expect(settled.initial).toBe(false);
  });

  it("staggers a penalty batch by its index", () => {
    const first = drawInMotionProps(0, false).transition as { delay: number };
    const third = drawInMotionProps(2, false).transition as { delay: number };
    expect(third.delay).toBeGreaterThan(first.delay);
  });

  it("reduced motion renders at rest with no flight", () => {
    const props = drawInMotionProps(0, true);
    expect(props.initial).toBe(false);
    expect(props.animate).toEqual({ opacity: 1, y: 0, x: 0, rotateY: 0 });
  });

  it("holds a caught player's cards back, hidden, until the punishment plays", () => {
    const props = drawInMotionProps(0, false, 0.8);
    expect(props.initial).toMatchObject({ opacity: 0 });
    expect((props.transition as { delay: number }).delay).toBeGreaterThanOrEqual(0.8);
  });
});
