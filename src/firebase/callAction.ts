/**
 * `callAction` — the single transport layer for Cloud Function calls (Task 5.1).
 *
 * Per steering `conventions/firestore-data.md` ("Action client is the single
 * transport layer"), EVERY callable invocation in the app goes through this one
 * thin wrapper built on `httpsCallable`. Components and hooks never call
 * `httpsCallable` directly — they use {@link ../realtime/actions#useGameActions}
 * which delegates here.
 *
 * The server is authoritative: engine-driven actions return a structured
 * `{ ok, reason?, version? }` result (rejections are values, not thrown — see
 * `functions/src/harness.ts`), while argument/auth failures throw an
 * `HttpsError`. This wrapper normalizes both into a single {@link CallResult}
 * so callers get one shape to branch on and never have to touch the SDK.
 */
import { httpsCallable, type HttpsCallableResult } from "firebase/functions";
import { functions } from "./client";

/** The callable Cloud Functions exposed by the server (Task 4 + Task 5). */
export type ActionName =
  | "createRoom"
  | "join"
  | "startGame"
  | "playCard"
  | "chooseColor"
  | "drawOne"
  | "keep"
  | "callLast"
  | "pause"
  | "resume"
  | "continueWithout"
  | "endGame"
  | "leave"
  | "playAgain"
  | "setConnection"
  | "enforceGrace";

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
 * Invoke a Cloud Function and normalize its result. Never throws for expected
 * server rejections (those come back as `{ ok: false, reason }`); a thrown
 * `HttpsError` (bad args, unauthenticated, network) is normalized to
 * `{ ok: false, reason: code }` too so callers have a single branch.
 */
export async function callAction<
  TReq extends Record<string, unknown> = Record<string, unknown>,
  TRes extends Record<string, unknown> = Record<string, unknown>,
>(name: ActionName, payload: TReq): Promise<CallResult<TRes>> {
  const fn = httpsCallable<TReq, TRes>(functions, name);
  try {
    const res: HttpsCallableResult<TRes> = await fn(payload);
    const raw = (res.data ?? {}) as RawResult;
    // Callables that don't return an explicit `ok` (createRoom/join/startGame)
    // are treated as successful once they resolve without throwing.
    const ok = raw.ok === undefined ? true : raw.ok === true;
    const result: { ok: boolean; data: TRes; reason?: string; version?: number } = {
      ok,
      data: res.data ?? ({} as TRes),
    };
    if (raw.reason !== undefined) result.reason = raw.reason;
    if (typeof raw.version === "number") result.version = raw.version;
    return result;
  } catch (err: unknown) {
    // A thrown HttpsError carries a `.code` like "functions/unauthenticated".
    const code =
      typeof err === "object" && err !== null && "code" in err
        ? String((err as { code: unknown }).code)
        : "unknown";
    return { ok: false, reason: code, data: {} as TRes };
  }
}
