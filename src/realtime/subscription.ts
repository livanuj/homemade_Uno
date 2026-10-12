/**
 * Room subscription manager (Task 5.1, 5.3).
 *
 * One Supabase Realtime channel per room streams every change to the room's
 * documents (`room_docs`, filtered by room id). Row Level Security decides
 * which rows reach this client: the room, players, public state, the caller's
 * own hand, and — in 2v2 — the partner's hand. The deck and action log never
 * arrive.
 *
 * The subscription keeps a local copy of the visible documents and feeds the
 * read-only store the same snapshots as before:
 *   room           → room_snapshot
 *   players/*      → players_snapshot
 *   state/current  → state_snapshot
 *   hands/<self>   → own_hand_snapshot
 *   hands/<partner>→ partner_hand_snapshot (partner derived from players)
 *
 * Once subscribed it loads every visible document, and again when the change
 * feed confirms it is listening, so a change made in between is never missed.
 * Each row carries `updated_at`; an older copy never overwrites a newer one.
 * Re-attach on reconnect by calling `subscribeRoom` again (Req 14.7).
 */
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { supabase as defaultClient } from "@/backend/client";
import { PLAYER_PREFIX, ROOM_PATH, STATE_PATH, handPath } from "@/backend/paths";
import type { HandDoc, PlayerDoc, RoomDoc, StateDoc } from "@/backend/types";
import type { StoreAction, StorePlayer } from "./store";

export type Dispatch = (action: StoreAction) => void;

export interface SubscribeOptions {
  readonly roomId: string;
  /** The caller's `Player_ID` (auth uid) — identifies the own hand. */
  readonly playerId: string;
  /** Sink that receives the derived {@link StoreAction}s. */
  readonly dispatch: Dispatch;
  /** Optional error reporter (e.g. to flip the store to `offline`). */
  readonly onError?: (source: string, error: Error) => void;
  /** Supabase client; defaults to the app's. */
  readonly client?: SupabaseClient;
}

export interface Subscription {
  unsubscribe(): void;
}

interface Row {
  path: string;
  doc: unknown;
  updated_at: string;
}

/**
 * Find the partner's `Player_ID` for `playerId` given the current players.
 * Only Team mode has a partner (same non-null team, different player).
 */
function partnerIdOf(players: readonly StorePlayer[], playerId: string): string | null {
  const me = players.find((p) => p.playerId === playerId);
  if (!me || me.doc.team === null) return null;
  const partner = players.find(
    (p) => p.playerId !== playerId && p.doc.team === me.doc.team,
  );
  return partner?.playerId ?? null;
}

export function subscribeRoom(opts: SubscribeOptions): Subscription {
  const { roomId, playerId, dispatch, onError } = opts;
  const client = opts.client ?? defaultClient;

  dispatch({ type: "attach", roomId, playerId });

  const docs = new Map<string, { doc: unknown; updatedAt: string }>();
  let closed = false;

  /** Recompute every slice and hand it to the store. */
  const emit = () => {
    if (closed) return;
    const get = <T>(path: string): T | null => (docs.get(path)?.doc as T | undefined) ?? null;

    const players: StorePlayer[] = [...docs.entries()]
      .filter(([path]) => path.startsWith(PLAYER_PREFIX))
      .map(([path, entry]) => ({
        playerId: path.slice(PLAYER_PREFIX.length),
        doc: entry.doc as PlayerDoc,
      }));
    const partnerId = partnerIdOf(players, playerId);

    dispatch({ type: "room_snapshot", room: get<RoomDoc>(ROOM_PATH) });
    dispatch({ type: "players_snapshot", players });
    dispatch({ type: "state_snapshot", state: get<StateDoc>(STATE_PATH) });
    dispatch({ type: "own_hand_snapshot", hand: get<HandDoc>(handPath(playerId)) });
    dispatch({
      type: "partner_hand_snapshot",
      hand: partnerId ? get<HandDoc>(handPath(partnerId)) : null,
    });
  };

  /** Keep the newer of the local and incoming copies. */
  const apply = (row: Row): boolean => {
    const current = docs.get(row.path);
    if (current && current.updatedAt > row.updated_at) return false;
    docs.set(row.path, { doc: row.doc, updatedAt: row.updated_at });
    return true;
  };

  /** Load every document this client may see. */
  const load = async () => {
    const startedAt = new Date().toISOString();
    const { data, error } = await client
      .from("room_docs")
      .select("path, doc, updated_at")
      .eq("room_id", roomId);
    if (closed) return;
    if (error) {
      onError?.("load", new Error(error.message));
      return;
    }
    const seen = new Set<string>();
    for (const row of (data ?? []) as Row[]) {
      seen.add(row.path);
      apply(row);
    }
    // Documents deleted before this load (and not re-written since) are gone.
    for (const [path, entry] of docs) {
      if (!seen.has(path) && entry.updatedAt < startedAt) docs.delete(path);
    }
    emit();
  };

  const channel: RealtimeChannel = client
    .channel(`room:${roomId}:${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "room_docs", filter: `room_id=eq.${roomId}` },
      (payload) => {
        if (payload.eventType === "DELETE") {
          const path = (payload.old as Partial<Row>).path;
          if (path && docs.delete(path)) emit();
          return;
        }
        // RLS only delivers the caller's own and partner's hands.
        if (apply(payload.new as Row)) emit();
      },
    )
    // The change feed confirms it is listening slightly after SUBSCRIBED;
    // load again then so nothing written in that gap is missed.
    .on("system", {}, (message: { extension?: string; status?: string }) => {
      if (message.extension === "postgres_changes" && message.status === "ok") void load();
    })
    .subscribe((status, err) => {
      if (status === "SUBSCRIBED") void load();
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        onError?.("channel", err ?? new Error(status));
      }
    });

  return {
    unsubscribe() {
      closed = true;
      void client.removeChannel(channel);
    },
  };
}
