/**
 * Anonymous sign-in: the session's user id is the persisted `Player_ID`
 * (Req 3.1). Supabase keeps the session in local storage, so a reload or a
 * rejoin via the invite link restores the same player.
 */
import type { User } from "@supabase/supabase-js";
import { supabase } from "./client";

export interface Session {
  /** Supabase anonymous user id — the persisted `Player_ID` (Req 3.1). */
  playerId: string;
  /** The underlying Supabase user. */
  user: User;
}

let pending: Promise<Session> | null = null;

/**
 * Resolve the current session, signing in anonymously if there is none.
 * Concurrent callers share one sign-in.
 */
export function ensureSession(): Promise<Session> {
  if (pending) return pending;
  pending = (async () => {
    const { data } = await supabase.auth.getSession();
    const existing = data.session?.user;
    if (existing) return { playerId: existing.id, user: existing };
    const { data: signedIn, error } = await supabase.auth.signInAnonymously();
    if (error || !signedIn.user) throw error ?? new Error("Anonymous sign-in failed.");
    return { playerId: signedIn.user.id, user: signedIn.user };
  })().finally(() => {
    pending = null;
  });
  return pending;
}

/** Subscribe to session changes (restore, sign-in, sign-out). */
export function onSession(listener: (session: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    const user = session?.user;
    listener(user ? { playerId: user.id, user } : null);
  });
  return () => data.subscription.unsubscribe();
}
