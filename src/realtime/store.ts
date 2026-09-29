/**
 * The read-only authoritative realtime store (Task 5.1).
 *
 * This is a plain (framework-agnostic) store that holds the LATEST server
 * snapshots delivered by the Firestore `onSnapshot` listeners in
 * {@link ./subscription}. Screens render from this store; they never mutate it.
 * The single source of truth is the server — this store only mirrors it.
 *
 * The store also carries a small amount of client-only, non-authoritative UI
 * bookkeeping: the last `pendingAction` (an optimistic intent awaiting the
 * server's accept/reject) and the last `rejection` (so the UI can surface an
 * illegal-tap / stale-version signal and revert its optimistic view). These are
 * NEVER treated as game state — the rendered game is always the server snapshot.
 *
 * Design refs: design.md "Architecture" (onSnapshot store), steering
 * `conventions/firestore-data.md` ("Hold snapshot state in a read-only store;
 * do not fork or locally edit it") and `component-architecture.md` ("Server
 * state is read-only truth").
 */
import type {
  ActionType,
  ConnectionState,
  HandDoc,
  PlayerDoc,
  RoomDoc,
  StateDoc,
} from "@/firebase/types";

/** A player row keyed by its `Player_ID` (the doc id). */
export interface StorePlayer {
  readonly playerId: string;
  readonly doc: PlayerDoc;
}

/** Connection lifecycle of the client's own realtime session (Req 14.7, 15). */
export type SessionConnection = "connecting" | "online" | "offline";

/**
 * A client-side optimistic intent that is awaiting the server's decision. It
 * exists only to let the UI show immediate feedback (a raised card, a spinner)
 * and to be reverted on rejection — it is never authoritative.
 */
export interface PendingAction {
  /** Matches the callable name / action kind (`play`, `draw`, …). */
  readonly kind: ActionType;
  /** The `state.version` the action was stamped against (Req 14.5). */
  readonly basedOnVersion: number;
  /** Optional payload for UI reconciliation (e.g. the tapped card id). */
  readonly cardId?: string;
}

/** The reason the server rejected the most recent action (for revert + toast). */
export interface StoreRejection {
  readonly kind: ActionType;
  /** Server reason code (`stale_version`, `not_active`, `illegal_card`, …). */
  readonly reason: string;
  /** When it happened (ms epoch), so the UI can dedupe/expire it. */
  readonly at: number;
}

/**
 * The complete read-only snapshot the app renders from. Every field mirrors a
 * server document (or is `null` until the first snapshot arrives).
 */
export interface RealtimeStore {
  readonly roomId: string | null;
  /** This client's `Player_ID` (the auth uid). */
  readonly playerId: string | null;

  readonly room: RoomDoc | null;
  readonly players: readonly StorePlayer[];
  readonly state: StateDoc | null;
  /** The caller's own hand. */
  readonly ownHand: HandDoc | null;
  /** The partner's hand in Team mode (null in Normal, or before it loads). */
  readonly partnerHand: HandDoc | null;

  /** Own realtime session connection (drives reconnect UI, Req 14.7). */
  readonly connection: SessionConnection;

  /** True until the room + state + own-hand snapshots have all arrived once. */
  readonly hydrated: boolean;

  /** A client-only optimistic intent awaiting the server (never authoritative). */
  readonly pendingAction: PendingAction | null;
  /** The most recent server rejection, for optimistic-UI revert (Req 14.5). */
  readonly rejection: StoreRejection | null;
}

/** The initial, empty store before any subscription is attached. */
export function initialStore(playerId: string | null = null): RealtimeStore {
  return {
    roomId: null,
    playerId,
    room: null,
    players: [],
    state: null,
    ownHand: null,
    partnerHand: null,
    connection: "connecting",
    hydrated: false,
    pendingAction: null,
    rejection: null,
  };
}

/**
 * The actions that drive the store. All but the two client-only ones
 * (`pending_action`, `rejected`, `connection`) are pure reflections of a
 * server snapshot delivered by the listeners.
 */
export type StoreAction =
  | { type: "attach"; roomId: string; playerId: string }
  | { type: "detach" }
  | { type: "room_snapshot"; room: RoomDoc | null }
  | { type: "players_snapshot"; players: readonly StorePlayer[] }
  | { type: "state_snapshot"; state: StateDoc | null }
  | { type: "own_hand_snapshot"; hand: HandDoc | null }
  | { type: "partner_hand_snapshot"; hand: HandDoc | null }
  | { type: "connection"; connection: SessionConnection }
  | { type: "pending_action"; pending: PendingAction | null }
  | { type: "rejected"; rejection: StoreRejection };

/** Whether the minimum set of snapshots needed to render has arrived. */
function computeHydrated(s: RealtimeStore): boolean {
  // Room + players are enough for the lobby; state + own hand are needed once
  // the game has started. We consider the store hydrated as soon as the room
  // and players collection have loaded — screens gate game rendering on
  // `state` themselves.
  return s.room !== null && s.players.length > 0;
}

/**
 * The pure reducer. Given the current read-only store and a snapshot/UI action,
 * returns the next read-only store. It performs NO I/O; the subscription layer
 * feeds it snapshots and the action client feeds it pending/rejection markers.
 */
export function storeReducer(state: RealtimeStore, action: StoreAction): RealtimeStore {
  switch (action.type) {
    case "attach":
      return {
        ...initialStore(action.playerId),
        roomId: action.roomId,
        connection: "connecting",
      };
    case "detach":
      return initialStore(state.playerId);
    case "room_snapshot": {
      const next = { ...state, room: action.room };
      return { ...next, hydrated: computeHydrated(next) };
    }
    case "players_snapshot": {
      const next = { ...state, players: action.players };
      return { ...next, hydrated: computeHydrated(next) };
    }
    case "state_snapshot": {
      // A fresh authoritative state supersedes any optimistic pending action
      // and clears a stale rejection: the server has spoken.
      return {
        ...state,
        state: action.state,
        pendingAction: null,
      };
    }
    case "own_hand_snapshot":
      return { ...state, ownHand: action.hand };
    case "partner_hand_snapshot":
      return { ...state, partnerHand: action.hand };
    case "connection":
      return { ...state, connection: action.connection };
    case "pending_action":
      return { ...state, pendingAction: action.pending };
    case "rejected":
      // Drop the optimistic pending action and record the reason so the UI can
      // revert to the last confirmed snapshot (Req 14.5).
      return { ...state, pendingAction: null, rejection: action.rejection };
    default: {
      // Exhaustiveness guard.
      const _never: never = action;
      return state ?? _never;
    }
  }
}

// ---------------------------------------------------------------------------
// Derived selectors — pure helpers screens can use over the read-only store.
// ---------------------------------------------------------------------------

/** The active `StorePlayer`, or null if no game/seat is active. */
export function selectActivePlayer(s: RealtimeStore): StorePlayer | null {
  if (!s.state) return null;
  const seat = s.state.activeSeat;
  return s.players.find((p) => p.doc.seatIndex === seat) ?? null;
}

/** Whether it is this client's turn (own seat === active seat). */
export function selectIsMyTurn(s: RealtimeStore): boolean {
  const me = s.players.find((p) => p.playerId === s.playerId);
  return (
    !!me &&
    me.doc.seatIndex !== null &&
    s.state !== null &&
    me.doc.seatIndex === s.state.activeSeat
  );
}

/** The current authoritative version, or null before the state loads. */
export function selectVersion(s: RealtimeStore): number | null {
  return s.state?.version ?? null;
}

/** The connection state of a given player, or null if unknown. */
export function selectConnectionOf(
  s: RealtimeStore,
  playerId: string,
): ConnectionState | null {
  return s.players.find((p) => p.playerId === playerId)?.doc.connectionState ?? null;
}
