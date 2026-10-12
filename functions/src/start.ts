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
import { onCall, HttpsError } from "firebase-functions/v2/https";
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
import type { DealInput } from "../../src/game/engine/deal";
import { createCsprng } from "./rng";
import {
  deckDocFrom,
  handDocForSeat,
  stateDocFieldsFrom,
} from "./mapping";
import type { PlayerDoc, StateDoc, Team } from "./model";

const MIN_NORMAL = 2;
const TEAM_SIZE = 4;

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

    // Deal through the engine (seats assigned by join order; team-alternating).
    const dealInput: DealInput = {
      mode: room.gameMode,
      players: members.map((m) => ({ playerId: m.id })),
    };
    const state = deal(dealInput, createCsprng());

    // Persist seats/team onto each player doc (Req 5.7).
    state.seats.forEach((seat) => {
      const update: { seatIndex: number; team: Team | null } = {
        seatIndex: seat.seat,
        team: seat.team ?? null,
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
