import { describe, expect, it } from "vitest";
import { fanSlot } from "./GameTable";

/**
 * Fan-layout math (§7.7). These lock in that the hand fan stays readable and
 * on-screen for ANY hand size — small hands fan wide, large hands pack into a
 * bounded, fully-visible band — fixing the big-hand clump/overflow where the
 * old parabola dropped outer cards ~300px and the step collapsed to a sliver.
 */
const W = 390;
const CARD_W = 70;

/** Rebuild the full run of left/top/rotate for a hand of `n` cards. */
function run(n: number) {
  return Array.from({ length: n }, (_, i) => fanSlot(i, n, W));
}

describe("fanSlot", () => {
  it("fans a small hand wide (design spacing) and centered", () => {
    const slots = run(7);
    // Symmetric rotation extremes, bounded arc.
    expect(slots[0].rotate).toBeCloseTo(-slots[6].rotate, 5);
    expect(Math.abs(slots[0].rotate)).toBeLessThanOrEqual(16);
    // Center card is upright and highest in the band.
    expect(slots[3].rotate).toBeCloseTo(0, 5);
    expect(slots[3].top).toBeLessThan(slots[0].top);
  });

  it("keeps the vertical arc bounded regardless of count (no exploding parabola)", () => {
    for (const n of [3, 7, 15, 23, 30]) {
      const slots = run(n);
      const maxTop = Math.max(...slots.map((s) => s.top));
      const minTop = Math.min(...slots.map((s) => s.top));
      // The whole fan stays within a small vertical band (fits the hand area).
      expect(maxTop - minTop).toBeLessThanOrEqual(40);
      expect(maxTop).toBeLessThanOrEqual(60);
    }
  });

  it("keeps the rotation spread bounded regardless of count", () => {
    for (const n of [7, 15, 23, 30]) {
      const slots = run(n);
      const maxRot = Math.max(...slots.map((s) => Math.abs(s.rotate)));
      expect(maxRot).toBeLessThanOrEqual(16 + 1e-6);
    }
  });

  it("keeps every card on-screen for large hands (no horizontal clipping)", () => {
    for (const n of [16, 20, 23, 25, 30]) {
      const slots = run(n);
      const leftmost = slots[0].left;
      const rightEdge = slots[n - 1].left + CARD_W;
      expect(leftmost).toBeGreaterThanOrEqual(-0.5);
      expect(rightEdge).toBeLessThanOrEqual(W + 0.5);
    }
  });

  it("keeps cards in left-to-right order with a positive step", () => {
    const slots = run(23);
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i].left).toBeGreaterThan(slots[i - 1].left);
    }
  });
});
