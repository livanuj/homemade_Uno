/**
 * `useSession` — React hook that guarantees an anonymous session before any
 * room action and exposes it to the tree.
 *
 * On mount it calls {@link ensureSession} (anonymous sign-in if needed) and
 * subscribes to session changes. Screens gate "Create a room" / "Join" on
 * `status === "ready"` so a `Player_ID` (the session uid) always exists before
 * the first room write. The realtime layer (task 5) and the callable action
 * client (task 4) read `playerId` from here.
 */
import { useEffect, useState } from "react";
import { ensureSession, onSession, type Session } from "./auth";

/** Lifecycle of the anonymous session. */
export type SessionStatus = "loading" | "ready" | "error";

export interface UseSessionResult {
  status: SessionStatus;
  /** The persisted `Player_ID` once ready, else null. */
  playerId: string | null;
  /** The resolved session once ready, else null. */
  session: Session | null;
  /** The sign-in error, if `status === "error"`. */
  error: Error | null;
}

/**
 * Ensure and observe the anonymous session. Returns `loading` until sign-in
 * resolves, then `ready` with the `Player_ID`, or `error` on failure.
 */
export function useSession(): UseSessionResult {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;

    // Reflect auth-state changes (initial restore, sign-out, token refresh).
    const unsubscribe = onSession((next) => {
      if (!active) return;
      setSession(next);
      if (next) setStatus("ready");
    });

    // Guarantee a session exists before any room action.
    ensureSession()
      .then((resolved) => {
        if (!active) return;
        setSession(resolved);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setStatus("error");
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return { status, playerId: session?.playerId ?? null, session, error };
}
