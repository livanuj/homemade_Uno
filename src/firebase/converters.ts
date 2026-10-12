/**
 * Typed Firestore data converters + path helpers for the room-rooted tree.
 *
 * A `FirestoreDataConverter<T>` lets `doc()`/`collection()` return references
 * typed as `T`, so reads come back as `RoomDoc`/`PlayerDoc`/… and writes are
 * checked against those shapes. The converters here are intentionally
 * identity-mapping (Firestore stores plain objects that already match our
 * document interfaces) but keep the model changes centralized: any future
 * field massaging (defaults, renames, `Timestamp` coercion) lives in one place.
 *
 * Clients only ever READ most of these (writes go through Cloud Functions per
 * `conventions/firestore-data.md`); the converters still type both directions
 * so the Cloud Functions layer (task 4) and tests can reuse them.
 */
import {
  collection,
  doc,
  type CollectionReference,
  type DocumentData,
  type DocumentReference,
  type Firestore,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import type {
  ActionDoc,
  DeckDoc,
  HandDoc,
  PlayerDoc,
  RoomDoc,
  StateDoc,
} from "./types";

/**
 * Build an identity converter for a document shape `T`. `toFirestore` passes
 * the object through; `fromFirestore` casts the stored data to `T`.
 */
function identityConverter<T extends DocumentData>(): FirestoreDataConverter<T> {
  return {
    toFirestore(value: T): DocumentData {
      return value;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): T {
      return snapshot.data() as T;
    },
  };
}

export const roomConverter = identityConverter<RoomDoc>();
export const playerConverter = identityConverter<PlayerDoc>();
export const stateConverter = identityConverter<StateDoc>();
export const handConverter = identityConverter<HandDoc>();
export const deckConverter = identityConverter<DeckDoc>();
export const actionConverter = identityConverter<ActionDoc>();

// ---------------------------------------------------------------------------
// Path helpers — every reference is typed via its converter. Centralizing the
// paths here keeps the collection/subcollection names (and the reserved
// `state/current` + `private/deck` doc ids) in exactly one place.
// ---------------------------------------------------------------------------

/** `rooms/{roomId}` */
export function roomRef(db: Firestore, roomId: string): DocumentReference<RoomDoc> {
  return doc(db, "rooms", roomId).withConverter(roomConverter);
}

/** `rooms/{roomId}/players` */
export function playersRef(
  db: Firestore,
  roomId: string,
): CollectionReference<PlayerDoc> {
  return collection(db, "rooms", roomId, "players").withConverter(playerConverter);
}

/** `rooms/{roomId}/players/{playerId}` */
export function playerRef(
  db: Firestore,
  roomId: string,
  playerId: string,
): DocumentReference<PlayerDoc> {
  return doc(db, "rooms", roomId, "players", playerId).withConverter(playerConverter);
}

/** `rooms/{roomId}/state/current` — the single public state doc. */
export function stateRef(
  db: Firestore,
  roomId: string,
): DocumentReference<StateDoc> {
  return doc(db, "rooms", roomId, "state", "current").withConverter(stateConverter);
}

/** `rooms/{roomId}/hands/{playerId}` — self + partner readable only. */
export function handRef(
  db: Firestore,
  roomId: string,
  playerId: string,
): DocumentReference<HandDoc> {
  return doc(db, "rooms", roomId, "hands", playerId).withConverter(handConverter);
}

/** `rooms/{roomId}/private/deck` — server-only; deny-all client read. */
export function deckRef(db: Firestore, roomId: string): DocumentReference<DeckDoc> {
  return doc(db, "rooms", roomId, "private", "deck").withConverter(deckConverter);
}

/** `rooms/{roomId}/actions` — append-only, server-written log. */
export function actionsRef(
  db: Firestore,
  roomId: string,
): CollectionReference<ActionDoc> {
  return collection(db, "rooms", roomId, "actions").withConverter(actionConverter);
}
