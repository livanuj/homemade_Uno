/**
 * Helpers for tests that run against the LOCAL Supabase stack (`supabase
 * start`). Connection details come from `supabase status`, so no keys are
 * hardcoded. Every test uses fresh anonymous users and a fresh room id, so
 * tests never collide with each other or with data from manual play.
 */
import { execSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

interface LocalEnv {
  url: string;
  anonKey: string;
  serviceKey: string;
}

let cached: LocalEnv | null = null;

export function localEnv(): LocalEnv {
  if (cached) return cached;
  const out = execSync("supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const env = Object.fromEntries(
    out
      .split("\n")
      .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => [m[1], m[2]]),
  );
  cached = { url: env.API_URL!, anonKey: env.ANON_KEY!, serviceKey: env.SERVICE_ROLE_KEY! };
  return cached;
}

const NO_SESSION = { auth: { persistSession: false, autoRefreshToken: false } } as const;

/** Service-role client: bypasses RLS (seeding + server-side assertions). */
export function serviceClient(): SupabaseClient {
  const { url, serviceKey } = localEnv();
  return createClient(url, serviceKey, NO_SESSION);
}

export interface Player {
  client: SupabaseClient;
  uid: string;
}

/** A freshly signed-in anonymous player. */
export async function anonPlayer(): Promise<Player> {
  const { url, anonKey } = localEnv();
  const client = createClient(url, anonKey, NO_SESSION);
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.user) throw error ?? new Error("anonymous sign-in failed");
  return { client, uid: data.user.id };
}

/** A room id that no other test uses. */
export function freshRoomId(): string {
  return `T${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

/** Write documents straight into a room (service role). */
export async function seedRoom(roomId: string, docs: Record<string, unknown>): Promise<void> {
  const rows = Object.entries(docs).map(([path, doc]) => ({ room_id: roomId, path, doc }));
  const { error } = await serviceClient().from("room_docs").upsert(rows);
  if (error) throw error;
}

/** Read one document as `player` (subject to RLS); null when not visible. */
export async function readAs(player: Player, roomId: string, path: string): Promise<unknown> {
  const { data, error } = await player.client
    .from("room_docs")
    .select("doc")
    .eq("room_id", roomId)
    .eq("path", path)
    .maybeSingle();
  if (error) throw error;
  return data?.doc ?? null;
}
