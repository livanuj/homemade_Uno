/**
 * Admin-side reader for tests.
 *
 * Card-conservation checks need the server-only `private/deck` (which NO client
 * can read — Req 23.2). Tests read it with the Admin SDK, which — when
 * `FIRESTORE_EMULATOR_HOST` is set by `emulators:exec` — talks to the emulator.
 */
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = "demo-homemade-uno";

function ensureAdmin() {
  if (getApps().length === 0) {
    // Under the emulator no real credentials are needed.
    initializeApp({ projectId: PROJECT_ID });
  }
  return getFirestore();
}

export async function readDeck(roomId: string): Promise<{ drawPile: { id: string }[] } | null> {
  const db = ensureAdmin();
  const snap = await db.doc(`rooms/${roomId}/private/deck`).get();
  return snap.exists ? (snap.data() as { drawPile: { id: string }[] }) : null;
}

export async function readAllHands(
  roomId: string,
): Promise<{ id: string; cards: { id: string }[] }[]> {
  const db = ensureAdmin();
  const snap = await db.collection(`rooms/${roomId}/hands`).get();
  return snap.docs.map((d) => ({ id: d.id, cards: (d.data().cards ?? []) as { id: string }[] }));
}

export async function readStateAdmin(roomId: string): Promise<Record<string, unknown> | null> {
  const db = ensureAdmin();
  const snap = await db.doc(`rooms/${roomId}/state/current`).get();
  return snap.exists ? (snap.data() as Record<string, unknown>) : null;
}
