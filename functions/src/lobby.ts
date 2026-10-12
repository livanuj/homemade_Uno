/**
 * Lobby mutation callables (Task 9.2): `setMode` and `setTeams`.
 *
 * The lobby is a shared, real-time surface: the HOST chooses the game mode
 * (Normal / 2v2) and, in 2v2, arranges who is on Team A vs. Team B by
 * dragging / tapping player rows. Those are the only pre-game mutations the
 * client can request beyond create/join.
 *
 * Security Rules deny ALL direct client writes to `rooms` and `players`
 * (except a player's own presence fields), so — exactly like every other game
 * mutation — team/mode changes MUST flow through a Cloud Function running with
 * the Admin SDK, which bypasses the rules. No rule is weakened.
 *
 * Both callables are:
 *   - HOST-ONLY: a non-host request is rejected `permission-denied` (Req 4.13 /
 *     21.5). The client also hides the controls for guests, but the server is
 *     the authority.
 *   - LOBBY-ONLY: rejected once the game has started (`phase !== "lobby"`).
 *
 * `setMode` (Req 4.6): flip `rooms/{roomId}.gameMode` between `normal` and
 * `team`. Switching INTO 2v2 seeds a deterministic join-order team fill
 * (alternating A/B by join order) so partners are pre-arranged (Req 4.10);
 * switching to Normal clears every `team`. 2v2 is only selectable with ≤4
 * players (Req 4.9) — the server enforces the ceiling and refuses otherwise.
 *
 * `setTeams` (Req 21.2–21.5): persist an explicit A/B assignment for a set of
 * players (a drag swap/move, or the tap/keyboard alternative). Validates the
 * room is in Team mode, that only known members are addressed, and that the
 * resulting split never exceeds two per team — an invalid drop is rejected so
 * the client returns the row to its origin (Req 21.4).
 */
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { db, playerRef, playersRef, roomRef, Timestamp } from "./admin";
import type { GameMode, PlayerDoc, Team } from "./model";

/** 2v2 is only offered while the room has at most 4 players (Req 4.9). */
const TEAM_MAX_PLAYERS = 4;
/** Each 2v2 team seats exactly two players. */
const TEAM_CAPACITY = 2;

function requireAuthUid(auth: { uid: string } | undefined): string {
  if (!auth) throw new HttpsError("unauthenticated", "Sign in required.");
  return auth.uid;
}

/** Alternate teams by ascending join order: even → A, odd → B (Req 4.10). */
function seedTeamsByJoinOrder(
  players: { id: string; doc: PlayerDoc }[],
): Map<string, Team> {
  const ordered = [...players].sort((a, b) => a.doc.joinOrder - b.doc.joinOrder);
  const out = new Map<string, Team>();
  ordered.forEach((p, index) => out.set(p.id, index % 2 === 0 ? "A" : "B"));
  return out;
}

export const setMode = onCall(async (request) => {
  const uid = requireAuthUid(request.auth);
  const roomId = String(request.data?.roomId ?? "").trim();
  if (!roomId) throw new HttpsError("invalid-argument", "roomId is required.");
  const mode = request.data?.mode as GameMode;
  if (mode !== "normal" && mode !== "team") {
    throw new HttpsError("invalid-argument", "mode must be 'normal' or 'team'.");
  }

  return db.runTransaction(async (tx) => {
    const roomSnap = await tx.get(roomRef(roomId));
    if (!roomSnap.exists) throw new HttpsError("not-found", "Room not found.");
    const room = roomSnap.data()!;
    if (room.hostPlayerId !== uid) {
      throw new HttpsError("permission-denied", "Only the host can change the mode.");
    }
    if (room.phase !== "lobby") {
      throw new HttpsError("failed-precondition", "The game has already started.");
    }

    const playersSnap = await tx.get(playersRef(roomId));
    const players = playersSnap.docs
      .map((d) => ({ id: d.id, doc: d.data() as PlayerDoc }))
      .filter((p) => !p.doc.hasLeft);

    if (mode === "team") {
      // 2v2 is only selectable with ≤4 players (Req 4.9).
      if (players.length > TEAM_MAX_PLAYERS) {
        return { ok: false, reason: "too_many_players" };
      }
      // Seed a join-order team fill so partners are pre-arranged (Req 4.10).
      const seeded = seedTeamsByJoinOrder(players);
      for (const p of players) {
        tx.update(playerRef(roomId, p.id), { team: seeded.get(p.id) ?? null });
      }
    } else {
      // Switching to Normal clears every team assignment.
      for (const p of players) {
        tx.update(playerRef(roomId, p.id), { team: null });
      }
    }

    tx.update(roomRef(roomId), {
      gameMode: mode,
      lastActivityAt: Timestamp.now(),
    });
    return { ok: true, mode };
  });
});

export const setTeams = onCall(async (request) => {
  const uid = requireAuthUid(request.auth);
  const roomId = String(request.data?.roomId ?? "").trim();
  if (!roomId) throw new HttpsError("invalid-argument", "roomId is required.");

  // `assignments` is a map of playerId → "A" | "B" describing the new split.
  const raw = request.data?.assignments;
  if (typeof raw !== "object" || raw === null) {
    throw new HttpsError("invalid-argument", "assignments is required.");
  }
  const assignments = raw as Record<string, unknown>;

  return db.runTransaction(async (tx) => {
    const roomSnap = await tx.get(roomRef(roomId));
    if (!roomSnap.exists) throw new HttpsError("not-found", "Room not found.");
    const room = roomSnap.data()!;
    if (room.hostPlayerId !== uid) {
      throw new HttpsError("permission-denied", "Only the host can change teams.");
    }
    if (room.phase !== "lobby") {
      throw new HttpsError("failed-precondition", "The game has already started.");
    }
    if (room.gameMode !== "team") {
      return { ok: false, reason: "not_team_mode" };
    }

    const playersSnap = await tx.get(playersRef(roomId));
    const players = playersSnap.docs
      .map((d) => ({ id: d.id, doc: d.data() as PlayerDoc }))
      .filter((p) => !p.doc.hasLeft);
    const byId = new Map(players.map((p) => [p.id, p] as const));

    // Build the resulting team for every current member: the assignment when
    // provided, else the player's existing team.
    const resolved = new Map<string, Team>();
    for (const p of players) {
      const requested = assignments[p.id];
      if (requested === undefined) {
        if (p.doc.team === "A" || p.doc.team === "B") resolved.set(p.id, p.doc.team);
        continue;
      }
      if (requested !== "A" && requested !== "B") {
        throw new HttpsError("invalid-argument", "team must be 'A' or 'B'.");
      }
      if (!byId.has(p.id)) {
        throw new HttpsError("invalid-argument", "unknown player in assignments.");
      }
      resolved.set(p.id, requested);
    }
    // Reject assignments naming a non-member.
    for (const id of Object.keys(assignments)) {
      if (!byId.has(id)) {
        throw new HttpsError("invalid-argument", "unknown player in assignments.");
      }
    }

    // Never allow a team to exceed two players — an invalid drop is rejected so
    // the client can return the dragged row to its origin (Req 21.4).
    let aCount = 0;
    let bCount = 0;
    for (const team of resolved.values()) {
      if (team === "A") aCount++;
      else bCount++;
    }
    if (aCount > TEAM_CAPACITY || bCount > TEAM_CAPACITY) {
      return { ok: false, reason: "team_full" };
    }

    for (const [id, team] of resolved) {
      const current = byId.get(id)!.doc.team;
      if (current !== team) tx.update(playerRef(roomId, id), { team });
    }
    tx.update(roomRef(roomId), { lastActivityAt: Timestamp.now() });
    return { ok: true };
  });
});
