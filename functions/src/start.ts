/**
 * `startGame` callable (Task 4.3).
 *
 * Host-only. Validates the mode constraints (Normal ≥2, Team exactly 4 — Req
 * 4.7/4.8), assigns seats in join order (team-alternating A/B in 2v2 so partners
 * sit opposite — Req 5.7), DEALS through the pure engine (`deal`) which shuffles
 * with an injected CSPRNG, writes the hand docs + the server-only `private/deck`
 * + the public `state/current` (phase `active`, host first active, direction +1,
 * version 1), flips the room to `playing`, and commits — all in one transaction
 * (Req 5.2, 5.6).
 *
 * Deck secrecy (Req 23.2): the shuffled draw order goes ONLY to `private/deck`;
 * `state/current` carries just the public discard/color/seat/etc.
 */
import { HttpsError, onCall } from "firebase-functions/v2/https";
import type { DealInput } from "../../src/game/engine/deal";
import {
    db,
    deckRef,
    handRef,
    playerRef,
    playersRef,
    roomRef,
    stateRef,
    Timestamp,
} from "./admin";
import { deal } from "./engine";
import {
    deckDocFrom,
    handDocForSeat,
    stateDocFieldsFrom,
} from "./mapping";
import type { PlayerDoc, StateDoc, Team } from "./model";
import { createCsprng } from "./rng";

const MIN_NORMAL = 2;
const TEAM_SIZE = 4;

/**
 * Order Team-mode members so the engine's even/odd seat parity (even → Team A,
 * odd → Team B) reproduces the host's persisted A/B split with partners
 * opposite: seats [A0, B0, A1, B1]. Returns `null` when the split is not
 * exactly two-and-two (a partially-assigned lobby), letting the caller fall
 * back to join order or reject.
 */
function interleaveByTeam(
  members: { id: string; doc: PlayerDoc }[],
): { id: string; doc: PlayerDoc }[] | null {
  const teamA = members
    .filter((m) => m.doc.team === "A")
    .sort((a, b) => a.doc.joinOrder - b.doc.joinOrder);
  const teamB = members
    .filter((m) => m.doc.team === "B")
    .sort((a, b) => a.doc.joinOrder - b.doc.joinOrder);
  if (teamA.length !== 2 || teamB.length !== 2) return null;
  return [teamA[0], teamB[0], teamA[1], teamB[1]];
}

export const startGame = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");

  const roomId = String(request.data?.roomId ?? "").trim();
  if (!roomId) throw new HttpsError("invalid-argument", "roomId is required.");

  await db.runTransaction(async (tx) => {
    const roomSnap = await tx.get(roomRef(roomId));
    if (!roomSnap.exists) throw new HttpsError("not-found", "Room not found.");
    const room = roomSnap.data()!;

    if (room.hostPlayerId !== uid) {
      throw new HttpsError("permission-denied", "Only the host can start the game.");
    }
    if (room.phase !== "lobby") {
      throw new HttpsError("failed-precondition", "The game has already started.");
    }

    const playersSnap = await tx.get(playersRef(roomId));
    const members = playersSnap.docs
      .map((d) => ({ id: d.id, doc: d.data() as PlayerDoc }))
      .filter((p) => !p.doc.hasLeft)
      .sort((a, b) => a.doc.joinOrder - b.doc.joinOrder);

    // Mode constraints (Req 4.7, 4.8).
    if (room.gameMode === "team" && members.length !== TEAM_SIZE) {
      throw new HttpsError("failed-precondition", "Team mode needs exactly 4 players.");
    }
    if (room.gameMode === "normal" && members.length < MIN_NORMAL) {
      throw new HttpsError("failed-precondition", "Need at least 2 players to start.");
    }

    // Order the players so the engine's seat-parity team assignment (even seats
    // → Team A, odd → Team B) reproduces the HOST'S arrangement from the lobby
    // (Req 5.7 / 21.x). In Team mode we interleave the two teams [A0, B0, A1,
    // B1] so partners sit opposite; when a team assignment is missing we fall
    // back to join order. Normal mode keeps plain join order.
    const ordered =
      room.gameMode === "team" ? interleaveByTeam(members) : members;
    if (room.gameMode === "team" && ordered === null) {
      throw new HttpsError(
        "failed-precondition",
        "Team mode needs exactly two players on each team.",
      );
    }

    // Deal through the engine (seats assigned by the ordered list above).
    const dealInput: DealInput = {
      mode: room.gameMode,
      players: (ordered ?? members).map((m) => ({ playerId: m.id })),
    };
    const state = deal(dealInput, createCsprng());

    // Persist seats/team + denormalized card count onto each player doc (Req
    // 5.7, 13.5). The count is public (badge-only); the cards stay in the
    // per-player hand doc.
    state.seats.forEach((seat, seatIndex) => {
      const update: { seatIndex: number; team: Team | null; cardCount: number } = {
        seatIndex: seat.seat,
        team: seat.team ?? null,
        cardCount: state.hands[seatIndex].length,
      };
      tx.update(playerRef(roomId, seat.playerId), update);
    });

    // Hand docs (one per seat) — hidden per player (Req 23.1).
    state.seats.forEach((seat, seatIndex) => {
      tx.set(handRef(roomId, seat.playerId), handDocForSeat(state, seatIndex));
    });

    // Server-only draw order (Req 23.2).
    tx.set(deckRef(roomId), deckDocFrom(state));

    // Public state doc, version 1.
    const stateDoc: StateDoc = {
      ...stateDocFieldsFrom(state),
      version: 1,
      pausedBy: null,
      pausedAt: null,
      pendingChoice: null,
    };
    tx.set(stateRef(roomId), stateDoc);

    tx.update(roomRef(roomId), {
      phase: "playing",
      lastActivityAt: Timestamp.now(),
    });
  });

  return { ok: true };
});
