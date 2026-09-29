/**
 * Grace-period auto-skip + auto-pause/auto-resume (Task 5.4).
 *
 * `enforceGrace` is a CALLABLE the connected clients invoke; the SERVER then
 * validates everything against the recorded `players/{uid}.lastSeen` — client-
 * reported presence is never trusted for a skip/pause decision (steering
 * `firestore-data.md`; design.md "the server compares `now − lastSeen` against
 * the 60s Grace_Period before performing any skip"). The design explicitly
 * permits "an on-action check inside the callable function" and "the remaining
 * players' apps request it and the server checks", which is exactly this.
 *
 * One Firestore transaction performs, in order:
 *
 *   1. AUTO-RESUME (Req 25.12): if the game is `auto_paused` and the auto-pause
 *      predicate no longer holds, return to `active`.
 *   2. AUTO-PAUSE (Req 15.7, 25.10): if not paused and the predicate holds
 *      (<2 connected, or a whole team offline in Team mode) → `auto_paused`.
 *      A player is treated as disconnected when their `lastSeen` is older than
 *      the Grace_Period OR their `connectionState` is not `connected` — the
 *      server derives liveness, not the client.
 *   3. GRACE SKIP (Req 15.3, 15.5, 25.8): while `active`, if the active seat's
 *      player is disconnected, skip their turn once the 60s window has elapsed
 *      (drawing any pending penalty first, Req 15.3), and skip any subsequent
 *      disconnected seats IMMEDIATELY (Req 15.5). While paused, the countdown is
 *      not enforced (Req 25.6 / design "skip only when elapsed and not paused").
 *
 * The draw pile stays in the server-only `private/deck` (Req 23.2). The pure
 * engine is untouched — this is server orchestration over engine primitives
 * (`advanceActive`, `resolveSkip`) + a deck draw the server already owns.
 */
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
    actionsRef,
    db,
    deckRef,
    handRef,
    playerRef,
    playersRef,
    roomRef,
    stateRef,
    Timestamp,
} from "./admin";
import type { Card, ConnectionSnapshot, GameState } from "./engine";
import { advanceActive, shouldAutoPause, shuffle } from "./engine";
import { hydrateState } from "./mapping";
import type { DeckDoc, HandDoc, PlayerDoc, StateDoc } from "./model";
import { createCsprng } from "./rng";

/** The disconnect Grace_Period in milliseconds (Req 15.3, 60 seconds). */
export const GRACE_PERIOD_MS = 60_000;

interface Seated {
  id: string;
  doc: PlayerDoc;
}

function seatedSorted(players: Seated[]): Seated[] {
  return players
    .filter((p) => p.doc.seatIndex !== null)
    .sort((a, b) => (a.doc.seatIndex as number) - (b.doc.seatIndex as number));
}

/** Server-derived liveness: not `connected`, or `lastSeen` past the grace window. */
function isDisconnected(p: PlayerDoc, nowMs: number): boolean {
  if (p.hasLeft) return true;
  if (p.connectionState !== "connected") return true;
  const lastSeenMs = p.lastSeen ? p.lastSeen.toMillis() : 0;
  return nowMs - lastSeenMs > GRACE_PERIOD_MS;
}

/** ms the active player's `lastSeen` is stale (0 if fresh / connected). */
function staleMs(p: PlayerDoc, nowMs: number): number {
  const lastSeenMs = p.lastSeen ? p.lastSeen.toMillis() : 0;
  return nowMs - lastSeenMs;
}

/** Build auto-pause connection snapshots from server-derived liveness. */
function connectionSnapshots(seats: Seated[], nowMs: number): ConnectionSnapshot[] {
  return seats.map((p) => {
    const snap: { playerId: string; team?: "A" | "B"; connection: "connected" | "disconnected" | "left" } = {
      playerId: p.id,
      connection: p.doc.hasLeft
        ? "left"
        : isDisconnected(p.doc, nowMs)
          ? "disconnected"
          : "connected",
    };
    if (p.doc.team !== null) snap.team = p.doc.team;
    return snap;
  });
}

/** Draw `count` cards off the server-only deck, reshuffling discards if empty. */
function drawFromDeck(
  drawPile: Card[],
  discardPile: Card[],
  count: number,
  rng: () => number,
): { drawn: Card[]; drawPile: Card[]; discardPile: Card[] } {
  let pile = drawPile.slice();
  let discard = discardPile.slice();
  const drawn: Card[] = [];
  for (let i = 0; i < count; i++) {
    if (pile.length === 0) {
      if (discard.length < 2) break; // only the top remains; cannot replenish.
      const top = discard[discard.length - 1];
      pile = shuffle(discard.slice(0, -1), rng);
      discard = [top];
    }
    drawn.push(pile[0]);
    pile = pile.slice(1);
  }
  return { drawn, drawPile: pile, discardPile: discard };
}

function logAction(
  tx: FirebaseFirestore.Transaction,
  roomId: string,
  playerId: string,
  result: string,
  basedOnVersion: number,
) {
  tx.set(actionsRef(roomId).doc(), {
    playerId,
    type: "leave", // reuse the closest lifecycle type for the audit log
    basedOnVersion,
    result,
    createdAt: FieldValue.serverTimestamp() as unknown as Timestamp,
  });
}

/** Result surfaced to the caller so tests/UI can assert what the server did. */
export interface GraceResult {
  ok: true;
  /** What the server did this call. */
  action: "none" | "auto_pause" | "auto_resume" | "skip";
  version: number;
  /** New active seat after a skip (for assertions). */
  activeSeat?: number;
}

export const enforceGrace = onCall(async (request): Promise<GraceResult> => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
  const roomId = String(request.data?.roomId ?? "").trim();
  if (!roomId) throw new HttpsError("invalid-argument", "roomId is required.");

  return db.runTransaction(async (tx): Promise<GraceResult> => {
    const roomSnap = await tx.get(roomRef(roomId));
    if (!roomSnap.exists) throw new HttpsError("not-found", "Room not found.");
    const room = roomSnap.data()!;

    const stateSnap = await tx.get(stateRef(roomId));
    if (!stateSnap.exists) throw new HttpsError("not-found", "No active game.");
    const state = stateSnap.data() as StateDoc;

    // Caller must be a member of the room.
    const playersSnap = await tx.get(playersRef(roomId));
    const players: Seated[] = playersSnap.docs.map((d) => ({
      id: d.id,
      doc: d.data() as PlayerDoc,
    }));
    if (!players.some((p) => p.id === uid)) {
      throw new HttpsError("permission-denied", "Not a member of this room.");
    }

    if (state.phase === "ended") {
      return { ok: true, action: "none", version: state.version };
    }

    const nowMs = Timestamp.now().toMillis();
    const seats = seatedSorted(players);
    const snapshots = connectionSnapshots(seats, nowMs);
    const autoPauseHolds = shouldAutoPause(room.gameMode, snapshots);

    // 1. AUTO-RESUME (Req 25.12): auto_paused and the condition cleared.
    if (state.phase === "auto_paused") {
      if (!autoPauseHolds) {
        const newVersion = state.version + 1;
        tx.update(stateRef(roomId), {
          phase: "active",
          pausedBy: null,
          pausedAt: null,
          version: newVersion,
        });
        logAction(tx, roomId, uid, "accepted:auto_resume", state.version);
        return { ok: true, action: "auto_resume", version: newVersion };
      }
      return { ok: true, action: "none", version: state.version };
    }

    // A manual pause stops the grace countdown entirely (Req 25.6).
    if (state.phase === "paused") {
      return { ok: true, action: "none", version: state.version };
    }

    // 2. AUTO-PAUSE (Req 15.7, 25.10): predicate holds while not paused.
    if (autoPauseHolds) {
      const newVersion = state.version + 1;
      tx.update(stateRef(roomId), {
        phase: "auto_paused",
        pausedBy: null,
        pausedAt: Timestamp.now(),
        version: newVersion,
      });
      logAction(tx, roomId, uid, "accepted:auto_pause", state.version);
      return { ok: true, action: "auto_pause", version: newVersion };
    }

    // 3. GRACE SKIP (Req 15.3, 15.5). Only meaningful in a play phase; a
    //    wild_pending / drew_decision belongs to a connected active player by
    //    construction (they just acted), so only `active` needs the check.
    if (state.phase !== "active") {
      return { ok: true, action: "none", version: state.version };
    }

    const activeSeated = seats[state.activeSeat];
    if (!activeSeated || !isDisconnected(activeSeated.doc, nowMs)) {
      return { ok: true, action: "none", version: state.version };
    }

    // The active player's FIRST skipped turn requires the full 60s to elapse
    // (Req 15.3). A player already disconnected past the window is skipped; and
    // subsequent turns are skipped immediately (Req 15.5) — which is naturally
    // satisfied because `lastSeen` keeps aging, so the window is still elapsed.
    if (staleMs(activeSeated.doc, nowMs) <= GRACE_PERIOD_MS) {
      // Still within the grace window and connectionState-driven disconnect
      // without a stale lastSeen: wait (the countdown ring is still draining).
      if (activeSeated.doc.connectionState === "connected") {
        return { ok: true, action: "none", version: state.version };
      }
    }

    // Read deck + hands to draw any pending penalty for the skipped player.
    const deckSnap = await tx.get(deckRef(roomId));
    const deck = (deckSnap.data() as DeckDoc | undefined) ?? { drawPile: [] };

    const handSnaps = await Promise.all(
      seats.map((p) => tx.get(handRef(roomId, p.id))),
    );
    const handsById = new Map<string, HandDoc>();
    handSnaps.forEach((snap) => {
      handsById.set(snap.id, (snap.data() as HandDoc) ?? { cards: [], cardCount: 0 });
    });

    // Reconstruct the engine state so we can advance the turn with correct
    // reverse/skip-free advancement over occupied seats.
    const seatedForEngine = seats.map((p) => ({ playerId: p.id, doc: p.doc }));
    const engine: GameState = hydrateState(
      room.gameMode,
      state,
      seatedForEngine,
      handsById,
      deck,
    );

    const rng = createCsprng();
    let drawPile = deck.drawPile.slice();
    let discardPile = state.discardPile.slice();

    // Draw the pending penalty into the skipped (active) player's hand first
    // (Req 15.3 "any pending penalty is drawn").
    let updatedActiveHand: Card[] | null = null;
    if (state.penaltyCount > 0) {
      const res = drawFromDeck(drawPile, discardPile, state.penaltyCount, rng);
      drawPile = res.drawPile;
      discardPile = res.discardPile;
      const current = handsById.get(activeSeated.id)?.cards ?? [];
      updatedActiveHand = [...current, ...res.drawn];
    }

    // Advance past the disconnected active player, and continue skipping any
    // further seats that are also disconnected (Req 15.5, immediate).
    let nextSeat = advanceActive({ ...engine, activeSeat: state.activeSeat });
    let guard = seats.length;
    while (guard-- > 0 && isDisconnected(seats[nextSeat].doc, nowMs)) {
      nextSeat = advanceActive({ ...engine, activeSeat: nextSeat });
    }
    // If we looped all the way back to the (still disconnected) active seat,
    // everyone is offline — auto-pause would have caught it above; leave as-is.

    const newVersion = state.version + 1;

    // Persist: cleared penalty, advanced seat, reset per-turn flag.
    tx.update(stateRef(roomId), {
      activeSeat: nextSeat,
      penaltyCount: 0,
      pendingPenaltyKind: null,
      drewThisTurn: false,
      discardPile,
      version: newVersion,
    });
    tx.set(deckRef(roomId), { drawPile } satisfies DeckDoc);
    if (updatedActiveHand) {
      tx.set(handRef(roomId, activeSeated.id), {
        cards: updatedActiveHand,
        cardCount: updatedActiveHand.length,
      } satisfies HandDoc);
      // Mirror the public count for opponent badges (Req 13.5).
      tx.update(playerRef(roomId, activeSeated.id), {
        cardCount: updatedActiveHand.length,
      });
    }
    tx.update(roomRef(roomId), { lastActivityAt: Timestamp.now() });
    logAction(tx, roomId, activeSeated.id, "accepted:grace_skip", state.version);

    return { ok: true, action: "skip", version: newVersion, activeSeat: nextSeat };
  });
});
