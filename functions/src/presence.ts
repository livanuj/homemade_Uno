/**
 * Presence write helper.
 *
 * In production the client updates its own `lastSeen`/`connectionState` directly
 * (the one client-writable field, permitted by the Security Rules) and a
 * scheduled Cloud Function enforces the 60s Grace_Period (Task 5). This callable
 * lets the SERVER set a player's connection state authoritatively — used by the
 * action-triggered lifecycle flows and by integration tests to simulate a
 * disconnect for auto-pause / continue-without without a real socket drop.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { playerRef, roomRef, Timestamp } from "./admin";
import type { ConnectionState } from "./model";

const VALID: readonly ConnectionState[] = ["connected", "disconnected", "left"];

export const setConnection = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");

  const roomId = String(request.data?.roomId ?? "").trim();
  const connectionState = request.data?.connectionState as ConnectionState;
  // A caller may only set their OWN presence (mirrors the Security Rule scope).
  const targetId = String(request.data?.playerId ?? uid);
  if (!roomId) throw new HttpsError("invalid-argument", "roomId is required.");
  if (!VALID.includes(connectionState)) {
    throw new HttpsError("invalid-argument", "invalid connectionState.");
  }
  if (targetId !== uid) {
    throw new HttpsError("permission-denied", "Can only set your own presence.");
  }

  await playerRef(roomId, uid).update({
    connectionState,
    lastSeen: Timestamp.now(),
  });
  await roomRef(roomId).update({ lastActivityAt: Timestamp.now() });
  return { ok: true };
});
