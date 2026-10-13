import { describe, expect, it } from "vitest";
import { detectTableEvent, turnOrderOf, type EventSnapshot } from "./tableEvents";
import { makeGameView } from "./fixtures";

const order = ["me", "leo", "nora", "omar"];

function snap(over: Partial<EventSnapshot>): EventSnapshot {
  return {
    discardTop: { id: "c0", suit: "red", value: 5 },
    activeSeatId: "me",
    direction: 1,
    turnOrder: order,
    ...over,
  };
}

describe("detectTableEvent", () => {
  it("names the next player in the direction of play as skipped", () => {
    const prev = snap({ activeSeatId: "leo" });
    const next = snap({
      discardTop: { id: "c1", suit: "red", value: "skip" },
      activeSeatId: "omar",
    });
    expect(detectTableEvent(prev, next)).toEqual({ kind: "skip", seatId: "nora" });
  });

  it("follows a counter-clockwise direction, wrapping round the table", () => {
    const prev = snap({ activeSeatId: "me", direction: -1 });
    const next = snap({
      discardTop: { id: "c1", suit: "blue", value: "skip" },
      activeSeatId: "nora",
      direction: -1,
    });
    expect(detectTableEvent(prev, next)).toEqual({ kind: "skip", seatId: "omar" });
  });

  it("reports a reverse with the new direction (3+ players)", () => {
    const prev = snap({ activeSeatId: "leo", direction: 1 });
    const next = snap({
      discardTop: { id: "c1", suit: "green", value: "reverse" },
      activeSeatId: "me",
      direction: -1,
    });
    expect(detectTableEvent(prev, next)).toEqual({ kind: "reverse", direction: -1 });
  });

  it("treats a 2-player reverse as a skip of the other player", () => {
    const two = ["me", "leo"];
    const prev = snap({ activeSeatId: "me", turnOrder: two });
    const next = snap({
      discardTop: { id: "c1", suit: "green", value: "reverse" },
      activeSeatId: "me",
      turnOrder: two,
    });
    expect(detectTableEvent(prev, next)).toEqual({ kind: "skip", seatId: "leo" });
  });

  it("reports nothing for other cards or an unchanged pile", () => {
    expect(
      detectTableEvent(snap({}), snap({ discardTop: { id: "c1", suit: "red", value: 9 } })),
    ).toBeNull();
    const skipTop = { id: "c1", suit: "red" as const, value: "skip" as const };
    expect(
      detectTableEvent(snap({ discardTop: skipTop }), snap({ discardTop: skipTop })),
    ).toBeNull();
  });
});

describe("turnOrderOf", () => {
  it("uses the view's turn order when present", () => {
    expect(turnOrderOf({ ...makeGameView("04"), turnOrder: ["a", "b"] })).toEqual(["a", "b"]);
  });

  it("falls back to self, then the seats clockwise (partner across in 2v2)", () => {
    const team = makeGameView("03");
    const [left, right] = team.opponents;
    expect(turnOrderOf(team)).toEqual([team.selfId, left.id, team.partner!.id, right.id]);
    const normal = makeGameView("04");
    expect(turnOrderOf(normal)).toEqual([
      normal.selfId,
      ...normal.opponents.map((o) => o.id),
    ]);
  });
});
