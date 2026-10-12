/**
 * `callAction` — the single transport layer to the `game` Edge Function.
 *
 * Per steering `conventions/supabase-data.md` ("Action client is the single
 * transport layer"), EVERY server call in the app goes through this one thin
 * wrapper. Components and hooks never invoke the function directly — they use
 * {@link ../realtime/actions#useGameActions}, which delegates here.
 *
 * The server is authoritative: engine-driven actions return a structured
 * `{ ok, reason?, version? }` result (rejections are values, not errors — see
 * `supabase/functions/game/harness.ts`), while argument/auth failures come
 * back as an error response `{ error: { code } }`. This wrapper normalizes
 * both into a single {@link CallResult} so callers get one shape to branch on.
 */
import { supabase } from "./client";

/** The actions the `game` Edge Function routes (see its `index.ts`). */
export type ActionName =
  | "createRoom"
  | "join"
  | "startGame"
  | "playCard"
  | "chooseColor"
  | "drawOne"
  | "keep"
  | "callLast"
  | "catchLast"
  | "pause"
  | "resume"
  | "continueWithout"
  | "endGame"
  | "leave"
  | "playAgain"
  | "setConnection"
  | "enforceGrace"
  | "setMode"
  | "setTeams";

/** A normalized server result. `ok:false` carries a machine reason code. */
export interface CallResult<T = Record<string, unknown>> {
  readonly ok: boolean;
  /** Server reason code on rejection (`stale_version`, `not_active`, …). */
  readonly reason?: string;
  /** The authoritative version after an accepted mutation, when returned. */
  readonly version?: number;
  /** The raw payload the callable returned, for callers that need more. */
  readonly data: T;
}

/** Shape callables return through the harness / lifecycle functions. */
interface RawResult {
  ok?: boolean;
  reason?: string;
  version?: number;
  [k: string]: unknown;
}

/**
 * Invoke a server action and normalize its result. Never throws: rule
 * rejections come back as `{ ok: false, reason }`, and an error response
 * (bad args, no session, network) is normalized to `{ ok: false, reason: code }`
 * too, so callers have a single branch.
 */
export async function callAction<
  TReq extends Record<string, unknown> = Record<string, unknown>,
  TRes extends Record<string, unknown> = Record<string, unknown>,
>(name: ActionName, payload: TReq): Promise<CallResult<TRes>> {
  try {
    const { data, error } = await supabase.functions.invoke<{ result: TRes }>("game", {
      body: { name, data: payload },
    });
    if (error) return { ok: false, reason: await errorCode(error), data: {} as TRes };

    const res = data?.result ?? ({} as TRes);
    const raw = res as RawResult;
    // Actions that don't return an explicit `ok` (createRoom/join/startGame)
    // are treated as successful once they resolve without an error.
    const ok = raw.ok === undefined ? true : raw.ok === true;
    const result: { ok: boolean; data: TRes; reason?: string; version?: number } = { ok, data: res };
    if (raw.reason !== undefined) result.reason = raw.reason;
    if (typeof raw.version === "number") result.version = raw.version;
    return result;
  } catch {
    return { ok: false, reason: "unknown", data: {} as TRes };
  }
}

/** The `{ error: { code } }` from an error response, else a generic code. */
async function errorCode(error: unknown): Promise<string> {
  const response = (error as { context?: unknown }).context;
  if (response instanceof Response) {
    const body = (await response.json().catch(() => null)) as { error?: { code?: unknown } } | null;
    if (typeof body?.error?.code === "string") return body.error.code;
  }
  return "unknown";
}
