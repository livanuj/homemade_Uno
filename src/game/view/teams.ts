/**
 * Pure 2v2 team-arrangement rules for the lobby (Requirement 21). Each returns
 * the partial `{ playerId: team }` map the `setTeams` callable takes, or null
 * when the move is not allowed (the row then returns to its slot, Req 21.5).
 * The server re-validates every assignment; these only decide what to send.
 */
import type { PlayerView, TeamId } from "./types";

/** Each 2v2 team seats exactly two players. */
const TEAM_CAPACITY = 2;

/** What a dragged row was dropped on: an occupied row, or a team's empty seat. */
export type TeamDropTarget =
  | { kind: "player"; id: string }
  | { kind: "slot"; team: TeamId };

function otherTeam(team: TeamId): TeamId {
  return team === "A" ? "B" : "A";
}

/**
 * Move `pid` to the other team, swapping with a member of the target team when
 * it is already full (tap/keyboard alternative, Req 21.6).
 */
export function swapAssignment(
  players: readonly PlayerView[],
  pid: string,
): Record<string, TeamId> | null {
  const player = players.find((p) => p.id === pid);
  if (!player?.team) return null;
  const from = player.team;
  const to = otherTeam(from);
  const targetTeam = players.filter((p) => p.team === to);
  const assignment: Record<string, TeamId> = { [pid]: to };
  if (targetTeam.length >= TEAM_CAPACITY) {
    // Swap: bump one target-team member back to the vacated team.
    assignment[targetTeam[0].id] = from;
  }
  return assignment;
}

/**
 * Resolve a drag-and-drop: onto a player in the other team swaps the two
 * (Req 21.3); onto an empty seat in the other team moves the player (Req 21.4);
 * anything else is not a valid target (Req 21.5).
 */
export function dropAssignment(
  players: readonly PlayerView[],
  draggedId: string,
  target: TeamDropTarget | null,
): Record<string, TeamId> | null {
  const dragged = players.find((p) => p.id === draggedId);
  if (!dragged?.team || !target) return null;

  if (target.kind === "player") {
    const other = players.find((p) => p.id === target.id);
    if (!other?.team || other.team === dragged.team) return null;
    return { [dragged.id]: other.team, [other.id]: dragged.team };
  }

  if (target.team === dragged.team) return null;
  const seated = players.filter((p) => p.team === target.team).length;
  if (seated >= TEAM_CAPACITY) return null;
  return { [dragged.id]: target.team };
}
