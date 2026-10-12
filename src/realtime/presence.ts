/**
 * Client presence heartbeat (Task 5.2).
 *
 * PRESENCE APPROACH: a periodic heartbeat on the caller's OWN
 * `players/{uid}` document, through the `heartbeat` database function. That
 * function can only touch the caller's own `lastSeen` + `connectionState`
 * (clients have no other write access), and it stamps `lastSeen` with the
 * DATABASE clock — a client clock is never trusted for the grace window.
 *
 * The client is NEVER trusted for skip/pause decisions (steering
 * `supabase-data.md` anti-pattern). This module only records liveness; the
 * server's `enforceGrace` action reads `lastSeen` and decides.
 *
 * Fields written (on the caller's own doc only):
 *   - `lastSeen`        — bumped every heartbeat + on visibility/online events
 *   - `connectionState` — set to `connected` while alive; `disconnected` on a
 *     best-effort `pagehide`/`offline` write (may not land if the tab is torn
 *     down — that's fine, the server's lastSeen staleness covers it).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase as defaultClient } from "@/backend/client";
import type { ConnectionState } from "@/backend/types";

/** The heartbeat interval — well under the 60s Grace_Period (Req 15.6). */
export const HEARTBEAT_INTERVAL_MS = 15_000;

/** Options for {@link startHeartbeat}. */
export interface HeartbeatOptions {
  readonly roomId: string;
  readonly playerId: string;
  /** Interval between heartbeats; defaults to {@link HEARTBEAT_INTERVAL_MS}. */
  readonly intervalMs?: number;
  /** Optional error reporter for failed writes (non-fatal). */
  readonly onError?: (error: Error) => void;
  /** Supabase client; defaults to the app's. */
  readonly client?: SupabaseClient;
}

/** Handle returned by {@link startHeartbeat}. */
export interface Heartbeat {
  /** Write a single `lastSeen` bump now (also on regained focus/connectivity). */
  beat(): void;
  /** Best-effort mark this session `disconnected` (e.g. on pagehide). */
  markDisconnected(): void;
  /** Stop the interval and remove event listeners. */
  stop(): void;
}

/**
 * Write only this player's presence fields. The database stamps `lastSeen`
 * with its own clock (steering `supabase-data.md`).
 */
async function writePresence(
  opts: HeartbeatOptions,
  connectionState: ConnectionState,
): Promise<void> {
  const client = opts.client ?? defaultClient;
  const { error } = await client.rpc("heartbeat", {
    p_room: opts.roomId,
    p_connection: connectionState,
  });
  if (error) opts.onError?.(new Error(error.message));
}

/**
 * Start heartbeating the caller's own `lastSeen`. Beats immediately, then on an
 * interval, and again whenever the tab becomes visible or the browser reports
 * it is back `online` (so a resume is recorded promptly on reconnect). Returns a
 * handle; call `stop()` on unmount / room change.
 *
 * In non-DOM environments (tests, SSR) the `window`/`document` listeners are
 * simply skipped — the interval still runs.
 */
export function startHeartbeat(opts: HeartbeatOptions): Heartbeat {
  const intervalMs = opts.intervalMs ?? HEARTBEAT_INTERVAL_MS;

  const beat = () => void writePresence(opts, "connected");
  const markDisconnected = () => void writePresence(opts, "disconnected");

  // Beat right away so `lastSeen` is fresh the moment presence starts.
  beat();
  const timer = setInterval(beat, intervalMs);

  const hasDom = typeof document !== "undefined" && typeof window !== "undefined";

  const onVisibility = () => {
    if (document.visibilityState === "visible") beat();
  };
  const onOnline = () => beat();
  const onPageHide = () => markDisconnected();

  if (hasDom) {
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onOnline);
    window.addEventListener("pagehide", onPageHide);
  }

  return {
    beat,
    markDisconnected,
    stop() {
      clearInterval(timer);
      if (hasDom) {
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("online", onOnline);
        window.removeEventListener("focus", onOnline);
        window.removeEventListener("pagehide", onPageHide);
      }
    },
  };
}
