import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  MAX_SUPPORTED_WIDTH,
  MIN_SUPPORTED_WIDTH,
  isViewportSupported,
} from "./useViewportSupported";

// Requirement 16.4 / 16.8: supported ⇔ width in [360, 430] inclusive AND
// portrait (height >= width). These cover the exact boundaries and the
// portrait-vs-landscape rule.
describe("isViewportSupported", () => {
  it("treats the width boundaries 360 and 430 as supported (portrait)", () => {
    expect(isViewportSupported({ width: 360, height: 844 })).toBe(true);
    expect(isViewportSupported({ width: 430, height: 932 })).toBe(true);
  });

  it("treats width just outside the range (359 / 431) as unsupported", () => {
    expect(isViewportSupported({ width: 359, height: 844 })).toBe(false);
    expect(isViewportSupported({ width: 431, height: 932 })).toBe(false);
  });

  it("treats landscape (height < width) as unsupported even within width range", () => {
    // 400 wide is within [360, 430] but height < width → landscape.
    expect(isViewportSupported({ width: 400, height: 399 })).toBe(false);
  });

  it("treats a square viewport (height === width) as portrait", () => {
    expect(isViewportSupported({ width: 400, height: 400 })).toBe(true);
  });

  it("only reports supported when width is in range AND portrait", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 2000 }),
        fc.integer({ min: 100, max: 2000 }),
        (width, height) => {
          const expected =
            width >= MIN_SUPPORTED_WIDTH &&
            width <= MAX_SUPPORTED_WIDTH &&
            height >= width;
          return isViewportSupported({ width, height }) === expected;
        },
      ),
      { numRuns: 100 },
    );
  });
});
