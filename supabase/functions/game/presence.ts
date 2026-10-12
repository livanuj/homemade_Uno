/**
 * Presence write helper.
 *
 * In production the client stamps its own `lastSeen`/`connectionState` through
 * the `heartbeat` database function, and the `enforceGrace` action enforces
 * the 60s Grace_Period (Task 5). This action
 * lets the SERVER set a player's connection state authoritatively — used by the
 * action-triggered lifecycle flows and by integration tests to simulate a
 * disconnect for auto-pause / continue-without without a real socket drop.
 */
import { onCall, HttpsError } from "./callable.ts";
import { db, playerRef, roomRef, Timestamp } from "./refs.ts";
import type { ConnectionState } from "./model.ts";

const VALID: readonly ConnectionState[] = ["connected", "disconnected", "left"];

export const setConnection = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");

  const roomId = String(request.data?.roomId ?? "").trim();
  const connectionState = request.data?.connectionState as ConnectionState;
  // A caller may only set their OWN presence (mirrors the heartbeat's scope).
  const targetId = String(request.data?.playerId ?? uid);
  if (!roomId) throw new HttpsError("invalid-argument", "roomId is required.");
  if (!VALID.includes(connectionState)) {
    throw new HttpsError("invalid-argument", "invalid connectionState.");
  }
  if (targetId !== uid) {
    throw new HttpsError("permission-denied", "Can only set your own presence.");
  }

  await db.runTransaction(async (tx) => {
    if (!(await tx.get(playerRef(roomId, uid))).exists) {
      throw new HttpsError("not-found", "Not a member of this room.");
    }
    tx.update(playerRef(roomId, uid), { connectionState, lastSeen: Timestamp.now() });
    tx.update(roomRef(roomId), { lastActivityAt: Timestamp.now() });
  });
  return { ok: true };
});
