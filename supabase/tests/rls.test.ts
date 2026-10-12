import { beforeAll, describe, expect, it } from "vitest";
import {
  anonPlayer,
  freshRoomId,
  readAs,
  seedRoom,
  serviceClient,
  type Player,
} from "./helpers";

/**
 * Row Level Security for `room_docs` (Req 14.6, 23.1, 23.2): what each client
 * can read, and that clients cannot write anything except their own presence.
 */

const card = { id: "red-5-a", suit: "red", value: 5 };

function playerDoc(name: string, team: "A" | "B" | null = null) {
  return {
    displayName: name,
    seatIndex: 0,
    team,
    isHost: false,
    joinOrder: 0,
    connectionState: "connected",
    lastSeen: 0,
    hasLeft: false,
  };
}

let a: Player;
let b: Player;
let c: Player;
let d: Player;
let outsider: Player;

beforeAll(async () => {
  [a, b, c, d, outsider] = await Promise.all([
    anonPlayer(),
    anonPlayer(),
    anonPlayer(),
    anonPlayer(),
    anonPlayer(),
  ]);
});

/** A started Normal-mode room with players a and b. */
async function normalRoom(): Promise<string> {
  const room = freshRoomId();
  await seedRoom(room, {
    room: { roomCode: room, gameMode: "normal", phase: "playing" },
    [`players/${a.uid}`]: playerDoc("A"),
    [`players/${b.uid}`]: playerDoc("B"),
    "state/current": { version: 1 },
    [`hands/${a.uid}`]: { cards: [card], cardCount: 1 },
    [`hands/${b.uid}`]: { cards: [card], cardCount: 1 },
    "private/deck": { drawPile: [card] },
    "actions/x": { playerId: a.uid, type: "play" },
  });
  return room;
}

/** A started 2v2 room: a + c are team A, b + d are team B. */
async function teamRoom(): Promise<string> {
  const room = freshRoomId();
  await seedRoom(room, {
    room: { roomCode: room, gameMode: "team", phase: "playing" },
    [`players/${a.uid}`]: playerDoc("A", "A"),
    [`players/${b.uid}`]: playerDoc("B", "B"),
    [`players/${c.uid}`]: playerDoc("C", "A"),
    [`players/${d.uid}`]: playerDoc("D", "B"),
    [`hands/${a.uid}`]: { cards: [card], cardCount: 1 },
    [`hands/${c.uid}`]: { cards: [card], cardCount: 1 },
    "private/deck": { drawPile: [card] },
  });
  return room;
}

describe("hands — Normal mode", () => {
  it("a player can read their own hand", async () => {
    const room = await normalRoom();
    expect(await readAs(a, room, `hands/${a.uid}`)).toEqual({ cards: [card], cardCount: 1 });
  });

  it("a player cannot read another player's hand", async () => {
    const room = await normalRoom();
    expect(await readAs(a, room, `hands/${b.uid}`)).toBeNull();
  });
});

describe("hands — Team mode", () => {
  it("a partner's hand is readable", async () => {
    const room = await teamRoom();
    expect(await readAs(a, room, `hands/${c.uid}`)).not.toBeNull();
  });

  it("an opponent's hand is not readable, in either direction", async () => {
    const room = await teamRoom();
    expect(await readAs(b, room, `hands/${a.uid}`)).toBeNull();
    expect(await readAs(d, room, `hands/${c.uid}`)).toBeNull();
  });
});

describe("server-only documents", () => {
  it("no client can read the draw pile", async () => {
    const normal = await normalRoom();
    const team = await teamRoom();
    expect(await readAs(a, normal, "private/deck")).toBeNull();
    expect(await readAs(a, team, "private/deck")).toBeNull();
  });

  it("no client can read the action log", async () => {
    const room = await normalRoom();
    expect(await readAs(a, room, "actions/x")).toBeNull();
  });
});

describe("public documents", () => {
  it("a member can read the room, players, and state", async () => {
    const room = await normalRoom();
    expect(await readAs(a, room, "room")).not.toBeNull();
    expect(await readAs(a, room, `players/${b.uid}`)).not.toBeNull();
    expect(await readAs(a, room, "state/current")).not.toBeNull();
  });

  it("a non-member cannot read anything in the room", async () => {
    const room = await normalRoom();
    expect(await readAs(outsider, room, "room")).toBeNull();
    expect(await readAs(outsider, room, `players/${a.uid}`)).toBeNull();
    expect(await readAs(outsider, room, "state/current")).toBeNull();
  });
});

describe("clients cannot write documents", () => {
  it("insert, update, and delete are all refused", async () => {
    const room = await normalRoom();
    const insert = await a.client
      .from("room_docs")
      .insert({ room_id: room, path: "state/hack", doc: {} });
    expect(insert.error).not.toBeNull();

    await a.client
      .from("room_docs")
      .update({ doc: { cards: [], cardCount: 0 } })
      .eq("room_id", room)
      .eq("path", `hands/${a.uid}`);
    await a.client.from("room_docs").delete().eq("room_id", room).eq("path", "state/current");

    expect(await readAs(a, room, `hands/${a.uid}`)).toEqual({ cards: [card], cardCount: 1 });
    expect(await readAs(a, room, "state/current")).toEqual({ version: 1 });
  });

  it("clients cannot call the server's commit function", async () => {
    const room = await normalRoom();
    const { error } = await a.client.rpc("commit_room", {
      p_room: room,
      p_rev: 0,
      p_ops: [{ op: "set", path: "state/current", doc: { version: 99 } }],
    });
    expect(error).not.toBeNull();
    expect(await readAs(a, room, "state/current")).toEqual({ version: 1 });
  });
});

describe("presence — heartbeat", () => {
  it("stamps only the caller's own lastSeen + connectionState", async () => {
    const room = await normalRoom();
    const before = Date.now();
    const { error } = await a.client.rpc("heartbeat", { p_room: room, p_connection: "connected" });
    expect(error).toBeNull();

    const mine = (await readAs(a, room, `players/${a.uid}`)) as { lastSeen: number; displayName: string };
    expect(mine.lastSeen).toBeGreaterThanOrEqual(before - 5_000);
    expect(mine.displayName).toBe("A");
    // Other players are untouched.
    const theirs = (await readAs(a, room, `players/${b.uid}`)) as { lastSeen: number };
    expect(theirs.lastSeen).toBe(0);
  });

  it("rejects any other connection state, such as faking a leave", async () => {
    const room = await normalRoom();
    const { error } = await a.client.rpc("heartbeat", { p_room: room, p_connection: "left" });
    expect(error).not.toBeNull();
  });

  it("does nothing for a non-member", async () => {
    const room = await normalRoom();
    await outsider.client.rpc("heartbeat", { p_room: room, p_connection: "connected" });
    const { data } = await serviceClient()
      .from("room_docs")
      .select("path")
      .eq("room_id", room)
      .eq("path", `players/${outsider.uid}`);
    expect(data).toEqual([]);
  });
});
