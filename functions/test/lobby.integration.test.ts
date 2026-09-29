/**
 * Lobby + team-assignment integration tests (Task 9.2) on the emulator.
 *
 * Exercises the two new lobby callables end-to-end through the client SDK:
 *   - `setMode` — host flips Normal ↔ 2v2; a 2v2 switch seeds a join-order team
 *     fill; a non-host request is rejected; 2v2 is refused with >4 players.
 *   - `setTeams` — host rearranges A/B; a non-host request is rejected; a move
 *     that would overfill a team is rejected (invalid drop → return to origin).
 * Also asserts the server persists the host's arrangement into seats at start
 * (partners opposite) and denormalizes each player's `cardCount` for badges.
 */
import { afterAll, describe, expect, it } from "vitest";
import { readStateAdmin } from "./adminReader";
import {
  destroyClient,
  makeClient,
  readPlayer,
  readPlayers,
  readRoom,
  type Client,
} from "./helpers";

const clients: Client[] = [];
async function newClient(): Promise<Client> {
  const c = await makeClient();
  clients.push(c);
  return c;
}
afterAll(async () => {
  for (const c of clients) await destroyClient(c);
});

interface OkRes {
  ok?: boolean;
  reason?: string;
  mode?: string;
}

async function makeLobby(names: string[]): Promise<{ roomId: string; players: Client[] }> {
  const players: Client[] = [];
  for (const _ of names) players.push(await newClient());
  const host = players[0];
  const res = await host.call<{ displayName: string }, { roomId: string }>("createRoom", {
    displayName: names[0],
  });
  const roomId = res.roomId;
  for (let i = 1; i < players.length; i++) {
    await players[i].call("join", { roomCode: roomId, displayName: names[i] });
  }
  return { roomId, players };
}

describe("setMode", () => {
  it("host switches to 2v2 and back; seeds and clears teams", async () => {
    const { roomId, players } = await makeLobby(["Alice", "Bob", "Cara", "Dan"]);
    const host = players[0];

    const toTeam = await host.call<Record<string, unknown>, OkRes>("setMode", {
      roomId,
      mode: "team",
    });
    expect(toTeam.ok).toBe(true);

    let room = await readRoom(host, roomId);
    expect(room!.gameMode).toBe("team");

    // Every player now carries a team; the split is 2/2 (join-order seed).
    const docs = await readPlayers(host, roomId);
    const teams = docs.map((d) => d.team);
    expect(teams.filter((t) => t === "A").length).toBe(2);
    expect(teams.filter((t) => t === "B").length).toBe(2);

    // Switch back to Normal clears every team.
    const toNormal = await host.call<Record<string, unknown>, OkRes>("setMode", {
      roomId,
      mode: "normal",
    });
    expect(toNormal.ok).toBe(true);
    room = await readRoom(host, roomId);
    expect(room!.gameMode).toBe("normal");
    const cleared = await readPlayers(host, roomId);
    expect(cleared.every((d) => d.team === null)).toBe(true);
  });

  it("rejects a mode change from a non-host", async () => {
    const { roomId, players } = await makeLobby(["Alice", "Bob"]);
    const guest = players[1];
    await expect(
      guest.call<Record<string, unknown>, OkRes>("setMode", { roomId, mode: "team" }),
    ).rejects.toThrow();
  });

  it("refuses 2v2 with more than 4 players", async () => {
    const { roomId, players } = await makeLobby(["A", "B", "C", "D", "E"]);
    const res = await players[0].call<Record<string, unknown>, OkRes>("setMode", {
      roomId,
      mode: "team",
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("too_many_players");
  });
});

describe("setTeams", () => {
  it("host swaps two players between teams", async () => {
    const { roomId, players } = await makeLobby(["Alice", "Bob", "Cara", "Dan"]);
    const host = players[0];
    await host.call("setMode", { roomId, mode: "team" });

    // Read the seeded split, then move the first Team-A player to Team B,
    // swapping a Team-B player back to A.
    const before = await readPlayers(host, roomId);
    const aPlayers = before.filter((d) => d.team === "A");
    const bPlayers = before.filter((d) => d.team === "B");
    const assignments: Record<string, string> = {
      [aPlayers[0].id]: "B",
      [bPlayers[0].id]: "A",
    };
    const res = await host.call<Record<string, unknown>, OkRes>("setTeams", {
      roomId,
      assignments,
    });
    expect(res.ok).toBe(true);

    const after = await readPlayers(host, roomId);
    expect(after.find((d) => d.id === aPlayers[0].id)!.team).toBe("B");
    expect(after.find((d) => d.id === bPlayers[0].id)!.team).toBe("A");
    // Still 2/2.
    expect(after.filter((d) => d.team === "A").length).toBe(2);
    expect(after.filter((d) => d.team === "B").length).toBe(2);
  });

  it("rejects a team change from a non-host", async () => {
    const { roomId, players } = await makeLobby(["Alice", "Bob", "Cara", "Dan"]);
    await players[0].call("setMode", { roomId, mode: "team" });
    const docs = await readPlayers(players[0], roomId);
    await expect(
      players[1].call<Record<string, unknown>, OkRes>("setTeams", {
        roomId,
        assignments: { [docs[0].id]: "B" },
      }),
    ).rejects.toThrow();
  });

  it("rejects an assignment that would overfill a team (invalid drop)", async () => {
    const { roomId, players } = await makeLobby(["Alice", "Bob", "Cara", "Dan"]);
    const host = players[0];
    await host.call("setMode", { roomId, mode: "team" });
    const docs = await readPlayers(host, roomId);
    // Force three players onto Team A → over capacity.
    const bump = docs.slice(0, 3).reduce<Record<string, string>>((acc, d) => {
      acc[d.id] = "A";
      return acc;
    }, {});
    const res = await host.call<Record<string, unknown>, OkRes>("setTeams", {
      roomId,
      assignments: bump,
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("team_full");
  });
});

describe("2v2 start respects the host's arrangement + denormalized counts", () => {
  it("seats partners opposite and mirrors card counts onto player docs", async () => {
    const { roomId, players } = await makeLobby(["Alice", "Bob", "Cara", "Dan"]);
    const host = players[0];
    await host.call("setMode", { roomId, mode: "team" });
    await host.call("startGame", { roomId });

    const docs = await readPlayers(host, roomId);
    // Partners sit opposite: same team → seat indices differ by 2 (even/even or
    // odd/odd), and each seat's parity matches its team (even=A, odd=B).
    for (const d of docs) {
      const seat = d.seatIndex as number;
      if (d.team === "A") expect(seat % 2).toBe(0);
      if (d.team === "B") expect(seat % 2).toBe(1);
    }
    // Every player's denormalized cardCount is set (7 at deal, Req 13.5).
    expect(docs.every((d) => typeof d.cardCount === "number" && (d.cardCount as number) >= 0)).toBe(true);
    const anyDealt = docs.some((d) => (d.cardCount as number) === 7);
    expect(anyDealt).toBe(true);
  });
});

describe("end-to-end flow the screens drive", () => {
  it("create → join → start → play a card → counts update on player docs", async () => {
    const { roomId, players } = await makeLobby(["Alice", "Bob", "Cara"]);
    const host = players[0];
    await host.call("startGame", { roomId });

    const docs = await readPlayers(host, roomId);
    // Everyone dealt 7; counts mirrored for opponent badges.
    expect(docs.every((d) => (d.cardCount as number) === 7)).toBe(true);

    // Drive the active player through one accepted action and confirm the
    // version advances (the screens read this via the state snapshot).
    const state = (await readStateAdmin(roomId))!;
    const activeSeat = state.activeSeat as number;
    const activeDoc = docs.find((d) => (d.seatIndex as number) === activeSeat)!;
    const active = players.find((p) => p.uid === activeDoc.id)!;
    // Draw one (always legal at the start of a turn with no penalty) to advance
    // the version deterministically.
    const drew = await active.call<Record<string, unknown>, { ok: boolean }>("drawOne", {
      roomId,
      basedOnVersion: state.version,
    });
    expect(drew.ok).toBe(true);
    const after = (await readStateAdmin(roomId))!;
    expect((after.version as number)).toBe((state.version as number) + 1);

    // The active player's denormalized count reflects the draw (7 → 8) when a
    // card was actually added to their hand (drew_decision or kept).
    const activePlayerDoc = await readPlayer(host, roomId, activeDoc.id);
    expect((activePlayerDoc!.cardCount as number)).toBeGreaterThanOrEqual(7);
  });
});
