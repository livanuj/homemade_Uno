/**
 * Firestore `onSnapshot` subscription manager (Task 5.1, 5.3).
 *
 * `subscribeRoom` attaches the realtime listeners that keep the read-only
 * {@link ./store} in sync with the server:
 *
 *   - `rooms/{roomId}`                    → room doc
 *   - `rooms/{roomId}/players`            → players collection
 *   - `rooms/{roomId}/state/current`      → public game state
 *   - `rooms/{roomId}/hands/{ownId}`      → the caller's own hand
 *   - `rooms/{roomId}/hands/{partnerId}`  → partner hand (Team mode; re-derived
 *                                            as the players/state snapshots load)
 *
 * All game state flows one way: server → snapshot → store → screens. Nothing
 * here writes game documents (steering `firestore-data.md`).
 *
 * Cleanup: `subscribeRoom` returns an unsubscribe that detaches every listener.
 * The manager also detaches + re-attaches the partner-hand listener when the
 * partner changes (seats assigned at game start), and re-attaches ALL listeners
 * on reconnect (Task 5.3) — callers just call `subscribeRoom` again.
 *
 * Design refs: design.md "Request / response + realtime flow", "Architecture"
 * (onSnapshot store); Req 14.1/14.2/14.3 (≤2s propagation), 14.7/15.2/15.4
 * (reconnect resync ≤5s).
 */
import type { Firestore } from "firebase/firestore";
import { onSnapshot } from "firebase/firestore";
import {
  handRef,
  playersRef,
  roomRef,
  stateRef,
} from "@/firebase/converters";
import type { RoomDoc } from "@/firebase/types";
import type { StoreAction, StorePlayer } from "./store";

/** A store-dispatch sink — the subscription feeds snapshots through this. */
export type Dispatch = (action: StoreAction) => void;

/** Options for a room subscription. */
export interface SubscribeOptions {
  readonly db: Firestore;
  readonly roomId: string;
  /** The caller's `Player_ID` (auth uid) — for the own-hand listener. */
  readonly playerId: string;
  /** Sink that receives the derived {@link StoreAction}s. */
  readonly dispatch: Dispatch;
  /** Optional error reporter (e.g. to flip the store to `offline`). */
  readonly onError?: (source: string, error: Error) => void;
}

/** Handle to a live subscription. Call `unsubscribe()` to detach everything. */
export interface Subscription {
  unsubscribe(): void;
}

/**
 * Find the partner's `Player_ID` for `playerId` given the current players.
 * Only meaningful in Team mode (both on the same non-null team, distinct ids).
 */
function partnerIdOf(players: readonly StorePlayer[], playerId: string): string | null {
  const me = players.find((p) => p.playerId === playerId);
  if (!me || me.doc.team === null) return null;
  const partner = players.find(
    (p) => p.playerId !== playerId && p.doc.team === me.doc.team,
  );
  return partner?.playerId ?? null;
}

/**
 * Attach all room listeners and return a handle. The store is dispatched an
 * `attach` first (so a re-subscribe after reconnect resets cleanly), then each
 * listener dispatches its snapshot. `hydrated` is derived inside the reducer.
 */
export function subscribeRoom(opts: SubscribeOptions): Subscription {
  const { db, roomId, playerId, dispatch, onError } = opts;

  dispatch({ type: "attach", roomId, playerId });

  const report = (source: string) => (error: Error) => {
    onError?.(source, error);
  };

  // Track the partner listener so we can swap it when the partner changes.
  let partnerId: string | null = null;
  let partnerUnsub: (() => void) | null = null;

  const attachPartner = (nextPartnerId: string | null) => {
    if (nextPartnerId === partnerId) return;
    partnerId = nextPartnerId;
    partnerUnsub?.();
    partnerUnsub = null;
    if (!nextPartnerId) {
      dispatch({ type: "partner_hand_snapshot", hand: null });
      return;
    }
    partnerUnsub = onSnapshot(
      handRef(db, roomId, nextPartnerId),
      (snap) => dispatch({ type: "partner_hand_snapshot", hand: snap.data() ?? null }),
      report("partnerHand"),
    );
  };

  const unsubRoom = onSnapshot(
    roomRef(db, roomId),
    (snap) => dispatch({ type: "room_snapshot", room: (snap.data() as RoomDoc) ?? null }),
    report("room"),
  );

  const unsubPlayers = onSnapshot(
    playersRef(db, roomId),
    (snap) => {
      const players: StorePlayer[] = snap.docs.map((d) => ({
        playerId: d.id,
        doc: d.data(),
      }));
      dispatch({ type: "players_snapshot", players });
      // Re-derive the partner as seats/teams settle; swaps the partner listener.
      attachPartner(partnerIdOf(players, playerId));
    },
    report("players"),
  );

  const unsubState = onSnapshot(
    stateRef(db, roomId),
    (snap) => dispatch({ type: "state_snapshot", state: snap.data() ?? null }),
    report("state"),
  );

  const unsubOwnHand = onSnapshot(
    handRef(db, roomId, playerId),
    (snap) => dispatch({ type: "own_hand_snapshot", hand: snap.data() ?? null }),
    report("ownHand"),
  );

  return {
    unsubscribe() {
      unsubRoom();
      unsubPlayers();
      unsubState();
      unsubOwnHand();
      partnerUnsub?.();
      partnerUnsub = null;
      partnerId = null;
    },
  };
}
