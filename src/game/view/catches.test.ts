import { describe, expect, it } from "vitest";
import { detectCatches, type CatchSnapshot } from "./tableEvents";

function snap(over: Partial<CatchSnapshot>): CatchSnapshot {
  return { counts: { me: 4, leo: 1, nora: 5 }, discardTopId: "d1", penaltyCount: 0, ...over };
}

describe("detectCatches", () => {
  it("spots a player jumping from 1 card to 3 with nothing else happening", () => {
    expect(detectCatches(snap({}), snap({ counts: { me: 4, leo: 3, nora: 5 } }))).toEqual(["leo"]);
  });

  it("spots the viewer being caught too", () => {
    expect(
      detectCatches(snap({ counts: { me: 1 } }), snap({ counts: { me: 3 } })),
    ).toEqual(["me"]);
  });

  it("ignores a +2 penalty draw (the pending penalty clears)", () => {
    expect(
      detectCatches(
        snap({ penaltyCount: 2 }),
        snap({ counts: { me: 4, leo: 3, nora: 5 }, penaltyCount: 0 }),
      ),
    ).toEqual([]);
  });

  it("ignores ordinary draws and plays", () => {
    expect(detectCatches(snap({}), snap({ counts: { me: 4, leo: 2, nora: 5 } }))).toEqual([]);
    expect(
      detectCatches(snap({}), snap({ counts: { me: 4, leo: 3, nora: 5 }, discardTopId: "d2" })),
    ).toEqual([]);
  });
});
