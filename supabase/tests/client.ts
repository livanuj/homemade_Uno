/**
 * Player-side helpers for the `game` Edge Function tests: a signed-in
 * anonymous player that can call the function and read room documents
 * through Row Level Security, plus service-role readers for assertions and a
 * Realtime-backed `waitForSnapshot`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { anonPlayer, serviceClient } from "./helpers";

export interface Client {
  supabase: SupabaseClient;
  uid: string;
  /** Call the `game` function; resolves with its result, throws on an error response. */
  call<TReq, TRes>(name: string, data: TReq): Promise<TRes>;
}

/** Error thrown by `call` for a 4xx/5xx response; `code` is e.g. `not-found`. */
export class CallError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(`${code}: ${message}`);
  }
}

export async function makeClient(): Promise<Client> {
  const { client, uid } = await anonPlayer();
  return {
    supabase: client,
    uid,
    async call<TReq, TRes>(name: string, data: TReq): Promise<TRes> {
      const { data: body, error } = await client.functions.invoke("game", { body: { name, data } });
      if (error) {
        const res = (error as { context?: Response }).context;
        const payload = res ? await res.json().catch(() => null) : null;
        const e = payload?.error as { code?: string; message?: string } | undefined;
        throw new CallError(e?.code ?? "internal", e?.message ?? String(error));
      }
      return (body as { result: TRes }).result;
    },
  };
}

export async function destroyClient(client: Client): Promise<void> {
  await client.supabase.removeAllChannels();
}

async function readDoc<T>(client: Client, roomId: string, path: string): Promise<T | null> {
  const { data, error } = await client.supabase
    .from("room_docs")
    .select("doc")
    .eq("room_id", roomId)
    .eq("path", path)
    .maybeSingle();
  if (error) throw error;
  return (data?.doc as T | undefined) ?? null;
}

/** The public state doc, as this client sees it. */
export function readState(client: Client, roomId: string) {
  return readDoc<Record<string, unknown>>(client, roomId, "state/current");
}

/** A hand doc (own, or partner's in 2v2 — otherwise null). */
export function readHand(client: Client, roomId: string, playerId: string) {
  return readDoc<{ cards: { id: string }[]; cardCount: number }>(client, roomId, `hands/${playerId}`);
}

export function readRoom(client: Client, roomId: string) {
  return readDoc<Record<string, unknown>>(client, roomId, "room");
}

export function readPlayer(client: Client, roomId: string, playerId: string) {
  return readDoc<Record<string, unknown>>(client, roomId, `players/${playerId}`);
}

export async function readPlayers(
  client: Client,
  roomId: string,
): Promise<Array<{ id: string } & Record<string, unknown>>> {
  const { data, error } = await client.supabase
    .from("room_docs")
    .select("path, doc")
    .eq("room_id", roomId)
    .like("path", "players/%");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: (row.path as string).slice("players/".length),
    ...(row.doc as Record<string, unknown>),
  }));
}

// ---------------------------------------------------------------------------
// Service-role readers (bypass RLS) for assertions.
// ---------------------------------------------------------------------------

async function adminDoc<T>(roomId: string, path: string): Promise<T | null> {
  const { data, error } = await serviceClient()
    .from("room_docs")
    .select("doc")
    .eq("room_id", roomId)
    .eq("path", path)
    .maybeSingle();
  if (error) throw error;
  return (data?.doc as T | undefined) ?? null;
}

export function readDeck(roomId: string) {
  return adminDoc<{ drawPile: { id: string }[] }>(roomId, "private/deck");
}

export function readStateAdmin(roomId: string) {
  return adminDoc<Record<string, unknown>>(roomId, "state/current");
}

export async function readAllHands(roomId: string): Promise<{ id: string; cards: { id: string }[] }[]> {
  const { data, error } = await serviceClient()
    .from("room_docs")
    .select("path, doc")
    .eq("room_id", roomId)
    .like("path", "hands/%");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: (row.path as string).slice("hands/".length),
    cards: ((row.doc as { cards?: { id: string }[] }).cards ?? []),
  }));
}

/** Set a player's presence directly, backdating `lastSeen` by `ageMs`. */
export async function setPresenceAdmin(
  roomId: string,
  playerId: string,
  connectionState: "connected" | "disconnected" | "left",
  ageMs = 0,
): Promise<void> {
  const path = `players/${playerId}`;
  const doc = await adminDoc<Record<string, unknown>>(roomId, path);
  if (!doc) throw new Error(`no player ${playerId} in ${roomId}`);
  const { error } = await serviceClient()
    .from("room_docs")
    .update({ doc: { ...doc, connectionState, lastSeen: Date.now() - ageMs } })
    .eq("room_id", roomId)
    .eq("path", path);
  if (error) throw error;
}

/**
 * Resolve once `path` in `roomId`, as `client` sees it live, satisfies
 * `predicate`. Checks the current value first (like a snapshot listener's
 * first event), then every Realtime change. Rejects after `timeoutMs`.
 */
export function waitForSnapshot<T = Record<string, unknown>>(
  client: Client,
  roomId: string,
  path: string,
  predicate: (data: T | null) => boolean,
  timeoutMs: number,
): Promise<{ data: T | null; elapsedMs: number }> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    let settled = false;
    const channel = client.supabase.channel(`wait-${roomId}-${path}-${crypto.randomUUID()}`);
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void client.supabase.removeChannel(channel);
      fn();
    };
    const check = (data: T | null) => {
      if (predicate(data)) finish(() => resolve({ data, elapsedMs: Date.now() - start }));
    };
    const timer = setTimeout(
      () => finish(() => reject(new Error(`waitForSnapshot timed out after ${timeoutMs}ms for ${roomId}/${path}`))),
      timeoutMs,
    );
    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_docs", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = payload.new as { path?: string; doc?: T } | undefined;
          if (row?.path === path) check(row.doc ?? null);
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void readDoc<T>(client, roomId, path).then(check, () => undefined);
      });
  });
}

/**
 * Wait until Realtime has caught up with the database's change log. Realtime
 * only processes changes while someone is subscribed, so after a burst of
 * unsubscribed writes (earlier test files) the first subscriber would see that
 * backlog replayed before any new change. Call before latency assertions.
 */
export async function drainRealtime(timeoutMs = 60_000): Promise<void> {
  const watcher = await makeClient();
  const roomId = `D${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const path = `players/${watcher.uid}`;
  const service = serviceClient();
  const { error } = await service.from("room_docs").insert({ room_id: roomId, path, doc: { n: 0 } });
  if (error) throw error;

  // Subscribe, then keep writing a marker until one arrives LIVE. (A change
  // made in the moment right after SUBSCRIBED can be missed, so retry.)
  await new Promise<void>((resolve, reject) => {
    let n = 0;
    let ticker: ReturnType<typeof setInterval> | undefined;
    const done = (fn: () => void) => {
      clearTimeout(timer);
      clearInterval(ticker);
      void watcher.supabase.removeChannel(channel);
      fn();
    };
    const timer = setTimeout(() => done(() => reject(new Error("Realtime did not catch up in time"))), timeoutMs);
    const channel = watcher.supabase
      .channel(`drain-${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "room_docs", filter: `room_id=eq.${roomId}` },
        () => done(resolve),
      )
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        ticker = setInterval(() => {
          n += 1;
          // A query builder only runs once awaited/then'd.
          void service.from("room_docs").update({ doc: { n } }).eq("room_id", roomId).eq("path", path).then();
        }, 500);
      });
  });
  await destroyClient(watcher);
}
