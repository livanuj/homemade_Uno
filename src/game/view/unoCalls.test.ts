import { describe, expect, it } from "vitest";
import { newUnoCalls } from "./tableEvents";

describe("newUnoCalls", () => {
  it("returns players who have just called UNO", () => {
    expect(newUnoCalls(["a"], ["a", "b"])).toEqual(["b"]);
    expect(newUnoCalls([], ["c"])).toEqual(["c"]);
  });

  it("ignores calls already shown and calls that were cleared", () => {
    expect(newUnoCalls(["a", "b"], ["a", "b"])).toEqual([]);
    expect(newUnoCalls(["a", "b"], ["b"])).toEqual([]);
    expect(newUnoCalls(undefined, undefined)).toEqual([]);
  });
});
