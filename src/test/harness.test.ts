import { describe, expect, it } from "vitest";
import fc from "fast-check";

// A tiny pure function used only to prove the Vitest + fast-check harness is
// wired up. The real engine property tests (tagged "Feature: homemade-uno,
// Property N") arrive with the rules-engine tasks.
function concat(a: string, b: string): string {
  return a + b;
}

describe("test harness", () => {
  it("runs a basic Vitest assertion", () => {
    expect(concat("uno", "!")).toBe("uno!");
  });

  it("runs a fast-check property (concatenated length is additive)", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (a, b) => {
        return concat(a, b).length === a.length + b.length;
      }),
      { numRuns: 100 },
    );
  });
});
