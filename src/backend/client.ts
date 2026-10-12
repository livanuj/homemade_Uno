/**
 * The Supabase client — the single place the app initializes the SDK.
 *
 * Configured from `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (see
 * `.env.example`). For local development point them at `supabase start`
 * (`http://127.0.0.1:54321` and the local anon key from `supabase status`).
 *
 * The game is server-authoritative: clients only read RLS-scoped room
 * documents and call the `game` Edge Function. This module holds no game
 * logic. The anon key is public by design — hidden hands are enforced by Row
 * Level Security and the Edge Function, not by hiding this value.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL ?? "http://127.0.0.1:54321";
// A placeholder keeps module import safe when unconfigured (tests, previews);
// real requests then fail with an auth error instead of crashing the app.
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "anon-key-not-configured";

export const supabase: SupabaseClient = createClient(url, anonKey, {
  auth: {
    // The anonymous session IS the Player_ID; persist it so a reload or an
    // invite-link reopen restores the same seat (Req 3.1).
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "homemade-uno-session",
  },
});
