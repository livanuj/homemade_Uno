/**
 * Room lifecycle callables (Task 4.2): `createRoom` and `join`.
 *
 * `createRoom` (Req 1.1, 1.9, 1.11): generate a unique 4-char code from the
 * unambiguous alphabet (A–Z / 0–9 minus `0 O 1 I L`), retry ≤10 times and abort
 * on failure, write the room doc (Normal mode, `lobby`) plus the host player doc
 * (`joinOrder` 0), and return the room id/code + an invite link.
 *
 * `join` (Req 2.3, 2.6, 2.10, 3.2, 3.4, 24.1): validate the room exists (else
 * `not-found`), enforce max 8 players (else `room-full`), apply duplicate-name
 * suffixing, DENY non-members once the game has started, and RESTORE an existing
 * member (reconnect / rejoin) to their seat + hand.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import {
  db,
  playerRef,
  playersRef,
  roomRef,
  Timestamp,
} from "./admin";
import type { PlayerDoc, RoomDoc } from "./model";

/** Unambiguous room-code alphabet: A–Z / 0–9 minus look-alikes 0 O 1 I L. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 4;
const MAX_CODE_ATTEMPTS = 10;
const MAX_PLAYERS = 8;

function randomCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

/** Sanitize a submitted display name to 1–16 trimmed chars. */
function sanitizeName(raw: unknown): string {
  const name = (typeof raw === "string" ? raw : "").trim().slice(0, 16);
  return name.length > 0 ? name : "Player";
}

/**
 * Duplicate-name suffixing (Req 1.13): if `name` already exists among current
 * members, append " (2)", " (3)", … until unique.
 */
function uniqueName(name: string, existing: readonly string[]): string {
  if (!existing.includes(name)) return name;
  for (let n = 2; ; n++) {
    const candidate = `${name} (${n})`;
    if (!existing.includes(candidate)) return candidate;
  }
}

/**
 * Build the shareable invite link for a room code (Req 1.10).
 *
 * The link lands on the Home route with the code prefilled via `?code=…` (which
 * the client reads to pre-populate the join field). We do NOT guess a domain:
 * by default the link is root-relative (`/?code=…`), and the client resolves it
 * against its own origin — the only thing that knows the real served URL. A
 * fully-qualified link is produced only when an operator explicitly sets
 * `APP_BASE_URL` (e.g. a known custom domain for links shared out-of-band).
 */
function inviteLink(roomCode: string): string {
  const path = `/?code=${encodeURIComponent(roomCode)}`;
  const base = process.env.APP_BASE_URL;
  return base ? `${base.replace(/\/$/, "")}${path}` : path;
}

/**
 * Reserve a unique room code by attempting up to {@link MAX_CODE_ATTEMPTS}
 * creates of a `roomCodes/{code}` sentinel doc in a transaction. Returns the
 * reserved code, or throws after exhausting attempts.
 */
async function reserveUniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = randomCode();
    const ref = db.collection("roomCodes").doc(code);
    const reserved = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists) return false;
      tx.set(ref, { createdAt: FieldValue.serverTimestamp() });
      return true;
    });
    if (reserved) return code;
  }
  throw new HttpsError("resource-exhausted", "Could not allocate a unique room code.");
}

export const createRoom = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");

  const displayName = sanitizeName(request.data?.displayName);
  const roomCode = await reserveUniqueCode();

  // Room id is the code (unique, human-shareable). Write room + host player.
  const now = Timestamp.now();
  const roomId = roomCode;

  const room: RoomDoc = {
    roomCode,
    hostPlayerId: uid,
    gameMode: "normal",
    phase: "lobby",
    roundNumber: 1,
    createdAt: now,
    lastActivityAt: now,
  };

  const host: PlayerDoc = {
    displayName,
    seatIndex: null,
    team: null,
    isHost: true,
    joinOrder: 0,
    connectionState: "connected",
    lastSeen: now,
    hasLeft: false,
  };

  await db.runTransaction(async (tx) => {
    tx.set(roomRef(roomId), room);
    tx.set(playerRef(roomId, uid), host);
  });

  return { roomId, roomCode, inviteLink: inviteLink(roomCode), displayName };
});

export const join = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");

  const rawCode = String(request.data?.roomCode ?? "").trim().toUpperCase();
  if (rawCode.length !== CODE_LENGTH) {
    throw new HttpsError("invalid-argument", "Enter a 4-character room code.");
  }
  const roomId = rawCode;
  const requestedName = sanitizeName(request.data?.displayName);

  return db.runTransaction(async (tx) => {
    const roomSnap = await tx.get(roomRef(roomId));
    if (!roomSnap.exists) {
      // Room not found → surface as a structured not-found (Req 2.6).
      throw new HttpsError("not-found", "Room not found.");
    }
    const room = roomSnap.data()!;

    const playersSnap = await tx.get(playersRef(roomId));
    const players = playersSnap.docs.map((d) => ({
      id: d.id,
      doc: d.data() as PlayerDoc,
    }));
    const existing = players.find((p) => p.id === uid);

    // Existing member → restore their seat/hand on rejoin (Req 2.10, 3.2, 3.4).
    if (existing) {
      tx.update(playerRef(roomId, uid), {
        connectionState: "connected",
        hasLeft: false,
        lastSeen: Timestamp.now(),
      });
      tx.update(roomRef(roomId), { lastActivityAt: Timestamp.now() });
      return {
        roomId,
        roomCode: room.roomCode,
        restored: true,
        phase: room.phase,
        seatIndex: existing.doc.seatIndex,
      };
    }

    // New joiner: the game must still be joinable (Req 2.3, 24.1).
    if (room.phase !== "lobby") {
      throw new HttpsError("failed-precondition", "The game has already started.");
    }
    if (players.length >= MAX_PLAYERS) {
      throw new HttpsError("resource-exhausted", "This room is full.");
    }

    const name = uniqueName(
      requestedName,
      players.map((p) => p.doc.displayName),
    );
    const joinOrder =
      players.reduce((max, p) => Math.max(max, p.doc.joinOrder), -1) + 1;

    const player: PlayerDoc = {
      displayName: name,
      seatIndex: null,
      team: null,
      isHost: false,
      joinOrder,
      connectionState: "connected",
      lastSeen: Timestamp.now(),
      hasLeft: false,
    };

    tx.set(playerRef(roomId, uid), player);
    tx.update(roomRef(roomId), { lastActivityAt: Timestamp.now() });

    return {
      roomId,
      roomCode: room.roomCode,
      restored: false,
      phase: room.phase,
      displayName: name,
    };
  });
});
