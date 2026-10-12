/**
 * `game` Edge Function — the single server-authoritative entry point
 * (Req 14.5, 23.3). Every room and game mutation is a POST of
 * `{ name, data }`, routed to the matching handler, which runs the pure rules
 * engine inside a room transaction.
 *
 * Responses:
 *   200 `{ result }`                — the handler's return value (rule
 *                                     rejections are `{ ok: false, reason }`)
 *   4xx `{ error: { code, message } }` — bad input, no session, etc.
 */
import { callLast, catchLast, chooseColor, drawOne, keep, playCard } from "./actions.ts";
import { HttpsError, type Callable } from "./callable.ts";
import { enforceGrace } from "./grace.ts";
import { continueWithout, endGame, leave, pause, playAgain, resume } from "./lifecycle.ts";
import { setMode, setTeams } from "./lobby.ts";
import { setConnection } from "./presence.ts";
import { createRoom, join } from "./rooms.ts";
import { startGame } from "./start.ts";
import { adminClient, TransactionContention } from "./store.ts";

const HANDLERS: Record<string, Callable> = {
  createRoom,
  join,
  startGame,
  playCard,
  chooseColor,
  drawOne,
  keep,
  callLast,
  catchLast,
  pause,
  resume,
  continueWithout,
  endGame,
  leave,
  playAgain,
  setConnection,
  enforceGrace,
  setMode,
  setTeams,
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STATUS: Record<string, number> = {
  "invalid-argument": 400,
  "failed-precondition": 400,
  unauthenticated: 401,
  "permission-denied": 403,
  "not-found": 404,
  "already-exists": 409,
  aborted: 409,
  "resource-exhausted": 429,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function fail(code: string, message: string): Response {
  return json({ error: { code, message } }, STATUS[code] ?? 500);
}

/** The signed-in caller's uid, or undefined (anonymous users count). */
async function callerUid(req: Request): Promise<string | undefined> {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return undefined;
  const { data, error } = await adminClient().auth.getUser(token);
  return error ? undefined : data.user?.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fail("invalid-argument", "POST only.");

  let body: { name?: unknown; data?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("invalid-argument", "Body must be JSON.");
  }
  const handler = typeof body.name === "string" ? HANDLERS[body.name] : undefined;
  if (!handler) return fail("not-found", `Unknown action ${String(body.name)}.`);

  const uid = await callerUid(req);
  try {
    const result = await handler.run({ ...(uid ? { auth: { uid } } : {}), data: body.data ?? {} });
    return json({ result });
  } catch (err) {
    if (err instanceof HttpsError) return fail(err.code, err.message);
    if (err instanceof TransactionContention) return fail("aborted", err.message);
    console.error(`game/${String(body.name)} failed`, err);
    return fail("internal", "Something went wrong.");
  }
});
