import { isWildCard, shuffle } from "./deck";
import {
    discardTop,
    isLegalPlay,
    penaltyKindOf,
    penaltyValue,
} from "./rules";
import { advanceActive, resolveReverse, resolveSkip } from "./turn";
import type {
    Action,
    Card,
    EngineContext,
    GameState,
    RejectionReason,
    Result,
    Suit,
    Winner
} from "./types";

/** Cards a player draws for ending a turn on one card without calling. */
const LAST_CARD_PENALTY = 2;

/**
 * Apply an action to the authoritative state. Pure: returns a new state on
 * success or a rejection value; never mutates the input and never throws for
 * expected rule violations. See design.md "Game Engine / Rules".
 */
export function reducer(state: GameState, action: Action, ctx: EngineContext): Result {
  if (state.phase === "ended") {
    return reject("game_ended");
  }

  switch (action.type) {
    case "play":
      return handlePlay(state, action.playerId, action.cardId, ctx);
    case "choose_color":
      return handleChooseColor(state, action.playerId, action.color, ctx);
    case "draw":
      return handleDraw(state, action.playerId, ctx);
    case "keep":
      return handleKeep(state, action.playerId, ctx);
    case "call_last":
      return handleCallLast(state, action.playerId);
  }
}

// --- play ------------------------------------------------------------------

function handlePlay(state: GameState, playerId: string, cardId: string, ctx: EngineContext): Result {
  // Play is only valid in the `active` phase (Req 8.5, 10.2 forbid it while a
  // wild is pending or a drew-decision is open).
  if (state.phase !== "active") {
    return reject("wrong_phase");
  }
  if (!isActive(state, playerId)) {
    return reject("not_active");
  }

  const hand = state.hands[state.activeSeat];
  const cardIndex = hand.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) {
    return reject("card_not_in_hand");
  }
  const card = hand[cardIndex];

  if (!isLegalPlay(card, state)) {
    // Distinguish an illegal stack (penalty pending) from a plain illegal card
    // so the client can surface the right signal. Either way state is unchanged.
    return reject(state.penaltyCount > 0 ? "illegal_stack" : "illegal_card");
  }

  // Move the card to the discard top; remove it from the hand.
  const newHand = removeAt(hand, cardIndex);
  const hands = replaceHand(state.hands, state.activeSeat, newHand);
  const discardPile = [...state.discardPile, card];

  // Penalty cards accumulate and target the next player (Req 9.1, 9.2).
  const addedPenalty = penaltyValue(card);
  const penaltyCount = state.penaltyCount + addedPenalty;
  const pendingPenaltyKind = addedPenalty > 0 ? penaltyKindOf(card) : state.pendingPenaltyKind;

  const afterPlay: GameState = {
    ...state,
    hands,
    discardPile,
    penaltyCount,
    pendingPenaltyKind,
  };

  if (isWildCard(card)) {
    // A wild (plain or +4) requires a color choice before the turn resolves —
    // including a winning wild (Req 8.5, 8.6). Keep the same active player.
    return ok({ ...afterPlay, phase: "wild_pending" });
  }

  // Non-wild: set the active color to the card's suit (Req 7.4) and resolve.
  const activeColor = card.suit as Suit;
  return ok(finalizeTurn({ ...afterPlay, activeColor }, card, ctx));
}

// --- choose_color ----------------------------------------------------------

function handleChooseColor(state: GameState, playerId: string, color: Suit, ctx: EngineContext): Result {
  if (state.phase !== "wild_pending") {
    return reject("wrong_phase");
  }
  if (!isActive(state, playerId)) {
    return reject("not_active");
  }
  // The chosen suit becomes the active color (Req 8.2, 9.6). Now the play that
  // was deferred at wild time resolves — including any win (Req 8.6).
  const withColor: GameState = { ...state, activeColor: color };
  const playedWild = discardTop(state);
  return ok(finalizeTurn(withColor, playedWild, ctx));
}

// --- draw ------------------------------------------------------------------

function handleDraw(state: GameState, playerId: string, ctx: EngineContext): Result {
  if (state.phase !== "active") {
    return reject("wrong_phase");
  }
  if (!isActive(state, playerId)) {
    return reject("not_active");
  }

  if (state.penaltyCount > 0) {
    // Non-stacking response to a pending penalty: draw the whole count, reset,
    // and advance (Req 9.4). No last-card penalty applies (the turn is spent
    // absorbing the penalty, and the hand only grows).
    return ok(resolvePenaltyDraw(state, ctx));
  }

  if (state.drewThisTurn) {
    // Only one draw per turn (Req 10.3).
    return reject("already_drew");
  }

  // Draw exactly one card, reshuffling if needed (Req 10.1, 10.7, 10.8).
  const drawn = drawCards(state, 1, ctx);
  if (drawn.cards.length === 0) {
    // Draw pile empty and only the discard top remains: complete the turn
    // without drawing and advance (Req 10.8).
    return ok(finalizeAfterNonPlay(drawn.state, ctx));
  }

  const card = drawn.cards[0];
  const hands = replaceHand(
    drawn.state.hands,
    drawn.state.activeSeat,
    [...drawn.state.hands[drawn.state.activeSeat], card],
  );
  const afterDraw: GameState = { ...drawn.state, hands, drewThisTurn: true };

  if (isLegalPlay(card, afterDraw)) {
    // Playable: offer play-or-keep (Req 10.2). Turn stays with this player.
    return ok({ ...afterDraw, phase: "drew_decision" });
  }
  // Not playable: keep it and advance (Req 10.5).
  return ok(finalizeAfterNonPlay(afterDraw, ctx));
}

// --- keep ------------------------------------------------------------------

function handleKeep(state: GameState, playerId: string, ctx: EngineContext): Result {
  if (state.phase !== "drew_decision") {
    return reject("wrong_phase");
  }
  if (!isActive(state, playerId)) {
    return reject("not_active");
  }
  // Keep the drawn card and end the turn (Req 10.4).
  return ok(finalizeAfterNonPlay(state, ctx));
}

// --- call_last -------------------------------------------------------------

function handleCallLast(state: GameState, playerId: string): Result {
  // Enabled only on the player's turn while holding exactly 2 cards (Req 11.1).
  if (state.phase !== "active" && state.phase !== "drew_decision") {
    return reject("wrong_phase");
  }
  if (!isActive(state, playerId)) {
    return reject("not_active");
  }
  if (state.hands[state.activeSeat].length !== 2) {
    return reject("not_two_cards");
  }
  return ok({ ...state, lastCardCalledSeat: state.activeSeat });
}

// --- shared turn resolution ------------------------------------------------

/**
 * Resolve a turn after a card has been fully committed (including any wild
 * color choice). Handles win detection, the forgot-to-call penalty, turn
 * advancement (with reverse/skip), penalty targeting, and flag hygiene.
 */
function finalizeTurn(state: GameState, playedCard: Card, ctx: EngineContext): GameState {
  const playedSeat = state.activeSeat;

  // Win: the acting player's hand is empty after a legal final play (Req 12).
  if (state.hands[playedSeat].length === 0) {
    return {
      ...state,
      phase: "ended",
      winner: winnerFor(state, playedSeat),
      penaltyCount: 0,
      pendingPenaltyKind: null,
    };
  }

  // Forgot-to-call penalty: the turn ends with the player on 1 card and no call
  // recorded this turn → they draw 2 (Req 11.3). This does not apply to the
  // winning case above (handled first) since a win empties the hand.
  let working = state;
  if (working.hands[playedSeat].length === 1 && working.lastCardCalledSeat !== playedSeat) {
    working = drawPenaltyForForgotCall(working, playedSeat, ctx);
  }

  // Advance the active player, applying reverse/skip semantics.
  working = advanceTurn(working, playedCard);

  // Reset per-turn flags and clear stale last-card calls (Req 11.4).
  return clearTurnFlags(working);
}

/**
 * Resolve advancement after a non-play turn end (a draw that was kept, an
 * unplayable draw, or a no-draw-empty-pile turn). No card was added to the
 * discard, so there is no reverse/skip to apply.
 */
function finalizeAfterNonPlay(state: GameState, ctx: EngineContext): GameState {
  const playedSeat = state.activeSeat;

  // Forgot-to-call penalty still applies if the turn ends on 1 card (Req 11.3).
  let working = state;
  if (working.hands[playedSeat].length === 1 && working.lastCardCalledSeat !== playedSeat) {
    working = drawPenaltyForForgotCall(working, playedSeat, ctx);
  }

  working = { ...working, activeSeat: advanceActive(working) };
  return clearTurnFlags(working);
}

/** Advance the active seat honoring reverse and skip (Req 6.1–6.5). */
function advanceTurn(state: GameState, playedCard: Card): GameState {
  if (playedCard.value === "reverse") {
    const { direction, activeSeat } = resolveReverse(state);
    return { ...state, direction, activeSeat };
  }
  if (playedCard.value === "skip") {
    return { ...state, activeSeat: resolveSkip(state) };
  }
  return { ...state, activeSeat: advanceActive(state) };
}

/**
 * Draw the pending penalty for the targeted (current active) player: move
 * `penaltyCount` cards, reset the count, and advance to the next seat (Req 9.4).
 */
function resolvePenaltyDraw(state: GameState, ctx: EngineContext): GameState {
  const drawn = drawCards(state, state.penaltyCount, ctx);
  const seat = drawn.state.activeSeat;
  const hands = replaceHand(drawn.state.hands, seat, [...drawn.state.hands[seat], ...drawn.cards]);
  const afterDraw: GameState = {
    ...drawn.state,
    hands,
    penaltyCount: 0,
    pendingPenaltyKind: null,
  };
  const advanced: GameState = { ...afterDraw, activeSeat: advanceActive(afterDraw) };
  return clearTurnFlags(advanced);
}

/** Apply the forgot-to-call +2 to a seat, drawing from the pile (Req 11.3). */
function drawPenaltyForForgotCall(state: GameState, seat: number, ctx: EngineContext): GameState {
  // Draw up to LAST_CARD_PENALTY; reshuffles if needed. The player keeps the
  // cards; this only grows the hand so it never triggers a win.
  const drawn = drawCards(state, LAST_CARD_PENALTY, ctx);
  const hands = replaceHand(drawn.state.hands, seat, [...drawn.state.hands[seat], ...drawn.cards]);
  return { ...drawn.state, hands };
}

/**
 * Reset per-turn flags for the newly active seat and enforce last-card flag
 * hygiene: any seat holding more than one card must not retain a call (Req 11.4).
 */
function clearTurnFlags(state: GameState): GameState {
  let lastCardCalledSeat = state.lastCardCalledSeat;
  if (lastCardCalledSeat !== null && state.hands[lastCardCalledSeat].length > 1) {
    lastCardCalledSeat = null;
  }
  return { ...state, phase: "active", drewThisTurn: false, lastCardCalledSeat };
}

// --- drawing / reshuffle ---------------------------------------------------

interface DrawResult {
  readonly state: GameState;
  readonly cards: readonly Card[];
}

/**
 * Draw up to `count` cards from the draw pile, reshuffling the discard pile
 * (except its top) into the draw pile when it empties and ≥2 discards exist
 * (Req 10.7). If the pile is exhausted and cannot be replenished, fewer than
 * `count` cards (possibly zero) are returned (Req 10.8).
 */
function drawCards(state: GameState, count: number, ctx: EngineContext): DrawResult {
  let drawPile = state.drawPile;
  let discardPile = state.discardPile;
  const cards: Card[] = [];

  for (let i = 0; i < count; i++) {
    if (drawPile.length === 0) {
      if (discardPile.length < 2) {
        break; // only the top remains; cannot replenish (Req 10.8).
      }
      const top = discardPile[discardPile.length - 1];
      const rest = discardPile.slice(0, -1);
      drawPile = shuffle(rest, ctx.rng);
      discardPile = [top];
    }
    cards.push(drawPile[0]);
    drawPile = drawPile.slice(1);
  }

  return { state: { ...state, drawPile, discardPile }, cards };
}

// --- helpers ---------------------------------------------------------------

function ok(state: GameState): Result {
  return { ok: true, state };
}

function reject(reason: RejectionReason): Result {
  return { ok: false, reason };
}

function isActive(state: GameState, playerId: string): boolean {
  return state.seats[state.activeSeat].playerId === playerId;
}

function winnerFor(state: GameState, seat: number): Winner {
  const s = state.seats[seat];
  if (state.mode === "team" && s.team) {
    return { kind: "team", team: s.team };
  }
  return { kind: "player", seat, playerId: s.playerId };
}

function removeAt<T>(arr: readonly T[], index: number): T[] {
  return [...arr.slice(0, index), ...arr.slice(index + 1)];
}

function replaceHand(
  hands: readonly (readonly Card[])[],
  seat: number,
  hand: readonly Card[],
): (readonly Card[])[] {
  const out = hands.slice();
  out[seat] = hand;
  return out;
}
