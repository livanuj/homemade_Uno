/**
 * Public surface of the realtime layer (Task 5).
 *
 * The read-only authoritative store + Firestore `onSnapshot` subscriptions
 * (5.1), the versioned action client / `useGameActions` (5.1), the presence
 * heartbeat (5.2), and the reconnect resync wired together in
 * {@link useRoomChannel} (5.3). Task 9 adopts `useRoomChannel` to back the
 * screens (it renders nothing and mutates no game document — server state is
 * read-only truth).
 */
export {
  initialStore,
  storeReducer,
  selectActivePlayer,
  selectConnectionOf,
  selectIsMyTurn,
  selectVersion,
  type PendingAction,
  type RealtimeStore,
  type SessionConnection,
  type StoreAction,
  type StorePlayer,
  type StoreRejection,
} from "./store";
export {
  subscribeRoom,
  type Dispatch,
  type SubscribeOptions,
  type Subscription,
} from "./subscription";
export {
  makeActionClient,
  useGameActions,
  type ActionClient,
} from "./actions";
export {
  startHeartbeat,
  HEARTBEAT_INTERVAL_MS,
  type Heartbeat,
  type HeartbeatOptions,
} from "./presence";
export { useRoomChannel, type RoomChannel } from "./useRoomChannel";
