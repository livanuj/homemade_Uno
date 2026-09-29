/**
 * Unit tests for the versioned action client (Task 5.1).
 *
 * Pure/mocked — no emulator — so they run under the default `npm run test`. They
 * verify the client stamps `basedOnVersion` from the store, records an
 * optimistic pending action, and on a REJECTION dispatches the revert marker
 * (Req 14.5). `callAction` is mocked so no network/SDK is touched.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const callActionMock = vi.fn();
vi.mock("@/firebase/callAction", () => ({
  callAction: (...args: unknown[]) => callActionMock(...args),
}));

import { makeActionClient } from "./actions";
import { initialStore, type RealtimeStore, type StoreAction } from "./store";
import type { StateDoc } from "@/firebase/types";

function stateAt(version: number): StateDoc {
  return {
    version,
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
  };
}

function storeWith(version: number | null): RealtimeStore {
  return {
    ...initialStore("p1"),
    roomId: "ABCD",
    state: version === null ? null : stateAt(version),
  };
}

describe("action client", () => {
  beforeEach(() => callActionMock.mockReset());

  it("stamps basedOnVersion from the current store and records a pending action", async () => {
    callActionMock.mockResolvedValue({ ok: true, version: 6, data: { ok: true, version: 6 } });
    const dispatched: StoreAction[] = [];
    const client = makeActionClient(storeWith(5), (a) => dispatched.push(a));

    const res = await client.playCard("c1");

    expect(callActionMock).toHaveBeenCalledWith("playCard", {
      roomId: "ABCD",
      basedOnVersion: 5,
      cardId: "c1",
    });
    expect(res.ok).toBe(true);
    // Optimistic pending action recorded; NOT reverted on accept.
    expect(dispatched).toContainEqual({
      type: "pending_action",
      pending: { kind: "play", basedOnVersion: 5, cardId: "c1" },
    });
    expect(dispatched.some((a) => a.type === "rejected")).toBe(false);
  });

  it("on rejection dispatches the revert marker with the server reason", async () => {
    callActionMock.mockResolvedValue({ ok: false, reason: "stale_version", data: { ok: false } });
    const dispatched: StoreAction[] = [];
    const client = makeActionClient(storeWith(5), (a) => dispatched.push(a));

    const res = await client.drawOne();

    expect(res.ok).toBe(false);
    const reject = dispatched.find((a) => a.type === "rejected");
    expect(reject).toBeDefined();
    expect(reject && "rejection" in reject && reject.rejection.reason).toBe("stale_version");
  });

  it("refuses a versioned action with no active game", async () => {
    const client = makeActionClient(storeWith(null), () => {});
    const res = await client.playCard("c1");
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("no_active_game");
    expect(callActionMock).not.toHaveBeenCalled();
  });

  it("leave/playAgain/enforceGrace do not stamp a version", async () => {
    callActionMock.mockResolvedValue({ ok: true, data: { ok: true } });
    const client = makeActionClient(storeWith(5), () => {});
    await client.leave();
    expect(callActionMock).toHaveBeenLastCalledWith("leave", { roomId: "ABCD" });
    await client.enforceGrace();
    expect(callActionMock).toHaveBeenLastCalledWith("enforceGrace", { roomId: "ABCD" });
  });
});
