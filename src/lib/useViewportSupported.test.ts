import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  MAX_SUPPORTED_WIDTH,
  MIN_SUPPORTED_WIDTH,
  MIN_COMPACT_HEIGHT,
  MIN_WIDE_HEIGHT,
  isViewportSupported,
  viewportMode,
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

// Wide screens: landscape ones (desktop, laptop, tablet on its side) get the
// landscape layout, phones on their side the compact landscape layout; upright
// tablets get the portrait app in a centered column.
describe("viewportMode", () => {
  it("is 'phone' whenever the existing portrait-phone rule is met", () => {
    expect(viewportMode({ width: 390, height: 844 })).toBe("phone");
    expect(viewportMode({ width: 360, height: 667 })).toBe("phone");
  });

  it("is 'landscape' for wide screens at least as wide as they are tall", () => {
    expect(viewportMode({ width: 1440, height: 900 })).toBe("landscape");
    expect(viewportMode({ width: 1180, height: 820 })).toBe("landscape");
    expect(viewportMode({ width: 700, height: MIN_WIDE_HEIGHT })).toBe(
      "landscape",
    );
  });

  it("is 'column' for wide screens taller than they are wide (upright tablets)", () => {
    expect(viewportMode({ width: 820, height: 1180 })).toBe("column");
    expect(viewportMode({ width: 431, height: MIN_WIDE_HEIGHT })).toBe(
      "column",
    );
  });

  it("is 'compact' for phones held sideways (wide but under 600px tall)", () => {
    expect(viewportMode({ width: 844, height: 390 })).toBe("compact");
    expect(viewportMode({ width: 932, height: 430 })).toBe("compact");
    expect(viewportMode({ width: 667, height: 375 })).toBe("compact");
    expect(viewportMode({ width: 844, height: MIN_COMPACT_HEIGHT })).toBe(
      "compact",
    );
    expect(viewportMode({ width: 1440, height: MIN_WIDE_HEIGHT - 1 })).toBe(
      "compact",
    );
  });

  it("stays 'unsupported' for very short or too-narrow screens", () => {
    expect(viewportMode({ width: 844, height: MIN_COMPACT_HEIGHT - 1 })).toBe(
      "unsupported",
    );
    expect(viewportMode({ width: 320, height: 568 })).toBe("unsupported");
  });
});
