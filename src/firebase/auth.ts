/**
 * Anonymous session management.
 *
 * Identity in Homemade Uno is a Firebase Anonymous Auth session: the session
 * `uid` IS the persisted `Player_ID` (Req 3.1). Rejoin reuses the invite link
 * plus this persisted session, so the same device keeps the same seat/hand.
 *
 * `ensureSession()` guarantees a signed-in session exists before any room
 * action (create/join/play). It is idempotent — concurrent callers share a
 * single in-flight sign-in — so callers can invoke it freely.
 */
import { onAuthStateChanged, signInAnonymously, type User } from "firebase/auth";
import { auth } from "./client";

/** A resolved session: the stable `Player_ID` for this device. */
export interface Session {
  /** Firebase Anonymous Auth uid — the persisted `Player_ID` (Req 3.1). */
  playerId: string;
  /** The underlying Firebase user, for token access if ever needed. */
  user: User;
}

/** Shared in-flight sign-in promise so concurrent callers don't race. */
let pending: Promise<Session> | null = null;

/**
 * Guarantee a signed-in anonymous session and return it. Resolves immediately
 * when a session already exists; otherwise signs in anonymously. Safe to call
 * before every room action.
 */
export function ensureSession(): Promise<Session> {
  const current = auth.currentUser;
  if (current) {
    return Promise.resolve({ playerId: current.uid, user: current });
  }
  if (pending) return pending;

  pending = signInAnonymously(auth)
    .then((cred) => ({ playerId: cred.user.uid, user: cred.user }))
    .finally(() => {
      pending = null;
    });
  return pending;
}

/**
 * Subscribe to session changes. Fires with the current `Session` (or `null`
 * when signed out). Returns an unsubscribe function.
 */
export function onSession(listener: (session: Session | null) => void): () => void {
  return onAuthStateChanged(auth, (user) => {
    listener(user ? { playerId: user.uid, user } : null);
  });
}
