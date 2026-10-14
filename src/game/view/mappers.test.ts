import { describe, expect, it } from "vitest";
import type {
  HandDoc,
  PlayerDoc,
  StateDoc,
} from "@/backend/types";
import type { RealtimeStore, StorePlayer } from "@/realtime/store";
import { initialStore } from "@/realtime/store";
import {
  elapsedLabel,
  graceSecondsLeft,
  isCardPlayable,
  selectAutoOverlay,
  startEnablement,
  toGameView,
  toLobbyView,
  toPausedView,
  toResultView,
} from "./mappers";

/**
 * Unit tests for the store → view-model mappers (Task 9). These feed a plain
 * `RealtimeStore` (no backend) and assert the derivation logic:
 * host/guest, start enablement + the 2v2 rules, the game-table projection,
 * wild/drew/paused/game-over overlay selection, and LAST CARD! enablement.
 * They keep the default `npm run test` run backend-independent.
 */

/** Timestamps are epoch milliseconds. */
function ts(ms: number): number {
  return ms;
}

function player(
  playerId: string,
  overrides: Partial<PlayerDoc> = {},
): StorePlayer {
  return {
    playerId,
    doc: {
      displayName: playerId,
      seatIndex: null,
      team: null,
      isHost: false,
      joinOrder: 0,
      connectionState: "connected",
      lastSeen: ts(Date.now()),
      hasLeft: false,
      ...overrides,
    },
  };
}

function baseState(overrides: Partial<StateDoc> = {}): StateDoc {
  return {
    version: 1,
    discardPile: [{ id: "d1", suit: "red", value: 7 }],
    activeColor: "red",
    activeSeat: 0,
    direction: 1,
    penaltyCount: 0,
    pendingPenaltyKind: null,
    phase: "active",
    drewThisTurn: false,
    lastCardCalledSeats: [],
    pausedBy: null,
    pausedAt: null,
    pendingChoice: null,
    winner: null,
    ...overrides,
  };
}

function store(overrides: Partial<RealtimeStore>): RealtimeStore {
  return { ...initialStore("self"), ...overrides };
}

describe("toLobbyView + startEnablement", () => {
  it("marks the host correctly and derives selfId", () => {
    const s = store({
      playerId: "self",
      room: {
        roomCode: "K7QX",
        hostPlayerId: "self",
        gameMode: "normal",
        phase: "lobby",
        roundNumber: 1,
        createdAt: ts(0),
        lastActivityAt: ts(0),
      },
      players: [
        player("self", { displayName: "You", isHost: true, joinOrder: 0 }),
        player("p1", { displayName: "Maya", joinOrder: 1 }),
      ],
    });
    const view = toLobbyView(s)!;
    expect(view.selfId).toBe("self");
    expect(view.room.players.find((p) => p.isHost)?.id).toBe("self");
    expect(view.room.code).toBe("K7QX");
  });

  it("normal mode needs ≥2 players to start", () => {
    const room = {
      code: "K7QX",
      inviteLink: "x",
      mode: "normal" as const,
      phase: "lobby" as const,
      roundNumber: 1,
      players: [
        { id: "self", name: "You", joinOrder: 0, isHost: true, connection: "online" as const },
      ],
    };
    expect(startEnablement(room).disabled).toBe(true);
    expect(startEnablement(room).caption).toMatch(/at least 1 more/i);

    const two = { ...room, players: [...room.players, { id: "p1", name: "Maya", joinOrder: 1, isHost: false, connection: "online" as const }] };
    expect(startEnablement(two).disabled).toBe(false);
  });

  it("2v2 needs exactly 4 players split 2/2", () => {
    const three = {
      code: "K7QX",
      inviteLink: "x",
      mode: "team" as const,
      phase: "lobby" as const,
      roundNumber: 1,
      players: [
        { id: "self", name: "You", joinOrder: 0, isHost: true, connection: "online" as const, team: "A" as const },
        { id: "p1", name: "Maya", joinOrder: 1, isHost: false, connection: "online" as const, team: "A" as const },
        { id: "p2", name: "Leo", joinOrder: 2, isHost: false, connection: "online" as const, team: "B" as const },
      ],
    };
    expect(startEnablement(three).disabled).toBe(true);
    expect(startEnablement(three).caption).toMatch(/3 of 4/);

    const four = {
      ...three,
      players: [
        ...three.players,
        { id: "p3", name: "Sara", joinOrder: 3, isHost: false, connection: "online" as const, team: "B" as const },
      ],
    };
    expect(startEnablement(four).disabled).toBe(false);

    // Lopsided 3/1 is rejected even with four players.
    const lopsided = {
      ...four,
      players: four.players.map((p, i) =>
        i === 2 ? { ...p, team: "A" as const } : p,
      ),
    };
    expect(startEnablement(lopsided).disabled).toBe(true);
  });
});

describe("isCardPlayable (advisory highlight)", () => {
  const state = baseState({ activeColor: "red", discardPile: [{ id: "d", suit: "red", value: 7 }] });

  it("matches on suit or value, and wilds are always playable", () => {
    expect(isCardPlayable({ id: "a", suit: "red", value: 2 }, state)).toBe(true); // suit
    expect(isCardPlayable({ id: "b", suit: "blue", value: 7 }, state)).toBe(true); // value
    expect(isCardPlayable({ id: "c", suit: "blue", value: 2 }, state)).toBe(false);
    expect(isCardPlayable({ id: "w", value: "wild" }, state)).toBe(true);
  });

  it("enforces asymmetric stacking while a penalty is pending", () => {
    const pendingTwo = baseState({ penaltyCount: 2, pendingPenaltyKind: "two" });
    expect(isCardPlayable({ id: "x", suit: "green", value: "+2" }, pendingTwo)).toBe(true);
    expect(isCardPlayable({ id: "y", value: "wild4" }, pendingTwo)).toBe(true);
    expect(isCardPlayable({ id: "z", suit: "red", value: 7 }, pendingTwo)).toBe(false);

    const pendingFour = baseState({ penaltyCount: 4, pendingPenaltyKind: "four" });
    expect(isCardPlayable({ id: "x", suit: "green", value: "+2" }, pendingFour)).toBe(false);
    expect(isCardPlayable({ id: "y", value: "wild4" }, pendingFour)).toBe(true);
  });
});

describe("toGameView", () => {
  function seatedStore(activeSeat: number, ownHand: HandDoc): RealtimeStore {
    return store({
      playerId: "self",
      room: {
        roomCode: "K7QX",
        hostPlayerId: "self",
        gameMode: "normal",
        phase: "playing",
        roundNumber: 1,
        createdAt: ts(0),
        lastActivityAt: ts(0),
      },
      players: [
        player("self", { displayName: "You", seatIndex: 0, isHost: true, cardCount: ownHand.cardCount }),
        player("p1", { displayName: "Maya", seatIndex: 1, joinOrder: 1, cardCount: 5 }),
      ],
      state: baseState({ activeSeat }),
      ownHand,
    });
  }

  it("derives own hand playability + opponent counts + turn ownership", () => {
    const hand: HandDoc = {
      cards: [
        { id: "h1", suit: "red", value: 3 }, // playable (suit red)
        { id: "h2", suit: "blue", value: 9 }, // not playable
      ],
      cardCount: 2,
    };
    const view = toGameView(seatedStore(0, hand))!;
    expect(view.selfId).toBe("self");
    expect(view.activeSeatId).toBe("self");
    expect(view.hand.find((c) => c.id === "h1")?.playable).toBe(true);
    expect(view.hand.find((c) => c.id === "h2")?.playable).toBe(false);
    // Opponent count comes from the denormalized player doc.
    expect(view.opponents.find((o) => o.id === "p1")?.cardCount).toBe(5);
  });

  it("enables UNO only on your turn with exactly two cards, uncalled", () => {
    const two: HandDoc = {
      cards: [
        { id: "h1", suit: "red", value: 3 },
        { id: "h2", suit: "red", value: 4 },
      ],
      cardCount: 2,
    };
    expect(toGameView(seatedStore(0, two))!.canCallLastCard).toBe(true);

    // Not your turn → disabled.
    expect(toGameView(seatedStore(1, two))!.canCallLastCard).toBe(false);

    // Already called this turn → disabled.
    const called = store({
      ...seatedStore(0, two),
      state: baseState({ activeSeat: 0, lastCardCalledSeats: [0] }),
    });
    expect(toGameView(called)!.canCallLastCard).toBe(false);

    // Three cards → disabled.
    const three: HandDoc = { cards: [...two.cards, { id: "h3", value: "wild" }], cardCount: 3 };
    expect(toGameView(seatedStore(0, three))!.canCallLastCard).toBe(false);
  });

  it("on 1 card uncalled, UNO stays enabled on any turn (a late call)", () => {
    const one: HandDoc = { cards: [{ id: "h1", suit: "red", value: 3 }], cardCount: 1 };
    expect(toGameView(seatedStore(1, one))!.canCallLastCard).toBe(true);
    const called = store({
      ...seatedStore(1, one),
      state: baseState({ activeSeat: 1, lastCardCalledSeats: [0] }),
    });
    expect(toGameView(called)!.canCallLastCard).toBe(false);
  });

  it("re-enables UNO after drawing a playable card on 2 cards (play-or-keep)", () => {
    // Called on 2, threw down to 1, then drew next turn: the draw cleared the
    // call, and the drawn card is playable. Before playing it down to 1 card
    // again, the player must be able to call UNO again.
    const two: HandDoc = {
      cards: [
        { id: "h1", suit: "red", value: 3 },
        { id: "h2", suit: "red", value: 4 },
      ],
      cardCount: 2,
    };
    const deciding = store({
      ...seatedStore(0, two),
      state: baseState({ activeSeat: 0, phase: "drew_decision", lastCardCalledSeats: [] }),
    });
    expect(toGameView(deciding)!.canCallLastCard).toBe(true);
  });

  it("lists who has a standing UNO call (the UNO tag)", () => {
    const one: HandDoc = { cards: [{ id: "h1", suit: "red", value: 3 }], cardCount: 1 };
    const s = store({
      ...seatedStore(1, one),
      state: baseState({ activeSeat: 1, lastCardCalledSeats: [0] }),
    });
    expect(toGameView(s)!.unoCalledIds).toEqual(["self"]);
  });

  describe("catchTargets", () => {
    const three: HandDoc = {
      cards: [
        { id: "h1", suit: "red", value: 3 },
        { id: "h2", suit: "red", value: 4 },
        { id: "h3", suit: "red", value: 5 },
      ],
      cardCount: 3,
    };
    function withOpponentCount(cardCount: number, state: Partial<StateDoc> = {}): RealtimeStore {
      const base = seatedStore(0, three);
      return store({
        ...base,
        players: [
          base.players[0]!,
          player("p1", { displayName: "Maya", seatIndex: 1, joinOrder: 1, cardCount }),
        ],
        state: baseState({ activeSeat: 0, ...state }),
      });
    }

    it("lists an opponent on 1 card who has not called", () => {
      expect(toGameView(withOpponentCount(1))!.catchTargets).toEqual([{ id: "p1", name: "Maya" }]);
    });

    it("is empty once they call, when they hold 2+ cards, or when the game ended", () => {
      expect(toGameView(withOpponentCount(1, { lastCardCalledSeats: [1] }))!.catchTargets).toEqual([]);
      expect(toGameView(withOpponentCount(2))!.catchTargets).toEqual([]);
      expect(toGameView(withOpponentCount(1, { phase: "ended" }))!.catchTargets).toEqual([]);
    });

    it("never lists your partner in 2v2", () => {
      const base = seatedStore(0, three);
      const team = store({
        ...base,
        room: { ...base.room!, gameMode: "team" },
        players: [
          player("self", { displayName: "You", seatIndex: 0, isHost: true, team: "A", cardCount: 3 }),
          player("b0", { displayName: "Maya", seatIndex: 1, joinOrder: 1, team: "B", cardCount: 1 }),
          player("a1", { displayName: "Leo", seatIndex: 2, joinOrder: 2, team: "A", cardCount: 1 }),
          player("b1", { displayName: "Nora", seatIndex: 3, joinOrder: 3, team: "B", cardCount: 4 }),
        ],
      });
      expect(toGameView(team)!.catchTargets).toEqual([{ id: "b0", name: "Maya" }]);
    });
  });
});

describe("selectAutoOverlay", () => {
  const now = 1_000_000;

  function playingStore(phase: StateDoc["phase"], overrides: Partial<StateDoc> = {}): RealtimeStore {
    return store({
      playerId: "self",
      room: {
        roomCode: "K7QX",
        hostPlayerId: "self",
        gameMode: "normal",
        phase: "playing",
        roundNumber: 1,
        createdAt: ts(0),
        lastActivityAt: ts(0),
      },
      players: [
        player("self", { displayName: "You", seatIndex: 0, isHost: true }),
        player("p1", { displayName: "Maya", seatIndex: 1, joinOrder: 1 }),
      ],
      state: baseState({ phase, activeSeat: 0, ...overrides }),
      ownHand: { cards: [{ id: "h1", value: "wild4" }], cardCount: 1 },
    });
  }

  it("shows the wild picker on your own wild_pending turn", () => {
    expect(selectAutoOverlay(playingStore("wild_pending"), now).overlay).toBe("wild");
  });

  it("shows the drew sheet on your own drew_decision turn", () => {
    expect(selectAutoOverlay(playingStore("drew_decision"), now).overlay).toBe("drew");
  });

  it("shows the disconnected state for a disconnected active opponent", () => {
    const s = store({
      ...playingStore("active", { activeSeat: 1 }),
      players: [
        player("self", { displayName: "You", seatIndex: 0, isHost: true }),
        player("p1", {
          displayName: "Maya",
          seatIndex: 1,
          joinOrder: 1,
          connectionState: "disconnected",
          lastSeen: ts(now - 20_000),
        }),
      ],
    });
    const result = selectAutoOverlay(s, now);
    expect(result.overlay).toBe("disconnected");
    expect(result.disconnect?.name).toBe("Maya");
    expect(result.disconnect?.secondsLeft).toBe(40); // 60 - 20
  });

  it("returns no overlay during a plain active turn", () => {
    expect(selectAutoOverlay(playingStore("active", { activeSeat: 1 }), now).overlay).toBe(null);
  });
});

describe("toPausedView", () => {
  const now = 500_000;

  function pausedStore(
    phase: "paused" | "auto_paused",
    players: StorePlayer[],
    pausedBy: string | null,
  ): RealtimeStore {
    return store({
      playerId: "self",
      room: {
        roomCode: "K7QX",
        hostPlayerId: "self",
        gameMode: phase === "auto_paused" ? "team" : "normal",
        phase: "playing",
        roundNumber: 1,
        createdAt: ts(0),
        lastActivityAt: ts(0),
      },
      players,
      state: baseState({ phase, pausedBy, pausedAt: ts(now - 74_000) }),
    });
  }

  it("break variant when everyone is connected", () => {
    const view = toPausedView(
      pausedStore(
        "paused",
        [
          player("self", { displayName: "You", seatIndex: 0, isHost: true }),
          player("p1", { displayName: "Maya", seatIndex: 1, joinOrder: 1 }),
        ],
        "p1",
      ),
      now,
    )!;
    expect(view.variant).toBe("break");
    expect(view.title).toBe("Game paused");
    expect(view.elapsedLabel).toBe("Paused for 1:14");
  });

  it("waiting variant when a player is offline during a manual pause", () => {
    const view = toPausedView(
      pausedStore(
        "paused",
        [
          player("self", { displayName: "You", seatIndex: 0, isHost: true }),
          player("p1", { displayName: "Nora", seatIndex: 1, joinOrder: 1, connectionState: "disconnected" }),
        ],
        "self",
      ),
      now,
    )!;
    expect(view.variant).toBe("waiting");
    expect(view.title).toBe("Waiting for Nora");
    expect(view.offlineName).toBe("Nora");
  });

  it("auto variant names the offline team", () => {
    const view = toPausedView(
      pausedStore(
        "auto_paused",
        [
          player("self", { displayName: "You", seatIndex: 0, isHost: true, team: "A" }),
          player("m", { displayName: "Maya", seatIndex: 2, joinOrder: 1, team: "A" }),
          player("leo", { displayName: "Leo", seatIndex: 1, joinOrder: 2, team: "B", connectionState: "disconnected" }),
          player("sara", { displayName: "Sara", seatIndex: 3, joinOrder: 3, team: "B", connectionState: "disconnected" }),
        ],
        null,
      ),
      now,
    )!;
    expect(view.variant).toBe("auto");
    expect(view.title).toBe("Team B lost connection");
    expect(view.offlineTeam).toBe("B");
  });

  it("returns null when not paused", () => {
    const s = pausedStore("paused", [player("self")], "self");
    expect(toPausedView({ ...s, state: baseState({ phase: "active" }) }, now)).toBeNull();
  });
});

describe("toResultView", () => {
  function endedStore(winner: StateDoc["winner"], selfIsHost = true): RealtimeStore {
    return store({
      playerId: "self",
      room: {
        roomCode: "K7QX",
        hostPlayerId: selfIsHost ? "self" : "p1",
        gameMode: "normal",
        phase: "ended",
        roundNumber: 1,
        createdAt: ts(0),
        lastActivityAt: ts(0),
      },
      players: [
        player("self", { displayName: "You", seatIndex: 0, isHost: selfIsHost, cardCount: 3 }),
        player("p1", { displayName: "Maya", seatIndex: 1, joinOrder: 1, isHost: !selfIsHost, cardCount: 0 }),
      ],
      state: baseState({ phase: "ended", winner }),
      ownHand: { cards: [], cardCount: 3 },
    });
  }

  it("names the winning player and flags who went out", () => {
    const view = toResultView(endedStore({ kind: "player", playerId: "p1", seatIndex: 1 }))!;
    expect(view.kind).toBe("player");
    expect(view.title).toBe("Maya wins!");
    expect(view.winners.map((w) => w.id)).toEqual(["p1"]);
    expect(view.players.find((p) => p.id === "p1")?.wentOut).toBe(true);
    expect(view.selfIsHost).toBe(true);
  });

  it("no-winner (Game ended) has no confetti kind and host still sees play again", () => {
    const view = toResultView(endedStore(null))!;
    expect(view.kind).toBe("none");
    expect(view.title).toBe("Game ended");
    expect(view.winners).toHaveLength(0);
  });

  it("guest sees selfIsHost = false", () => {
    const view = toResultView(endedStore({ kind: "player", playerId: "p1", seatIndex: 1 }, false))!;
    expect(view.selfIsHost).toBe(false);
  });

  it("returns null before the game ends", () => {
    const s = endedStore(null);
    expect(toResultView({ ...s, state: baseState({ phase: "active" }) })).toBeNull();
  });
});

describe("grace + elapsed helpers", () => {
  it("graceSecondsLeft counts down from 60 and clamps at 0", () => {
    const now = 1_000_000;
    expect(graceSecondsLeft(player("x").doc, now)).toBe(60); // fresh (lastSeen≈now via Date.now in helper won't match; use explicit)
    const doc = { ...player("x").doc, lastSeen: ts(now - 15_000) };
    expect(graceSecondsLeft(doc, now)).toBe(45);
    const stale = { ...player("x").doc, lastSeen: ts(now - 90_000) };
    expect(graceSecondsLeft(stale, now)).toBe(0);
  });

  it("elapsedLabel formats m:ss", () => {
    expect(elapsedLabel(1_000_000 - 74_000, 1_000_000)).toBe("Paused for 1:14");
    expect(elapsedLabel(null, 1_000_000)).toBe("Paused for 0:00");
  });
});
