import type { ConnectionSnapshot, GameMode } from "./types";

/**
 * The auto-pause predicate (Req 15.7, 25.10). Pure function of connection
 * state: an Auto_Pause is active if and only if fewer than 2 players are
 * connected, OR the mode is Team mode and both players of some team are
 * disconnected.
 *
 * "Disconnected" for the team clause means not connected (either `disconnected`
 * or `left`).
 */
export function shouldAutoPause(mode: GameMode, players: readonly ConnectionSnapshot[]): boolean {
  const connectedCount = players.filter((p) => p.connection === "connected").length;
  if (connectedCount < 2) {
    return true;
  }

  if (mode === "team") {
    for (const team of ["A", "B"] as const) {
      const members = players.filter((p) => p.team === team);
      if (members.length > 0 && members.every((p) => p.connection !== "connected")) {
        return true;
      }
    }
  }

  return false;
}
