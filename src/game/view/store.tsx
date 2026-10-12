/**
 * RoomStore — the injectable seam between the Home screen and the room backend.
 *
 * The Home screen reads no game state through this store; it only *creates* and
 * *joins* rooms. Those two actions are now backed by the REAL Cloud Functions
 * (`createRoom` / `join`) through the single {@link callAction} transport
 * (Task 9.1), replacing the Task-8 fixture store. Everything else the screens
 * render — the lobby, table, overlays, game-over — comes from the live realtime
 * channel (`useRoomChannel`) mapped through `mappers.ts`, NOT from here.
 *
 * A room action requires a ready anonymous session (the `Player_ID` is the
 * session uid, Req 3.1). The Firebase-backed store calls {@link ensureSession}
 * before the callable so a `create`/`join` always has an authenticated caller;
 * screens additionally gate their buttons on `useSession().status === "ready"`.
 *
 * The provider/`useRoomStore` shape is unchanged from Task 8 so every screen and
 * test keeps compiling. Tests inject a stub store via `store={…}`; the fixture
 * store (`createFixtureRoomStore`) is retained for provider-less previews and
 * unit tests that don't want a backend.
 */
import { ensureSession } from "@/firebase/auth";
import { callAction } from "@/firebase/callAction";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  FIXTURE_ROOMS,
  inviteLinkForCode,
  makeFreshRoom,
  makeJoinedRoom,
} from "./fixtures";
import type { JoinFailureReason, RoomActionResult, RoomView } from "./types";

/**
 * The contract every backing implementation honours. Actions are async so the
 * fixture and the Firebase/callable implementation share one signature.
 */
export interface RoomStore {
  /**
   * Create a new room owned by `hostName` via the `createRoom` Cloud Function
   * and return the created room (its code drives navigation to the lobby).
   */
  createRoom(hostName: string): Promise<RoomActionResult>;
  /**
   * Attempt to join `code` as `name` via the `join` Cloud Function, mapping its
   * reason codes to the Home error states.
   */
  join(code: string, name: string): Promise<RoomActionResult>;
}

const RoomStoreContext = createContext<RoomStore | null>(null);

/** A minimal `RoomView` for a freshly created / joined room (pre-lobby-sync). */
function roomViewFromCode(code: string): RoomView {
  return {
    code,
    inviteLink: inviteLinkForCode(code),
    mode: "normal",
    phase: "lobby",
    roundNumber: 1,
    players: [],
  };
}

/** Map a thrown `HttpsError` code / server reason → a Home failure reason. */
function joinFailureFor(reason: string | undefined): JoinFailureReason {
  const r = reason ?? "";
  if (r.includes("not-found")) return "room-not-found";
  if (r.includes("resource-exhausted")) return "room-full";
  if (r.includes("failed-precondition")) return "game-already-started";
  // Unknown → treat as not-found so the Home error surfaces gracefully.
  return "room-not-found";
}

/**
 * The Firebase-backed `RoomStore` (Task 9.1). `createRoom`/`join` ensure an
 * anonymous session, then dispatch the matching callable through
 * {@link callAction}. The result carries the room code so the Home route can
 * navigate to `/room/:code`; the lobby then hydrates from the realtime channel.
 */
export function createFirebaseRoomStore(): RoomStore {
  return {
    async createRoom(hostName) {
      await ensureSession();
      const res = await callAction<
        { displayName: string },
        { roomId: string; roomCode: string; inviteLink: string }
      >("createRoom", { displayName: hostName });
      if (!res.ok) {
        return { ok: false, reason: joinFailureFor(res.reason) };
      }
      const code = res.data.roomCode ?? res.data.roomId;
      return { ok: true, room: roomViewFromCode(code) };
    },
    async join(code, name) {
      await ensureSession();
      const normalized = code.trim().toUpperCase();
      const res = await callAction<
        { roomCode: string; displayName: string },
        { roomId: string; roomCode: string }
      >("join", { roomCode: normalized, displayName: name });
      if (!res.ok) {
        return { ok: false, reason: joinFailureFor(res.reason) };
      }
      const resolved = res.data.roomCode ?? normalized;
      return { ok: true, room: roomViewFromCode(resolved) };
    },
  };
}

/**
 * Fixture-backed `RoomStore`. Pure/deterministic; retained for provider-less
 * previews and unit tests. `createRoom` always succeeds with a canned code;
 * `join` succeeds for any 4-char code except the reserved fixture codes that
 * model the not-found / full / already-started outcomes.
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
  /** Inject a store (tests / previews); defaults to the Firebase-backed store. */
  store?: RoomStore;
}

/**
 * Provides a `RoomStore` to the tree. Defaults to the Firebase-backed store
 * (real `createRoom`/`join` callables); tests pass their own stub via `store`.
 */
export function RoomStoreProvider({ children, store }: RoomStoreProviderProps) {
  const value = useMemo(() => store ?? createFirebaseRoomStore(), [store]);
  return (
    <RoomStoreContext.Provider value={value}>
      {children}
    </RoomStoreContext.Provider>
  );
}

/**
 * Read the active `RoomStore`. Falls back to a FIXTURE store when no provider
 * is mounted, so a screen rendered in isolation (or a unit test) still works
 * without a backend.
 */
export function useRoomStore(): RoomStore {
  const ctx = useContext(RoomStoreContext);
  const fallback = useMemo(() => createFixtureRoomStore(), []);
  return ctx ?? fallback;
}
