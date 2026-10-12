/**
 * Shared action harness (Task 4.1) — the single server-authoritative path that
 * every engine-driven action (`playCard`, `chooseColor`, `drawOne`, `keep`,
 * `callLast`) flows through.
 *
 * It runs ONE Firestore transaction that:
 *   1. reads `state/current`, the room, the seated players, all hand docs, and
 *      the server-only `private/deck`;
 *   2. rejects (state unchanged) when the game is paused/ended, when
 *      `basedOnVersion != state.version` (stale, Req 14.5), or when the caller
 *      is not the active player (Req 6.9/14.5);
 *   3. hydrates the engine `GameState`, applies the pure engine transition
 *      (rejections come back as values, never thrown), and on success
 *   4. increments `version`, and WRITES `state/current` + changed `hands` +
 *      `private/deck` inside the same transaction BEFORE the callable returns
 *      accept (persist-before-confirm, Req 14.4); then appends an `actions` log
 *      entry.
 *
 * Deck secrecy (Req 23.2): the shuffled draw order is written only to
 * `private/deck`; `state/current` never contains it.
 */
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
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
import type { Action, EngineContext } from "./engine";
import { reducer } from "./engine";
import {
    deckDocFrom,
    handDocForSeat,
    hydrateState,
    seatsFromPlayers,
    stateDocFieldsFrom,
    type SeatedPlayer,
} from "./mapping";
import type { ActionType, HandDoc, PlayerDoc } from "./model";
import { createCsprng } from "./rng";

/** Structured result returned to the caller (never throws for rule rejections). */
export type ActionResult =
  | { ok: true; version: number }
  | { ok: false; reason: string };

/** Build the engine `Action` from the caller uid; returned reason on bad input. */
export type ActionBuilder = (playerId: string) => Action;

/** Map an engine `Action.type` to the persisted `actions` log type. */
function logType(action: Action): ActionType {
  switch (action.type) {
    case "play":
      return "play";
    case "choose_color":
      return "choose_color";
    case "draw":
      return "draw";
    case "keep":
      return "keep";
    case "call_last":
      return "call_last";
  }
}

/**
 * Run a single engine action through the versioned transaction. `roomId` and
 * `basedOnVersion` come from the request; `uid` is the authenticated caller
 * (`context.auth.uid` == Player_ID).
 */
export async function runAction(
  roomId: string,
  uid: string,
  basedOnVersion: number,
  buildAction: ActionBuilder,
): Promise<ActionResult> {
  const result = await db.runTransaction(async (tx): Promise<ActionResult> => {
    const roomSnap = await tx.get(roomRef(roomId));
    if (!roomSnap.exists) {
      return { ok: false, reason: "room_not_found" };
    }
    const room = roomSnap.data()!;

    const stateSnap = await tx.get(stateRef(roomId));
    if (!stateSnap.exists) {
      return { ok: false, reason: "no_active_game" };
    }
    const state = stateSnap.data()!;

    // Paused / auto-paused / ended games reject every engine action (Req 25.6).
    if (state.phase === "paused" || state.phase === "auto_paused") {
      return { ok: false, reason: "paused" };
    }
    if (state.phase === "ended") {
      return { ok: false, reason: "game_ended" };
    }

    // Optimistic concurrency: a stale action rejects, state unchanged (Req 14.5).
    if (basedOnVersion !== state.version) {
      return { ok: false, reason: "stale_version" };
    }

    // Read seated players (for the engine seat order) and their hands + deck.
    const playersSnap = await tx.get(playersRef(roomId));
    const seated: SeatedPlayer[] = playersSnap.docs
      .map((d) => ({ playerId: d.id, doc: d.data() as PlayerDoc }))
      .filter((p) => p.doc.seatIndex !== null);

    const seats = seatsFromPlayers(seated);

    // Non-active-player actions reject with state unchanged (Req 6.9/14.5).
    if (seats.length === 0 || seats[state.activeSeat]?.playerId !== uid) {
      // Still validate the caller is a seated member before deciding.
      const isSeated = seated.some((p) => p.playerId === uid);
      if (!isSeated) {
        return { ok: false, reason: "not_in_game" };
      }
      return { ok: false, reason: "not_active" };
    }

    const deckSnap = await tx.get(deckRef(roomId));
    if (!deckSnap.exists) {
      return { ok: false, reason: "no_active_game" };
    }
    const deck = deckSnap.data()!;

    const handSnaps = await Promise.all(
      seated.map((p) => tx.get(handRef(roomId, p.playerId))),
    );
    const handsBySeat = new Map<string, HandDoc>();
    for (const snap of handSnaps) {
      handsBySeat.set(snap.id, (snap.data() as HandDoc) ?? { cards: [], cardCount: 0 });
    }

    const before = hydrateState(room.gameMode, state, seated, handsBySeat, deck);

    const action = buildAction(uid);
    const ctx: EngineContext = { rng: createCsprng() };
    const engineResult = reducer(before, action, ctx);

    if (!engineResult.ok) {
      // Expected rule violation: reject as a value, state untouched.
      return { ok: false, reason: engineResult.reason };
    }

    const next = engineResult.state;
    const newVersion = state.version + 1;

    // ---- WRITE inside the transaction (persist-before-confirm, Req 14.4) ----

    // Public state (never the draw pile — Req 23.2). Preserve pause fields
    // (null while active) and clear any stale pendingChoice on a normal action.
    tx.set(stateRef(roomId), {
      ...stateDocFieldsFrom(next),
      version: newVersion,
      pausedBy: null,
      pausedAt: null,
      pendingChoice: pendingChoiceFor(next),
    });

    // Server-only draw order.
    tx.set(deckRef(roomId), deckDocFrom(next));

    // Hands: write every seat whose cards changed (draw/penalty/reshuffle can
    // touch multiple seats). Comparing by reference is enough — the engine
    // returns new arrays only for changed hands. Mirror the public card count
    // onto the player doc for opponent badges (Req 13.5).
    next.seats.forEach((seat, seatIndex) => {
      if (before.hands[seatIndex] !== next.hands[seatIndex]) {
        tx.set(handRef(roomId, seat.playerId), handDocForSeat(next, seatIndex));
        tx.update(playerRef(roomId, seat.playerId), {
          cardCount: next.hands[seatIndex].length,
        });
      }
    });

    // Reflect denormalized card counts onto player docs is not required; badges
    // read from hand docs. Mark room activity + ended phase transition.
    if (next.phase === "ended") {
      tx.update(roomRef(roomId), {
        phase: "ended",
        lastActivityAt: Timestamp.now(),
      });
    } else {
      tx.update(roomRef(roomId), { lastActivityAt: Timestamp.now() });
    }

    // Append the accepted action to the audit log.
    tx.set(actionsRef(roomId).doc(), {
      playerId: uid,
      type: logType(action),
      basedOnVersion,
      result: "accepted",
      createdAt: FieldValue.serverTimestamp() as unknown as Timestamp,
    });

    return { ok: true, version: newVersion };
  });

  // Log rejects too (best-effort, outside the transaction to keep it atomic).
  if (!result.ok) {
    await actionsRef(roomId)
      .doc()
      .set({
        playerId: uid,
        type: logType(buildAction(uid)),
        basedOnVersion,
        result: `rejected:${result.reason}`,
        createdAt: FieldValue.serverTimestamp() as unknown as Timestamp,
      })
      .catch(() => undefined);
  }

  return result;
}

/**
 * Re-derive the `pendingChoice` that must survive a pause/resume (Req 25.14):
 * a wild awaiting its color, or a drawn playable card awaiting play/keep.
 */
function pendingChoiceFor(next: import("./engine").GameState) {
  if (next.phase === "wild_pending") {
    return { kind: "wild_color" as const, seatIndex: next.activeSeat };
  }
  if (next.phase === "drew_decision") {
    const hand = next.hands[next.activeSeat];
    const drawn = hand[hand.length - 1];
    const choice: { kind: "play_keep"; seatIndex: number; cardId?: string } = {
      kind: "play_keep",
      seatIndex: next.activeSeat,
    };
    if (drawn) {
      choice.cardId = drawn.id;
    }
    return choice;
  }
  return null;
}

/** Guard: authenticated caller uid, else an unauthenticated HttpsError. */
export function requireAuth(auth: { uid: string } | undefined): string {
  if (!auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  return auth.uid;
}
