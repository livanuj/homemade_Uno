/// <reference types="vite/client" />

/**
 * Typed Vite env vars. The client is configured from `VITE_SUPABASE_URL` and
 * `VITE_SUPABASE_ANON_KEY` — both public by design (hidden hands are enforced
 * by Row Level Security + the `game` Edge Function, not by hiding these). See
 * `.env.example`.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
