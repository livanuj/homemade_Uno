/**
 * Client presence heartbeat (Task 5.2).
 *
 * PRESENCE APPROACH: a Firestore heartbeat on the caller's OWN
 * `players/{uid}` document, NOT RTDB `onDisconnect`. The design allows either
 * ("Presence is tracked via Realtime Database `onDisconnect` (or, alternatively,
 * a periodic heartbeat document)"). The heartbeat is chosen here because:
 *   - the existing Security Rules already permit a client to write ONLY its own
 *     `lastSeen` + `connectionState` (see `firestore.rules`
 *     `onlyPresenceFieldsChanged`) — no new rules needed;
 *   - it keeps Task 5 self-contained: no `database` block in `firebase.json`, no
 *     RTDB emulator, no separate RTDB rules;
 *   - correctness is unaffected — the SERVER enforces the 60s Grace_Period by
 *     comparing `now − lastSeen` (Task 5.4), so the transport used to record
 *     `lastSeen` is irrelevant to who gets skipped.
 *
 * The client is NEVER trusted for skip/pause decisions (steering
 * `firestore-data.md` anti-pattern). This module only records liveness; the
 * grace/auto-pause Cloud Function reads `lastSeen` server-side.
 *
 * Fields written (allowed by the rules on the caller's own doc):
 *   - `lastSeen`        — bumped every heartbeat + on visibility/online events
 *   - `connectionState` — set to `connected` while alive; `disconnected` on a
 *     best-effort `pagehide`/`offline` write (may not land if the tab is torn
 *     down — that's fine, the server's lastSeen staleness covers it).
 */
import type { Firestore } from "firebase/firestore";
import { serverTimestamp, updateDoc } from "firebase/firestore";
import { playerRef } from "@/firebase/converters";
import type { ConnectionState } from "@/firebase/types";

/** The heartbeat interval — well under the 60s Grace_Period (Req 15.6). */
export const HEARTBEAT_INTERVAL_MS = 15_000;

/** Options for {@link startHeartbeat}. */
export interface HeartbeatOptions {
  readonly db: Firestore;
  readonly roomId: string;
  readonly playerId: string;
  /** Interval between heartbeats; defaults to {@link HEARTBEAT_INTERVAL_MS}. */
  readonly intervalMs?: number;
  /** Optional error reporter for failed writes (non-fatal). */
  readonly onError?: (error: Error) => void;
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
 * Write only this player's presence fields. Uses `serverTimestamp()` so the
 * SERVER stamps `lastSeen` — a client clock is never trusted for the grace
 * window (steering `firestore-data.md`).
 */
async function writePresence(
  opts: HeartbeatOptions,
  connectionState: ConnectionState,
): Promise<void> {
  try {
    await updateDoc(playerRef(opts.db, opts.roomId, opts.playerId), {
      lastSeen: serverTimestamp(),
      connectionState,
    });
  } catch (err) {
    opts.onError?.(err instanceof Error ? err : new Error(String(err)));
  }
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
