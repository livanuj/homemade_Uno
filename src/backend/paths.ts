/**
 * Document paths within a room (`room_docs.path`). The one place these names
 * live on the client; they mirror `supabase/functions/game/refs.ts`.
 */
export const ROOM_PATH = "room";
export const STATE_PATH = "state/current";
export const PLAYER_PREFIX = "players/";
export const HAND_PREFIX = "hands/";

export function playerPath(playerId: string): string {
  return `${PLAYER_PREFIX}${playerId}`;
}

export function handPath(playerId: string): string {
  return `${HAND_PREFIX}${playerId}`;
}
