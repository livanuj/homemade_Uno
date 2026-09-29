/**
 * Unit tests for the read-only authoritative store reducer (Task 5.1).
 *
 * These are pure — no Firestore, no emulator — so they run under the default
 * `npm run test` (jsdom). They verify the store mirrors server snapshots, keeps
 * itself read-only, and handles the optimistic pending/rejection bookkeeping the
 * action client relies on for revert (Req 14.5).
 */
import { describe, expect, it } from "vitest";
import type { HandDoc, PlayerDoc, RoomDoc, StateDoc } from "@/firebase/types";
import {
  initialStore,
  selectActivePlayer,
  selectIsMyTurn,
  selectVersion,
  storeReducer,
  type RealtimeStore,
  type StorePlayer,
} from "./store";

function room(overrides: Partial<RoomDoc> = {}): RoomDoc {
  return {
    roomCode: "ABCD",
    hostPlayerId: "p1",
    gameMode: "normal",
    phase: "playing",
    roundNumber: 1,
    // Timestamps aren't inspected by the reducer; cast a stub.
    createdAt: { toMillis: () => 0 } as unknown as RoomDoc["createdAt"],
    lastActivityAt: { toMillis: () => 0 } as unknown as RoomDoc["lastActivityAt"],
    ...overrides,
  };
}

function player(id: string, seatIndex: number | null, overrides: Partial<PlayerDoc> = {}): StorePlayer {
  return {
    playerId: id,
    doc: {
      displayName: id,
      seatIndex,
      team: null,
      isHost: id === "p1",
      joinOrder: 0,
      connectionState: "connected",
      lastSeen: { toMillis: () => 0 } as unknown as PlayerDoc["lastSeen"],
      hasLeft: false,
      ...overrides,
    },
  };
}

function state(overrides: Partial<StateDoc> = {}): StateDoc {
  return {
    version: 1,
    discardPile: [],
    activeColor: "red",
    activeSeat: 0,
    direction: 1,
    penaltyCount: 0,
    pendingPenaltyKind: null,
    phase: "active",
    drewThisTurn: false,
    lastCardCalledSeat: null,
    pausedBy: null,
    pausedAt: null,
    pendingChoice: null,
    winner: null,
    ...overrides,
  };
}

const hand: HandDoc = { cards: [{ id: "c1", suit: "red", value: 5 }], cardCount: 1 };

describe("storeReducer", () => {
  it("attach resets to an empty store scoped to the room + player", () => {
    const s = storeReducer(initialStore(), {
      type: "attach",
      roomId: "ABCD",
      playerId: "p1",
    });
    expect(s.roomId).toBe("ABCD");
    expect(s.playerId).toBe("p1");
    expect(s.room).toBeNull();
    expect(s.hydrated).toBe(false);
    expect(s.connection).toBe("connecting");
  });

  it("mirrors room + players snapshots and marks hydrated", () => {
    let s = initialStore("p1");
    s = storeReducer(s, { type: "attach", roomId: "ABCD", playerId: "p1" });
    s = storeReducer(s, { type: "room_snapshot", room: room() });
    expect(s.hydrated).toBe(false); // players not loaded yet
    s = storeReducer(s, {
      type: "players_snapshot",
      players: [player("p1", 0), player("p2", 1)],
    });
    expect(s.hydrated).toBe(true);
    expect(s.players).toHaveLength(2);
  });

  it("a fresh state snapshot clears the optimistic pending action", () => {
    let s: RealtimeStore = {
      ...initialStore("p1"),
      roomId: "ABCD",
      pendingAction: { kind: "play", basedOnVersion: 1, cardId: "c1" },
    };
    s = storeReducer(s, { type: "state_snapshot", state: state({ version: 2 }) });
    expect(s.state?.version).toBe(2);
    expect(s.pendingAction).toBeNull();
  });

  it("a rejection drops the pending action and records the reason (revert)", () => {
    let s: RealtimeStore = {
      ...initialStore("p1"),
      pendingAction: { kind: "play", basedOnVersion: 1, cardId: "c1" },
    };
    s = storeReducer(s, {
      type: "rejected",
      rejection: { kind: "play", reason: "stale_version", at: 123 },
    });
    expect(s.pendingAction).toBeNull();
    expect(s.rejection).toEqual({ kind: "play", reason: "stale_version", at: 123 });
  });

  it("detach returns to an empty store retaining the player id", () => {
    let s = storeReducer(initialStore("p1"), { type: "attach", roomId: "ABCD", playerId: "p1" });
    s = storeReducer(s, { type: "room_snapshot", room: room() });
    s = storeReducer(s, { type: "detach" });
    expect(s.room).toBeNull();
    expect(s.roomId).toBeNull();
    expect(s.playerId).toBe("p1");
  });
});

describe("selectors", () => {
  const base: RealtimeStore = {
    ...initialStore("p2"),
    roomId: "ABCD",
    room: room(),
    players: [player("p1", 0), player("p2", 1)],
    state: state({ activeSeat: 1 }),
    ownHand: hand,
  };

  it("selectVersion reads the authoritative version", () => {
    expect(selectVersion(base)).toBe(1);
    expect(selectVersion(initialStore())).toBeNull();
  });

  it("selectActivePlayer finds the seat at the active index", () => {
    expect(selectActivePlayer(base)?.playerId).toBe("p2");
  });

  it("selectIsMyTurn is true only when own seat is active", () => {
    expect(selectIsMyTurn(base)).toBe(true);
    expect(selectIsMyTurn({ ...base, state: state({ activeSeat: 0 }) })).toBe(false);
  });
});
