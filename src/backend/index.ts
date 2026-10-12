/**
 * Public surface of the backend module (Supabase: anonymous auth, the `game`
 * Edge Function transport, room document types and paths).
 */
export { ensureSession, onSession, type Session } from "./auth";
export { callAction, type ActionName, type CallResult } from "./callAction";
export { supabase } from "./client";
export * from "./paths";
export * from "./types";
export { useSession, type SessionStatus, type UseSessionResult } from "./useSession";
