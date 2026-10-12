/**
 * Realtime-test helpers (Task 5.5).
 *
 * Adds to the client harness: an `onSnapshot`-based waiter (so tests measure the
 * real Firestore propagation window, not a poll), and admin-side presence
 * manipulation (backdating `lastSeen` / setting `connectionState`) to SIMULATE a
 * disconnect without a real socket drop — the SERVER still derives the grace/
 * auto-pause decision from the recorded `lastSeen` (never client-reported
 * presence).
 */
import { doc, onSnapshot, type Firestore } from "firebase/firestore";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const PROJECT_ID = "demo-homemade-uno";

function admin() {
  if (getApps().length === 0) initializeApp({ projectId: PROJECT_ID });
  return getFirestore();
}

/**
 * Resolve when a doc's snapshot satisfies `predicate`, or reject after
 * `timeoutMs`. Uses a real `onSnapshot` listener so the elapsed time reflects
 * genuine realtime propagation (Req 14.1/14.2/14.3 ≤2s, 14.7 ≤5s).
 */
export function waitForSnapshot<T = Record<string, unknown>>(
  db: Firestore,
  path: string[],
  predicate: (data: T | null) => boolean,
  timeoutMs: number,
): Promise<{ data: T | null; elapsedMs: number }> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const ref = doc(db, path.join("/"));
    const timer = setTimeout(() => {
      unsub();
      reject(new Error(`waitForSnapshot timed out after ${timeoutMs}ms for ${path.join("/")}`));
    }, timeoutMs);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = (snap.exists() ? (snap.data() as T) : null);
        if (predicate(data)) {
          clearTimeout(timer);
          unsub();
          resolve({ data, elapsedMs: Date.now() - start });
        }
      },
      (err) => {
        clearTimeout(timer);
        unsub();
        reject(err);
      },
    );
  });
}

/** Admin: set a player's presence + backdate `lastSeen` by `ageMs`. */
export async function setPresenceAdmin(
  roomId: string,
  playerId: string,
  connectionState: "connected" | "disconnected" | "left",
  ageMs = 0,
): Promise<void> {
  const db = admin();
  const lastSeen = Timestamp.fromMillis(Date.now() - ageMs);
  await db.doc(`rooms/${roomId}/players/${playerId}`).update({ connectionState, lastSeen });
}

/** Admin: read the state doc (bypasses rules). */
export async function readStateRaw(roomId: string): Promise<Record<string, unknown> | null> {
  const snap = await admin().doc(`rooms/${roomId}/state/current`).get();
  return snap.exists ? (snap.data() as Record<string, unknown>) : null;
}
