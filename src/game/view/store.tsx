/**
 * RoomStore — the injectable seam between the screens (task 8) and the room /
 * game data source.
 *
 * Screens read view-models (`RoomView`, `PlayerView`, …) and call actions
 * (`createRoom`, `join`) through this store rather than touching Firestore
 * directly. Today the store is backed by in-memory fixtures (`fixtures.ts`)
 * because the realtime layer (task 5) and Cloud Functions (task 4) are
 * DEFERRED. When they land, `createFixtureRoomStore` is replaced by a
 * Firestore-backed implementation of the SAME `RoomStore` interface —
 * `onSnapshot` on `state/current` + the `players` collection feeds the
 * view-models, and `createRoom`/`join` call the matching callable functions.
 * The screens and this context do not change.
 *
 * The provider is intentionally minimal: it is the shared foundation that
 * 8.2–8.7 extend (lobby/table/overlay view-models) without re-plumbing.
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  FIXTURE_ROOMS,
  inviteLinkForCode,
  makeFreshRoom,
  makeJoinedRoom,
} from "./fixtures";
import type { RoomActionResult } from "./types";

/**
 * The contract every backing implementation honours. Actions are async so the
 * fixture and the future Firestore/callable implementation share one signature.
 */
export interface RoomStore {
  /**
   * Create a new room owned by `hostName`. Today returns a fixture room with a
   * generated code; later calls the `createRoom` Cloud Function.
   */
  createRoom(hostName: string): Promise<RoomActionResult>;
  /**
   * Attempt to join `code` as `name`. Today resolves against fixture codes;
   * later calls the `join` Cloud Function and maps its reason codes.
   */
  join(code: string, name: string): Promise<RoomActionResult>;
}

const RoomStoreContext = createContext<RoomStore | null>(null);

/**
 * Fixture-backed `RoomStore`. Pure/deterministic: `createRoom` always succeeds
 * with a canned code; `join` succeeds for any 4-char code except the reserved
 * fixture codes that model the not-found / full / already-started outcomes so
 * the Home error states are reachable without a backend.
 *
 * TASK 5/9: replace with a Firestore + callable-function implementation.
 */
export function createFixtureRoomStore(): RoomStore {
  return {
    async createRoom(hostName) {
      const code = "K7QX";
      return { ok: true, room: makeFreshRoom(code, hostName) };
    },
    async join(code, name) {
      const normalized = code.toUpperCase();
      if (normalized === "NONE" || normalized === "ABCD") {
        return { ok: false, reason: "room-not-found" };
      }
      if (normalized === FIXTURE_ROOMS.full) {
        return { ok: false, reason: "room-full" };
      }
      if (normalized === FIXTURE_ROOMS.started) {
        return { ok: false, reason: "game-already-started" };
      }
      return {
        ok: true,
        room: {
          ...makeJoinedRoom(normalized, name),
          inviteLink: inviteLinkForCode(normalized),
        },
      };
    },
  };
}

interface RoomStoreProviderProps {
  children: ReactNode;
  /** Inject a store (tests / future realtime impl); defaults to fixtures. */
  store?: RoomStore;
}

/**
 * Provides a `RoomStore` to the tree. Defaults to the fixture store; tests and
 * the future realtime layer pass their own implementation via `store`.
 */
export function RoomStoreProvider({ children, store }: RoomStoreProviderProps) {
  const value = useMemo(() => store ?? createFixtureRoomStore(), [store]);
  return (
    <RoomStoreContext.Provider value={value}>
      {children}
    </RoomStoreContext.Provider>
  );
}

/**
 * Read the active `RoomStore`. Falls back to a fixture store when no provider
 * is mounted, so a screen rendered in isolation (or a test) still works.
 */
export function useRoomStore(): RoomStore {
  const ctx = useContext(RoomStoreContext);
  // Stable fallback for provider-less rendering (previews / unit tests).
  const fallback = useMemo(() => createFixtureRoomStore(), []);
  return ctx ?? fallback;
}
