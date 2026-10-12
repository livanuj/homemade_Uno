import { describe, expect, it } from "vitest";
import { dropAssignment, swapAssignment } from "./teams";
import type { PlayerView, TeamId } from "./types";

function p(id: string, team?: TeamId): PlayerView {
  return { id, name: id, isHost: id === "a1", team } as PlayerView;
}

const full = [p("a1", "A"), p("a2", "A"), p("b1", "B"), p("b2", "B")];
const three = [p("a1", "A"), p("a2", "A"), p("b1", "B")];

describe("dropAssignment (Req 21.3–21.5)", () => {
  it("swaps two players when dropped onto a player in the other team", () => {
    expect(dropAssignment(full, "b1", { kind: "player", id: "a2" })).toEqual({
      b1: "A",
      a2: "B",
    });
  });

  it("moves a player into an empty slot of the other team", () => {
    expect(dropAssignment(three, "a2", { kind: "slot", team: "B" })).toEqual({
      a2: "B",
    });
  });

  it("rejects drops onto the same team, a full team's slot, or nothing", () => {
    expect(dropAssignment(full, "a1", { kind: "player", id: "a2" })).toBeNull();
    expect(dropAssignment(three, "b1", { kind: "slot", team: "B" })).toBeNull();
    expect(dropAssignment(full, "a1", { kind: "slot", team: "B" })).toBeNull();
    expect(dropAssignment(full, "a1", null)).toBeNull();
  });
});

describe("swapAssignment (Req 21.6)", () => {
  it("moves to the other team, swapping when it is full", () => {
    expect(swapAssignment(three, "a1")).toEqual({ a1: "B" });
    expect(swapAssignment(full, "a1")).toEqual({ a1: "B", b1: "A" });
  });
});
