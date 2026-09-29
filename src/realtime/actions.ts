/**
 * The versioned action client + `useGameActions` hook (Task 5.1).
 *
 * This is the ONLY place screens/components trigger game mutations. Each action:
 *   1. reads the CURRENT authoritative `version` from the read-only store and
 *      stamps the request with `basedOnVersion` (optimistic concurrency, Req
 *      14.5);
 *   2. records an optimistic `pendingAction` in the store so the UI can show
 *      immediate feedback;
 *   3. delegates to {@link @/firebase/callAction} (the single transport);
 *   4. on a REJECTION (`stale_version`, `not_active`, `illegal_card`, …) records
 *      the rejection in the store, which drops the optimistic pending action so
 *      the UI reverts to the last confirmed snapshot. The snapshot listeners
 *      then re-deliver the authoritative state (the resync).
 *
 * On accept, the store is NOT mutated here — the authoritative outcome always
 * arrives via the `state`/`hands` `onSnapshot` listeners (design.md: "the
 * authoritative outcome always comes from the Firestore `onSnapshot` update").
 *
 * Components never call `httpsCallable` or `callAction` directly (steering
 * `firestore-data.md`): they use the object this hook returns.
 */
import { useMemo } from "react";
import { callAction, type ActionName, type CallResult } from "@/firebase/callAction";
import type { Suit } from "@/firebase/types";
import type { ActionType } from "@/firebase/types";
import type { PendingAction, RealtimeStore, StoreAction } from "./store";

/** A dispatch into the read-only store (records pending/rejection markers). */
type Dispatch = (action: StoreAction) => void;

/** Map an {@link ActionName} to the store's optimistic `ActionType`. */
function pendingKind(name: ActionName): ActionType | null {
  switch (name) {
    case "playCard":
      return "play";
    case "drawOne":
      return "draw";
    case "keep":
      return "keep";
    case "chooseColor":
      return "choose_color";
    case "callLast":
      return "call_last";
    case "pause":
      return "pause";
    case "resume":
      return "resume";
    case "continueWithout":
      return "continue_without";
    case "endGame":
      return "end_game";
    case "leave":
      return "leave";
    default:
      // Room lifecycle calls (createRoom/join/startGame/playAgain/…) carry no
      // engine version and get no optimistic pending marker.
      return null;
  }
}

/** The versioned action client, bound to a specific store snapshot + dispatch. */
export interface ActionClient {
  playCard(cardId: string): Promise<CallResult>;
  drawOne(): Promise<CallResult>;
  chooseColor(color: Suit): Promise<CallResult>;
  keep(): Promise<CallResult>;
  callLast(): Promise<CallResult>;
  pause(): Promise<CallResult>;
  resume(): Promise<CallResult>;
  continueWithout(): Promise<CallResult>;
  endGame(): Promise<CallResult>;
  leave(): Promise<CallResult>;
  playAgain(): Promise<CallResult>;
  /** Ask the server to enforce the grace/auto-pause check (Task 5.4). */
  enforceGrace(): Promise<CallResult>;
}

/**
 * Build an {@link ActionClient} over the current store + a dispatch. Pure and
 * synchronous; the hook memoizes it against `roomId` + `version` so the stamped
 * `basedOnVersion` always reflects the latest authoritative state.
 */
export function makeActionClient(store: RealtimeStore, dispatch: Dispatch): ActionClient {
  const roomId = store.roomId;
  const version = store.state?.version ?? null;

  /** Run one versioned action end-to-end with optimistic pending + revert. */
  async function run(
    name: ActionName,
    extra: Record<string, unknown> = {},
    stampVersion = true,
  ): Promise<CallResult> {
    if (!roomId) {
      return { ok: false, reason: "no_room", data: {} };
    }

    const payload: Record<string, unknown> = { roomId, ...extra };
    if (stampVersion) {
      if (version === null) {
        return { ok: false, reason: "no_active_game", data: {} };
      }
      payload.basedOnVersion = version;
    }

    const kind = pendingKind(name);
    if (kind && stampVersion && version !== null) {
      const pending: PendingAction = {
        kind,
        basedOnVersion: version,
        ...(typeof extra.cardId === "string" ? { cardId: extra.cardId } : {}),
      };
      dispatch({ type: "pending_action", pending });
    }

    const result = await callAction(name, payload);

    if (!result.ok && kind) {
      // Rejected → drop the optimistic pending action + record the reason so the
      // UI reverts to the last confirmed snapshot (Req 14.5).
      dispatch({
        type: "rejected",
        rejection: { kind, reason: result.reason ?? "rejected", at: Date.now() },
      });
    }
    // On accept we intentionally do NOT touch the store: the authoritative
    // state arrives via the onSnapshot listeners.
    return result;
  }

  return {
    playCard: (cardId) => run("playCard", { cardId }),
    drawOne: () => run("drawOne"),
    chooseColor: (color) => run("chooseColor", { color }),
    keep: () => run("keep"),
    callLast: () => run("callLast"),
    pause: () => run("pause"),
    resume: () => run("resume"),
    continueWithout: () => run("continueWithout"),
    endGame: () => run("endGame"),
    leave: () => run("leave", {}, /* stampVersion */ false),
    playAgain: () => run("playAgain", {}, /* stampVersion */ false),
    enforceGrace: () => run("enforceGrace", {}, /* stampVersion */ false),
  };
}

/**
 * `useGameActions` — the hook screens use to trigger mutations. It memoizes the
 * {@link ActionClient} against the room + authoritative version so every call is
 * stamped with the freshest `basedOnVersion`.
 */
export function useGameActions(store: RealtimeStore, dispatch: Dispatch): ActionClient {
  return useMemo(
    () => makeActionClient(store, dispatch),
    // Re-bind when the room or authoritative version changes (fresh stamp).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store.roomId, store.state?.version, dispatch, store],
  );
}
