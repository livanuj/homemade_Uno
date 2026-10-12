/**
 * Typed references to a room's documents, plus the transaction entry point.
 *
 * All game writes flow through these references inside the `game` Edge
 * Function (service role, Req 23.3). Path names and reserved ids
 * (`state/current`, `private/deck`) live here in exactly one place, mirroring
 * the paths the client subscribes to.
 */
import type {
  ActionDoc,
  DeckDoc,
  HandDoc,
  PlayerDoc,
  RoomDoc,
  StateDoc,
} from "./model.ts";
import { collectionRef, docRef, runTransaction } from "./store.ts";

export const db = { runTransaction };

/** Timestamps are epoch milliseconds. */
export type Timestamp = number;
export const Timestamp = { now: (): Timestamp => Date.now() };
export const FieldValue = { serverTimestamp: (): Timestamp => Date.now() };

/** `room` */
export function roomRef(roomId: string) {
  return docRef<RoomDoc>(roomId, "room");
}

/** `players/` */
export function playersRef(roomId: string) {
  return collectionRef<PlayerDoc>(roomId, "players/");
}

/** `players/<playerId>` */
export function playerRef(roomId: string, playerId: string) {
  return docRef<PlayerDoc>(roomId, `players/${playerId}`);
}

/** `state/current` */
export function stateRef(roomId: string) {
  return docRef<StateDoc>(roomId, "state/current");
}

/** `hands/<playerId>` */
export function handRef(roomId: string, playerId: string) {
  return docRef<HandDoc>(roomId, `hands/${playerId}`);
}

/** `private/deck` — server-only (no client can read it). */
export function deckRef(roomId: string) {
  return docRef<DeckDoc>(roomId, "private/deck");
}

/** `actions/` — append-only log (no client can read it). */
export function actionsRef(roomId: string) {
  return collectionRef<ActionDoc>(roomId, "actions/");
}
