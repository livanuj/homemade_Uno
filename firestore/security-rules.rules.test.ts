/**
 * Firestore Security Rules tests (Task 2.4).
 *
 * Runs against the Firestore emulator via `npm run test:rules`
 * (`firebase emulators:exec ... vitest run`). Seeds are written with a
 * security-rules-DISABLED (admin) context; assertions run under authenticated
 * client contexts to prove the rules in `firestore.rules`.
 *
 * Validates: Requirements 14.6, 23.1, 23.2.
 *
 * Assertions:
 *  - Normal mode: player A CANNOT read player B's hand.
 *  - Team mode:   a partner's hand IS readable; an opponent's is NOT.
 *  - private/deck (draw pile) is UNREADABLE by any client.
 *  - Clients CANNOT write state / hands / actions / private.
 *  - A player CAN update only their own players/{uid} lastSeen, but NOT other
 *    fields and NOT another player's doc.
 */
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
    type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
    doc,
    getDoc,
    serverTimestamp,
    setDoc,
    updateDoc,
} from "firebase/firestore";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const PROJECT_ID = "demo-homemade-uno";
const rulesPath = fileURLToPath(new URL("../firestore.rules", import.meta.url));

// --- room / player identifiers used across the tests ------------------------
const NORMAL_ROOM = "ROOMN";
const TEAM_ROOM = "ROOMT";

// Normal room: two unrelated players.
const N_A = "normalPlayerA";
const N_B = "normalPlayerB";

// Team room: A1+A2 are partners (team A); B1 is an opponent (team B).
const T_A1 = "teamA1";
const T_A2 = "teamA2";
const T_B1 = "teamB1";

let testEnv: RulesTestEnvironment;

function card(id: string) {
  return { id, suit: "red", value: 5 as const };
}

/** Seed both rooms with players, state, hands, and a private deck (admin). */
async function seed(): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    // ---- Normal room ----
    await setDoc(doc(db, "rooms", NORMAL_ROOM), {
      roomCode: NORMAL_ROOM,
      hostPlayerId: N_A,
      gameMode: "normal",
      phase: "playing",
      roundNumber: 1,
    });
    await setDoc(doc(db, "rooms", NORMAL_ROOM, "players", N_A), {
      displayName: "Ada",
      seatIndex: 0,
      team: null,
      isHost: true,
      joinOrder: 0,
      connectionState: "connected",
    });
    await setDoc(doc(db, "rooms", NORMAL_ROOM, "players", N_B), {
      displayName: "Ben",
      seatIndex: 1,
      team: null,
      isHost: false,
      joinOrder: 1,
      connectionState: "connected",
    });
    await setDoc(doc(db, "rooms", NORMAL_ROOM, "state", "current"), {
      version: 1,
      discardPile: [card("d1")],
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
    });
    await setDoc(doc(db, "rooms", NORMAL_ROOM, "hands", N_A), {
      cards: [card("na1")],
      cardCount: 1,
    });
    await setDoc(doc(db, "rooms", NORMAL_ROOM, "hands", N_B), {
      cards: [card("nb1")],
      cardCount: 1,
    });
    await setDoc(doc(db, "rooms", NORMAL_ROOM, "private", "deck"), {
      drawPile: [card("deck1"), card("deck2")],
    });

    // ---- Team room ----
    await setDoc(doc(db, "rooms", TEAM_ROOM), {
      roomCode: TEAM_ROOM,
      hostPlayerId: T_A1,
      gameMode: "team",
      phase: "playing",
      roundNumber: 1,
    });
    await setDoc(doc(db, "rooms", TEAM_ROOM, "players", T_A1), {
      displayName: "Amy",
      seatIndex: 0,
      team: "A",
      isHost: true,
      joinOrder: 0,
      connectionState: "connected",
    });
    await setDoc(doc(db, "rooms", TEAM_ROOM, "players", T_A2), {
      displayName: "Ari",
      seatIndex: 2,
      team: "A",
      isHost: false,
      joinOrder: 2,
      connectionState: "connected",
    });
    await setDoc(doc(db, "rooms", TEAM_ROOM, "players", T_B1), {
      displayName: "Bea",
      seatIndex: 1,
      team: "B",
      isHost: false,
      joinOrder: 1,
      connectionState: "connected",
    });
    await setDoc(doc(db, "rooms", TEAM_ROOM, "hands", T_A1), {
      cards: [card("ta1")],
      cardCount: 1,
    });
    await setDoc(doc(db, "rooms", TEAM_ROOM, "hands", T_A2), {
      cards: [card("ta2")],
      cardCount: 1,
    });
    await setDoc(doc(db, "rooms", TEAM_ROOM, "hands", T_B1), {
      cards: [card("tb1")],
      cardCount: 1,
    });
    await setDoc(doc(db, "rooms", TEAM_ROOM, "private", "deck"), {
      drawPile: [card("tdeck1")],
    });
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(rulesPath, "utf8") },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed();
});

describe("hands read scope — Normal mode", () => {
  it("player A can read their OWN hand", async () => {
    const a = testEnv.authenticatedContext(N_A).firestore();
    await assertSucceeds(getDoc(doc(a, "rooms", NORMAL_ROOM, "hands", N_A)));
  });

  it("player A CANNOT read player B's hand", async () => {
    const a = testEnv.authenticatedContext(N_A).firestore();
    await assertFails(getDoc(doc(a, "rooms", NORMAL_ROOM, "hands", N_B)));
  });
});

describe("hands read scope — Team mode", () => {
  it("a partner's hand IS readable (same team, same room)", async () => {
    const a1 = testEnv.authenticatedContext(T_A1).firestore();
    await assertSucceeds(getDoc(doc(a1, "rooms", TEAM_ROOM, "hands", T_A2)));
  });

  it("an opponent's hand is NOT readable", async () => {
    const a1 = testEnv.authenticatedContext(T_A1).firestore();
    await assertFails(getDoc(doc(a1, "rooms", TEAM_ROOM, "hands", T_B1)));
  });

  it("the opponent cannot read a team member's hand either", async () => {
    const b1 = testEnv.authenticatedContext(T_B1).firestore();
    await assertFails(getDoc(doc(b1, "rooms", TEAM_ROOM, "hands", T_A1)));
  });
});

describe("private/deck is unreadable by any client", () => {
  it("a room member CANNOT read the draw pile (Normal)", async () => {
    const a = testEnv.authenticatedContext(N_A).firestore();
    await assertFails(getDoc(doc(a, "rooms", NORMAL_ROOM, "private", "deck")));
  });

  it("a room member CANNOT read the draw pile (Team)", async () => {
    const a1 = testEnv.authenticatedContext(T_A1).firestore();
    await assertFails(getDoc(doc(a1, "rooms", TEAM_ROOM, "private", "deck")));
  });
});

describe("public docs readable by room members", () => {
  it("a member can read room, players, and state", async () => {
    const a = testEnv.authenticatedContext(N_A).firestore();
    await assertSucceeds(getDoc(doc(a, "rooms", NORMAL_ROOM)));
    await assertSucceeds(getDoc(doc(a, "rooms", NORMAL_ROOM, "players", N_B)));
    await assertSucceeds(getDoc(doc(a, "rooms", NORMAL_ROOM, "state", "current")));
  });
});

describe("clients cannot write game documents", () => {
  it("client CANNOT write state/current", async () => {
    const a = testEnv.authenticatedContext(N_A).firestore();
    await assertFails(
      updateDoc(doc(a, "rooms", NORMAL_ROOM, "state", "current"), { version: 2 }),
    );
  });

  it("client CANNOT write their own hand", async () => {
    const a = testEnv.authenticatedContext(N_A).firestore();
    await assertFails(
      updateDoc(doc(a, "rooms", NORMAL_ROOM, "hands", N_A), { cardCount: 0 }),
    );
  });

  it("client CANNOT write the actions log", async () => {
    const a = testEnv.authenticatedContext(N_A).firestore();
    await assertFails(
      setDoc(doc(a, "rooms", NORMAL_ROOM, "actions", "act1"), {
        playerId: N_A,
        type: "play",
        basedOnVersion: 1,
        result: "accepted",
      }),
    );
  });

  it("client CANNOT write the private deck", async () => {
    const a = testEnv.authenticatedContext(N_A).firestore();
    await assertFails(
      updateDoc(doc(a, "rooms", NORMAL_ROOM, "private", "deck"), { drawPile: [] }),
    );
  });
});

describe("player presence write scope", () => {
  it("a player CAN update only their own lastSeen", async () => {
    const a = testEnv.authenticatedContext(N_A).firestore();
    await assertSucceeds(
      updateDoc(doc(a, "rooms", NORMAL_ROOM, "players", N_A), {
        lastSeen: serverTimestamp(),
      }),
    );
  });

  it("a player CANNOT change other fields on their own doc", async () => {
    const a = testEnv.authenticatedContext(N_A).firestore();
    await assertFails(
      updateDoc(doc(a, "rooms", NORMAL_ROOM, "players", N_A), {
        displayName: "Hacker",
      }),
    );
  });

  it("a player CANNOT change lastSeen bundled with a forbidden field", async () => {
    const a = testEnv.authenticatedContext(N_A).firestore();
    await assertFails(
      updateDoc(doc(a, "rooms", NORMAL_ROOM, "players", N_A), {
        lastSeen: serverTimestamp(),
        // A genuine value change to a server-only field (N_A is host in the
        // seed, so this actually flips it) — must be rejected alongside the
        // otherwise-allowed lastSeen.
        isHost: false,
      }),
    );
  });

  it("a player CANNOT update another player's doc", async () => {
    const a = testEnv.authenticatedContext(N_A).firestore();
    await assertFails(
      updateDoc(doc(a, "rooms", NORMAL_ROOM, "players", N_B), {
        lastSeen: serverTimestamp(),
      }),
    );
  });
});
