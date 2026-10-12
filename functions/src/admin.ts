/**
 * Admin SDK bootstrap + typed collection/document reference helpers.
 *
 * The Admin SDK bypasses Firestore Security Rules, so ALL game writes flow
 * through these references inside Cloud Functions (steering `firestore-data.md`,
 * Req 23.3). Path names / reserved doc ids (`state/current`, `private/deck`)
 * live here in exactly one place, mirroring `src/firebase/converters.ts`.
 */
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import type {
  ActionDoc,
  DeckDoc,
  HandDoc,
  PlayerDoc,
  RoomDoc,
  StateDoc,
} from "./model";

if (getApps().length === 0) {
  initializeApp();
}

export const db = getFirestore();
export { Timestamp };

/** `rooms/{roomId}` */
export function roomRef(roomId: string) {
  return db.collection("rooms").doc(roomId) as FirebaseFirestore.DocumentReference<RoomDoc>;
}

/** `rooms/{roomId}/players` */
export function playersRef(roomId: string) {
  return roomRef(roomId).collection("players") as FirebaseFirestore.CollectionReference<PlayerDoc>;
}

/** `rooms/{roomId}/players/{playerId}` */
export function playerRef(roomId: string, playerId: string) {
  return playersRef(roomId).doc(playerId);
}

/** `rooms/{roomId}/state/current` */
export function stateRef(roomId: string) {
  return roomRef(roomId).collection("state").doc("current") as
    FirebaseFirestore.DocumentReference<StateDoc>;
}

/** `rooms/{roomId}/hands/{playerId}` */
export function handRef(roomId: string, playerId: string) {
  return roomRef(roomId).collection("hands").doc(playerId) as
    FirebaseFirestore.DocumentReference<HandDoc>;
}

/** `rooms/{roomId}/private/deck` — server-only. */
export function deckRef(roomId: string) {
  return roomRef(roomId).collection("private").doc("deck") as
    FirebaseFirestore.DocumentReference<DeckDoc>;
}

/** `rooms/{roomId}/actions` — append-only log. */
export function actionsRef(roomId: string) {
  return roomRef(roomId).collection("actions") as
    FirebaseFirestore.CollectionReference<ActionDoc>;
}
