/**
 * `useRoomChannel` — the top-level realtime seam (Tasks 5.1, 5.2, 5.3).
 *
 * Given a `roomId` and the caller's `Player_ID`, this hook:
 *   - holds the read-only authoritative {@link ./store} in a `useReducer`;
 *   - attaches the Firestore `onSnapshot` listeners via {@link ./subscription}
 *     and tears them down on unmount / room change (Task 5.1);
 *   - runs the presence heartbeat on the caller's own `players/{uid}` doc
 *     (Task 5.2);
 *   - on `online`/`visibilitychange` RE-ATTACHES the listeners and beats the
 *     heartbeat so the store reflects the current public state + own hand within
 *     5s of reconnecting (Task 5.3, Req 14.7/15.2/15.4);
 *   - exposes the versioned {@link ./actions#useGameActions} client.
 *
 * This is the single object Task 9 will consume to back the screens (replacing
 * the fixture store). It renders NOTHING and mutates NO game document — server
 * state is read-only truth (steering `component-architecture.md`).
 */
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { db } from "@/firebase/client";
import { useGameActions, type ActionClient } from "./actions";
import { startHeartbeat, type Heartbeat } from "./presence";
import { initialStore, storeReducer, type RealtimeStore } from "./store";
import { subscribeRoom, type Subscription } from "./subscription";

/** What {@link useRoomChannel} returns to the app. */
export interface RoomChannel {
  /** The read-only authoritative store the screens render from. */
  store: RealtimeStore;
  /** The versioned action client (playCard/drawOne/…); the single write path. */
  actions: ActionClient;
  /** Force a re-attach + heartbeat now (e.g. a manual "reconnect" button). */
  resync(): void;
}

/**
 * Subscribe to a room's realtime channel. Pass `roomId = null` to stay detached
 * (e.g. before a room is created/joined).
 */
export function useRoomChannel(
  roomId: string | null,
  playerId: string | null,
): RoomChannel {
  const [store, dispatch] = useReducer(storeReducer, undefined, () =>
    initialStore(playerId),
  );

  // A monotonically increasing token; bumping it re-runs the subscribe effect
  // (the reconnect resync). Kept in a ref for the event handlers + in state so
  // the effect depends on it.
  const [resyncToken, setResyncToken] = useState(0);
  const subRef = useRef<Subscription | null>(null);
  const beatRef = useRef<Heartbeat | null>(null);

  const resync = useCallback(() => setResyncToken((t) => t + 1), []);

  // ---- listeners + presence lifecycle (re-runs on room/player/resync change) ----
  useEffect(() => {
    if (!roomId || !playerId) {
      dispatch({ type: "detach" });
      return;
    }

    dispatch({ type: "connection", connection: "connecting" });

    const subscription = subscribeRoom({
      db,
      roomId,
      playerId,
      dispatch,
      onError: () => dispatch({ type: "connection", connection: "offline" }),
    });
    subRef.current = subscription;

    // First snapshot flips us to online; until then we're "connecting".
    dispatch({ type: "connection", connection: "online" });

    const heartbeat = startHeartbeat({ db, roomId, playerId });
    beatRef.current = heartbeat;

    return () => {
      subscription.unsubscribe();
      heartbeat.stop();
      subRef.current = null;
      beatRef.current = null;
    };
    // resyncToken is intentionally a dependency: bumping it re-attaches.
  }, [roomId, playerId, resyncToken]);

  // ---- reconnect triggers (Task 5.3) ----
  // On regained connectivity/visibility, re-attach the listeners (resync) so the
  // store reloads the current public state + own hand within 5s, and beat now.
  useEffect(() => {
    if (!roomId || !playerId) return;
    if (typeof window === "undefined") return;

    const onOnline = () => {
      dispatch({ type: "connection", connection: "connecting" });
      beatRef.current?.beat();
      resync();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") onOnline();
    };
    const onOffline = () => dispatch({ type: "connection", connection: "offline" });

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [roomId, playerId, resync]);

  const actions = useGameActions(store, dispatch);

  return { store, actions, resync };
}
