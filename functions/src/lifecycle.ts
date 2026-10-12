/**
 * Non-engine lifecycle callables (Tasks 4.5, 4.6, 4.7).
 *
 * These do NOT run the pure reducer — they manipulate the room/state/player
 * documents directly (turn phase, connection, host, round) per the requirements:
 *
 *   4.5  endGame          — end with no winner (Auto_Pause "End game", Req 22.3).
 *        leave            — mark left/disconnected, skip their turns with no
 *                           grace, continue-without behavior, auto-pause if the
 *                           predicate holds (Req 22.2, 22.3, 25.13).
 *   4.6  pause / resume    — set phase paused/active + pausedBy/pausedAt;
 *                           re-show pendingChoice on resume (Req 25.1,25.6,25.7,
 *                           25.9,25.14).
 *        continueWithout  — resume and skip the disconnected player (Req 25.14).
 *   4.7  host succession   — on host leave/disconnect (lobby or end) pass host to
 *                           the longest-present connected player (Req 3.6,12.7,
 *                           15.8).
 *        playAgain        — everyone back to lobby, same mode/teams, roundNumber
 *                           incremented (Req 12.5, 12.6).
 *
 * The active-player skip logic here steps over players who are `left` or (for
 * continue-without) disconnected, mirroring Req 15.5's "skip later turns
 * immediately".
 */
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
    actionsRef,
    db,
    deckRef,
    handRef,
    playerRef,
    playersRef,
    roomRef,
    stateRef,
    Timestamp,
} from "./admin";
import type { ConnectionSnapshot } from "./engine";
import { shouldAutoPause } from "./engine";
import type { ActionType, PlayerDoc, StateDoc } from "./model";

/** A seated player with id, sorted helpers below rely on `seatIndex`. */
interface Seated {
  id: string;
  doc: PlayerDoc;
}

function seatedSorted(players: Seated[]): Seated[] {
  return players
    .filter((p) => p.doc.seatIndex !== null)
    .sort((a, b) => (a.doc.seatIndex as number) - (b.doc.seatIndex as number));
}

/** Log a lifecycle action (best-effort, inside the same transaction). */
function logAction(
  tx: FirebaseFirestore.Transaction,
  roomId: string,
  playerId: string,
  type: ActionType,
  basedOnVersion: number,
  result: string,
) {
  tx.set(actionsRef(roomId).doc(), {
    playerId,
    type,
    basedOnVersion,
    result,
    createdAt: FieldValue.serverTimestamp() as unknown as Timestamp,
  });
}

/** Build the connection snapshots for the auto-pause predicate (Req 15.7). */
function connectionSnapshots(players: Seated[]): ConnectionSnapshot[] {
  return seatedSorted(players).map((p) => {
    const snap: { playerId: string; team?: "A" | "B"; connection: PlayerDoc["connectionState"] } = {
      playerId: p.id,
      connection: p.doc.connectionState,
    };
    if (p.doc.team !== null) snap.team = p.doc.team;
    return snap;
  });
}

/**
 * Advance the active seat to the next seat that is NOT skipped. `isSkipped`
 * returns true for seats that must be passed over (left, or — for
 * continue-without — disconnected). Falls back to the current seat if everyone
 * else is skipped (auto-pause will handle the <2-connected case).
 */
function advanceSkipping(
  seats: Seated[],
  activeSeat: number,
  direction: 1 | -1,
  isSkipped: (p: Seated) => boolean,
): number {
  const n = seats.length;
  for (let step = 1; step <= n; step++) {
    const idx = (((activeSeat + direction * step) % n) + n) % n;
    if (!isSkipped(seats[idx])) return idx;
  }
  return activeSeat;
}

function requireAuthUid(auth: { uid: string } | undefined): string {
  if (!auth) throw new HttpsError("unauthenticated", "Sign in required.");
  return auth.uid;
}

// ---------------------------------------------------------------------------
// pause / resume / continueWithout (4.6)
// ---------------------------------------------------------------------------

export const pause = onCall(async (request) => {
  const uid = requireAuthUid(request.auth);
  const roomId = String(request.data?.roomId ?? "").trim();
  if (!roomId) throw new HttpsError("invalid-argument", "roomId is required.");

  return db.runTransaction(async (tx) => {
    const stateSnap = await tx.get(stateRef(roomId));
    if (!stateSnap.exists) throw new HttpsError("not-found", "No active game.");
    const state = stateSnap.data()!;
    if (state.phase === "ended") {
      return { ok: false, reason: "game_ended" };
    }
    if (state.phase === "paused" || state.phase === "auto_paused") {
      return { ok: false, reason: "already_paused" };
    }

    // Capture any mid-turn choice so it can be re-shown on resume (Req 25.14).
    const pendingChoice = pendingChoiceForPhase(state);

    tx.update(stateRef(roomId), {
      phase: "paused",
      pausedBy: uid,
      pausedAt: Timestamp.now(),
      pendingChoice,
      version: state.version + 1,
    });
    logAction(tx, roomId, uid, "pause", state.version, "accepted");
    return { ok: true, version: state.version + 1 };
  });
});

export const resume = onCall(async (request) => {
  const uid = requireAuthUid(request.auth);
  const roomId = String(request.data?.roomId ?? "").trim();
  if (!roomId) throw new HttpsError("invalid-argument", "roomId is required.");

  return db.runTransaction(async (tx) => {
    const stateSnap = await tx.get(stateRef(roomId));
    if (!stateSnap.exists) throw new HttpsError("not-found", "No active game.");
    const state = stateSnap.data()!;
    if (state.phase !== "paused" && state.phase !== "auto_paused") {
      return { ok: false, reason: "not_paused" };
    }

    // Return to the phase implied by any pendingChoice, else `active`
    // (Req 25.14 re-shows the choice to the same player).
    const restoredPhase = phaseFromPendingChoice(state);

    tx.update(stateRef(roomId), {
      phase: restoredPhase,
      pausedBy: null,
      pausedAt: null,
      version: state.version + 1,
    });
    logAction(tx, roomId, uid, "resume", state.version, "accepted");
    return { ok: true, version: state.version + 1 };
  });
});

export const continueWithout = onCall(async (request) => {
  const uid = requireAuthUid(request.auth);
  const roomId = String(request.data?.roomId ?? "").trim();
  if (!roomId) throw new HttpsError("invalid-argument", "roomId is required.");

  return db.runTransaction(async (tx) => {
    const stateSnap = await tx.get(stateRef(roomId));
    if (!stateSnap.exists) throw new HttpsError("not-found", "No active game.");
    const state = stateSnap.data()!;

    const playersSnap = await tx.get(playersRef(roomId));
    const players: Seated[] = playersSnap.docs.map((d) => ({
      id: d.id,
      doc: d.data() as PlayerDoc,
    }));
    const seats = seatedSorted(players);

    // If the disconnected/left player is the active player, skip their turn
    // (drawing a pending penalty is left for the grace/skip flow in Task 5).
    const isSkipped = (p: Seated) =>
      p.doc.connectionState !== "connected" || p.doc.hasLeft;

    let activeSeat = state.activeSeat;
    if (seats[activeSeat] && isSkipped(seats[activeSeat])) {
      activeSeat = advanceSkipping(seats, activeSeat, state.direction, isSkipped);
    }

    const restoredPhase = phaseFromPendingChoice(state);

    tx.update(stateRef(roomId), {
      phase: restoredPhase,
      pausedBy: null,
      pausedAt: null,
      activeSeat,
      drewThisTurn: false,
      version: state.version + 1,
    });
    logAction(tx, roomId, uid, "continue_without", state.version, "accepted");
    return { ok: true, version: state.version + 1, activeSeat };
  });
});

// ---------------------------------------------------------------------------
// endGame / leave (4.5)
// ---------------------------------------------------------------------------

export const endGame = onCall(async (request) => {
  const uid = requireAuthUid(request.auth);
  const roomId = String(request.data?.roomId ?? "").trim();
  if (!roomId) throw new HttpsError("invalid-argument", "roomId is required.");

  return db.runTransaction(async (tx) => {
    const roomSnap = await tx.get(roomRef(roomId));
    if (!roomSnap.exists) throw new HttpsError("not-found", "Room not found.");
    const stateSnap = await tx.get(stateRef(roomId));
    if (!stateSnap.exists) throw new HttpsError("not-found", "No active game.");
    const state = stateSnap.data()!;

    // End with no winner (Req 22.3 / 25.13 "Game ended").
    tx.update(stateRef(roomId), {
      phase: "ended",
      winner: null,
      pausedBy: null,
      pausedAt: null,
      version: state.version + 1,
    });
    tx.update(roomRef(roomId), { phase: "ended", lastActivityAt: Timestamp.now() });
    logAction(tx, roomId, uid, "end_game", state.version, "accepted");
    return { ok: true, version: state.version + 1 };
  });
});

export const leave = onCall(async (request) => {
  const uid = requireAuthUid(request.auth);
  const roomId = String(request.data?.roomId ?? "").trim();
  if (!roomId) throw new HttpsError("invalid-argument", "roomId is required.");

  return db.runTransaction(async (tx) => {
    const roomSnap = await tx.get(roomRef(roomId));
    if (!roomSnap.exists) throw new HttpsError("not-found", "Room not found.");
    const room = roomSnap.data()!;

    const playersSnap = await tx.get(playersRef(roomId));
    const players: Seated[] = playersSnap.docs.map((d) => ({
      id: d.id,
      doc: d.data() as PlayerDoc,
    }));
    const leaver = players.find((p) => p.id === uid);
    if (!leaver) throw new HttpsError("not-found", "Not a member of this room.");

    // All reads must precede all writes in a Firestore transaction — read the
    // state doc here, before any tx.update below.
    const stateSnap = await tx.get(stateRef(roomId));
    const state = stateSnap.exists ? (stateSnap.data() as StateDoc) : null;

    // Mark the player left (Req 22.2). Immediate — no grace period.
    tx.update(playerRef(roomId, uid), {
      hasLeft: true,
      connectionState: "left",
      lastSeen: Timestamp.now(),
    });

    // Reflect the departure locally for host-succession + auto-pause decisions.
    leaver.doc = { ...leaver.doc, hasLeft: true, connectionState: "left" };

    // Host succession: if the leaver was host, pass to longest-present
    // connected player (Req 3.6, 12.7, 15.8).
    if (room.hostPlayerId === uid) {
      const successor = pickSuccessor(players, uid);
      if (successor) {
        tx.update(roomRef(roomId), { hostPlayerId: successor.id });
        tx.update(playerRef(roomId, uid), { isHost: false });
        tx.update(playerRef(roomId, successor.id), { isHost: true });
      }
    }

    // Mid-game: skip the leaver's turn immediately (Req 25.13) and re-evaluate
    // auto-pause (Req 15.7).
    if (state && state.phase !== "ended" && room.phase === "playing") {
      const seats = seatedSorted(players);
      const isSkipped = (p: Seated) => p.doc.connectionState !== "connected" || p.doc.hasLeft;

      let activeSeat = state.activeSeat;
      if (seats[activeSeat] && seats[activeSeat].id === uid) {
        activeSeat = advanceSkipping(seats, activeSeat, state.direction, isSkipped);
      }

      const autoPause = shouldAutoPause(room.gameMode, connectionSnapshots(players));

      tx.update(stateRef(roomId), {
        activeSeat,
        drewThisTurn: false,
        phase: autoPause ? "auto_paused" : state.phase,
        pausedBy: autoPause ? null : state.pausedBy,
        pausedAt: autoPause ? Timestamp.now() : state.pausedAt,
        version: state.version + 1,
      });
    }

    tx.update(roomRef(roomId), { lastActivityAt: Timestamp.now() });
    logAction(tx, roomId, uid, "leave", state?.version ?? 0, "accepted");
    return { ok: true };
  });
});

// ---------------------------------------------------------------------------
// host succession + play-again (4.7)
// ---------------------------------------------------------------------------

export const playAgain = onCall(async (request) => {
  const uid = requireAuthUid(request.auth);
  const roomId = String(request.data?.roomId ?? "").trim();
  if (!roomId) throw new HttpsError("invalid-argument", "roomId is required.");

  return db.runTransaction(async (tx) => {
    const roomSnap = await tx.get(roomRef(roomId));
    if (!roomSnap.exists) throw new HttpsError("not-found", "Room not found.");
    const room = roomSnap.data()!;
    if (room.hostPlayerId !== uid) {
      throw new HttpsError("permission-denied", "Only the host can start a new round.");
    }
    if (room.phase !== "ended") {
      throw new HttpsError("failed-precondition", "The game is not over.");
    }

    const playersSnap = await tx.get(playersRef(roomId));
    const players = playersSnap.docs.map((d) => ({ id: d.id, doc: d.data() as PlayerDoc }));

    // Return everyone to the lobby with the SAME mode/teams; keep seats/team so
    // 2v2 reforms identically. Clear per-game seat only? Requirements say same
    // mode/teams — retain `team`, reset seatIndex (re-dealt at next start).
    for (const p of players) {
      if (p.doc.hasLeft) continue;
      tx.update(playerRef(roomId, p.id), { seatIndex: null, cardCount: 0 });
      // Clear the player's hand doc from the finished round.
      tx.delete(handRef(roomId, p.id));
    }

    // Tear down the finished game's state + private deck.
    tx.delete(stateRef(roomId));
    tx.delete(deckRef(roomId));

    // Increment the round; back to lobby (Req 12.6).
    tx.update(roomRef(roomId), {
      phase: "lobby",
      roundNumber: room.roundNumber + 1,
      lastActivityAt: Timestamp.now(),
    });

    return { ok: true, roundNumber: room.roundNumber + 1 };
  });
});

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Longest-present connected non-leaving player (lowest joinOrder). */
function pickSuccessor(players: Seated[], leavingUid: string): Seated | null {
  const candidates = players
    .filter((p) => p.id !== leavingUid && !p.doc.hasLeft && p.doc.connectionState === "connected")
    .sort((a, b) => a.doc.joinOrder - b.doc.joinOrder);
  return candidates[0] ?? null;
}

/** Capture the pause-time choice to re-show on resume (Req 25.14). */
function pendingChoiceForPhase(state: StateDoc): StateDoc["pendingChoice"] {
  if (state.pendingChoice) return state.pendingChoice;
  if (state.phase === "wild_pending") {
    return { kind: "wild_color", seatIndex: state.activeSeat };
  }
  if (state.phase === "drew_decision") {
    return { kind: "play_keep", seatIndex: state.activeSeat };
  }
  return null;
}

/** Determine which phase to restore to on resume from a captured choice. */
function phaseFromPendingChoice(state: StateDoc): StateDoc["phase"] {
  if (state.pendingChoice?.kind === "wild_color") return "wild_pending";
  if (state.pendingChoice?.kind === "play_keep") return "drew_decision";
  return "active";
}
