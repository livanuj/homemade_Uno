/**
 * Engine-driven action callables (Task 4.4 + `callLast` from 4.5).
 *
 * Each one authenticates the caller (`request.auth.uid` == Player_ID), reads
 * `roomId` + `basedOnVersion` from the payload, and routes a single engine
 * `Action` through the shared {@link runAction} harness — which runs the
 * versioned Firestore transaction, applies the pure engine, and persists before
 * confirming. Expected rule violations come back as `{ ok: false, reason }`
 * (NOT thrown); only missing auth throws an `HttpsError` (Req 14.5).
 *
 *   playCard    → { type: "play", cardId }        (Req 7.x, 9.x)
 *   chooseColor → { type: "choose_color", color } (Req 8.x)
 *   drawOne     → { type: "draw" }                (Req 10.x)
 *   keep        → { type: "keep" }                (Req 10.4)
 *   callLast    → { type: "call_last" }           (Req 11.1, 11.2)
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { runAction, requireAuth } from "./harness";
import type { Suit } from "./engine";

/** Extract + validate `roomId` and `basedOnVersion` from a request payload. */
function readActionArgs(data: unknown): { roomId: string; basedOnVersion: number } {
  const obj = (data ?? {}) as Record<string, unknown>;
  const roomId = String(obj.roomId ?? "").trim();
  const basedOnVersion = Number(obj.basedOnVersion);
  if (!roomId) throw new HttpsError("invalid-argument", "roomId is required.");
  if (!Number.isFinite(basedOnVersion)) {
    throw new HttpsError("invalid-argument", "basedOnVersion is required.");
  }
  return { roomId, basedOnVersion };
}

const SUITS: readonly Suit[] = ["red", "yellow", "green", "blue"];

export const playCard = onCall(async (request) => {
  const uid = requireAuth(request.auth);
  const { roomId, basedOnVersion } = readActionArgs(request.data);
  const cardId = String((request.data as Record<string, unknown>)?.cardId ?? "");
  if (!cardId) throw new HttpsError("invalid-argument", "cardId is required.");

  return runAction(roomId, uid, basedOnVersion, (playerId) => ({
    type: "play",
    playerId,
    cardId,
  }));
});

export const chooseColor = onCall(async (request) => {
  const uid = requireAuth(request.auth);
  const { roomId, basedOnVersion } = readActionArgs(request.data);
  const color = (request.data as Record<string, unknown>)?.color as Suit;
  if (!SUITS.includes(color)) {
    throw new HttpsError("invalid-argument", "color must be red/yellow/green/blue.");
  }

  return runAction(roomId, uid, basedOnVersion, (playerId) => ({
    type: "choose_color",
    playerId,
    color,
  }));
});

export const drawOne = onCall(async (request) => {
  const uid = requireAuth(request.auth);
  const { roomId, basedOnVersion } = readActionArgs(request.data);

  return runAction(roomId, uid, basedOnVersion, (playerId) => ({
    type: "draw",
    playerId,
  }));
});

export const keep = onCall(async (request) => {
  const uid = requireAuth(request.auth);
  const { roomId, basedOnVersion } = readActionArgs(request.data);

  return runAction(roomId, uid, basedOnVersion, (playerId) => ({
    type: "keep",
    playerId,
  }));
});

export const callLast = onCall(async (request) => {
  const uid = requireAuth(request.auth);
  const { roomId, basedOnVersion } = readActionArgs(request.data);

  return runAction(roomId, uid, basedOnVersion, (playerId) => ({
    type: "call_last",
    playerId,
  }));
});
