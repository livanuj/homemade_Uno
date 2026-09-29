/**
 * Store → view-model mappers (Task 9).
 *
 * These pure functions derive the read-only screen view-models
 * (`LobbyView` / `GameView` / `GameResultView` / `PausedView` + the in-game
 * overlay selection) FROM the authoritative realtime store
 * (`@/realtime/store`'s {@link RealtimeStore}) — the same shapes the Task 8
 * fixtures produced, now sourced from live Firestore `onSnapshot` data.
 *
 * They are the seam that lets the routes swap their `?state=` fixtures for live
 * data without changing a single screen component. Everything here is PURE and
 * SYNCHRONOUS (no firebase, no React, no I/O), so the whole derivation surface —
 * host vs. guest, start enablement, the 2v2 rules, wild/drew/paused/game-over
 * selection, and LAST CARD! enablement — is unit-testable by feeding a plain
 * store object (see `mappers.test.ts`). The routes and the emulator integration
 * test cover the live round-trips.
 *
 * The client-side `playable` flags and the "advisory" turn text are exactly
 * that — advisory. The SERVER is authoritative: an illegal tap is rejected by
 * the callable and the UI reverts (see `@/realtime/actions`). Highlighting a
 * card as playable never lets a client mutate the game.
 */
import type { CardValue, Suit } from "@/design/suits";
import type {
    Card,
    ConnectionState as DocConnectionState,
    PlayerDoc,
    StateDoc,
    Team
} from "@/firebase/types";
import type { RealtimeStore, StorePlayer } from "@/realtime/store";
import { inviteLinkForCode } from "./fixtures";
import type { OverlayId } from "./overlays";
import type {
    CardView,
    ConnectionState,
    Direction,
    GameMode,
    GameResultView,
    GameView,
    HandCardView,
    LobbyView,
    OpponentSeatView,
    PartnerSeatView,
    PausedView,
    PlayerView,
    ResultKind,
    ResultPlayerView,
    RoomPhase,
    RoomView,
    TeamId,
} from "./types";

// ---------------------------------------------------------------------------
// Small shared helpers.
// ---------------------------------------------------------------------------

/** The disconnect Grace_Period in seconds (mirrors the server, Req 15.3). */
export const GRACE_SECONDS = 60;

/** Map a Firestore connection state to the coarser view connection. */
function viewConnection(c: DocConnectionState): ConnectionState {
  return c === "connected" ? "online" : "offline";
}

/** Map a Firestore room phase → the view-model's room phase. */
function viewRoomPhase(state: StateDoc | null): RoomPhase {
  if (!state) return "lobby";
  switch (state.phase) {
    case "ended":
      return "ended";
    case "paused":
    case "auto_paused":
      return "paused";
    default:
      return "playing";
  }
}

/** A Card doc → the render `CardView` (identical shape; narrows readonly). */
function cardView(card: Card): CardView {
  return card.suit !== undefined
    ? { id: card.id, suit: card.suit, value: card.value as CardValue }
    : { id: card.id, value: card.value as CardValue };
}

/** The discard top and the card beneath it (for the −12° prev card). */
function discardTopPrev(state: StateDoc): { top: CardView; prev?: CardView } {
  const pile = state.discardPile;
  const top = cardView(pile[pile.length - 1]);
  if (pile.length >= 2) return { top, prev: cardView(pile[pile.length - 2]) };
  return { top };
}

/**
 * Whether a card would be a legal play right now given the public state — the
 * SAME logic as the engine's `isLegalPlay`, inlined so the mapper needs no
 * engine hydration. Advisory only (drives Highlight dimming); the server
 * re-validates every play.
 */
export function isCardPlayable(card: Card, state: StateDoc): boolean {
  const isWild = card.value === "wild" || card.value === "wild4";
  if (state.penaltyCount > 0) {
    // Asymmetric stacking (Req 9.3/9.5): +2 onto +2 only; wild4 onto +2 or +4.
    if (card.value === "+2") return state.pendingPenaltyKind === "two";
    if (card.value === "wild4") {
      return state.pendingPenaltyKind === "two" || state.pendingPenaltyKind === "four";
    }
    return false;
  }
  if (isWild) return true;
  const top = state.discardPile[state.discardPile.length - 1];
  return card.suit === state.activeColor || card.value === top.value;
}

/** Players sorted by join order — the canonical roster order. */
function byJoinOrder(players: readonly StorePlayer[]): StorePlayer[] {
  return [...players].filter((p) => !p.doc.hasLeft).sort(
    (a, b) => a.doc.joinOrder - b.doc.joinOrder,
  );
}

/** The seated player at a given seat index, or null. */
function playerAtSeat(players: readonly StorePlayer[], seat: number): StorePlayer | null {
  return players.find((p) => p.doc.seatIndex === seat) ?? null;
}

/** A store player + hand cardCount → the lobby/table `PlayerView`. */
function playerView(p: StorePlayer, hostId: string | null): PlayerView {
  const doc = p.doc;
  const base: PlayerView = {
    id: p.playerId,
    name: doc.displayName,
    joinOrder: doc.joinOrder,
    isHost: doc.isHost || p.playerId === hostId,
    connection: viewConnection(doc.connectionState),
  };
  if (doc.team) base.team = doc.team as TeamId;
  return base;
}

// ---------------------------------------------------------------------------
// Room view.
// ---------------------------------------------------------------------------

/** Build the `RoomView` (everything not tied to a single player). */
export function toRoomView(store: RealtimeStore): RoomView | null {
  const room = store.room;
  if (!room) return null;
  const hostId = room.hostPlayerId;
  const players = byJoinOrder(store.players).map((p) => {
    const pv = playerView(p, hostId);
    // Denormalized count for the menu's "cards left" list (Req 5.10). Opponent
    // table badges also read this via `opponentCardCount`.
    if (p.doc.cardCount !== undefined) pv.cardCount = p.doc.cardCount;
    return pv;
  });
  return {
    code: room.roomCode,
    inviteLink: inviteLinkForCode(room.roomCode),
    mode: room.gameMode as GameMode,
    phase: viewRoomPhase(store.state),
    roundNumber: room.roundNumber,
    players,
  };
}

// ---------------------------------------------------------------------------
// Lobby view (Task 9.1 / 9.2).
// ---------------------------------------------------------------------------

/** Derive the `LobbyView` the Lobby route renders from live data. */
export function toLobbyView(store: RealtimeStore): LobbyView | null {
  const room = toRoomView(store);
  if (!room || !store.playerId) return null;
  return { room, selfId: store.playerId };
}

/**
 * Whether the host may Start given the roster + mode (Req 4.7/4.8), plus the
 * exact caption to show. Mirrors the fixture-era `startCaption` but derived
 * from live counts + team split.
 */
export function startEnablement(room: RoomView): { caption: string; disabled: boolean } {
  const count = room.players.length;
  if (room.mode === "team") {
    if (count !== 4) {
      return {
        disabled: true,
        caption: `2v2 needs exactly 4 players. ${count} of 4 have joined.`,
      };
    }
    const a = room.players.filter((p) => p.team === "A").length;
    const b = room.players.filter((p) => p.team === "B").length;
    if (a !== 2 || b !== 2) {
      return { disabled: true, caption: "Each team needs exactly two players." };
    }
    return { disabled: false, caption: "Everyone is ready" };
  }
  if (count < 2) {
    return { disabled: true, caption: "Invite at least 1 more player to start" };
  }
  return { disabled: false, caption: "Everyone is ready" };
}

// ---------------------------------------------------------------------------
// Game-table view (Task 9.3 / 9.4).
// ---------------------------------------------------------------------------

/** Compose the advisory turn-pill text for the active state. */
function turnText(
  state: StateDoc,
  isYourTurn: boolean,
  activeName: string,
  activeColor: Suit,
): string {
  if (state.penaltyCount > 0) {
    const who = isYourTurn ? "You draw" : `${activeName} draws`;
    return `${who} ${state.penaltyCount} unless they can stack`;
  }
  if (isYourTurn) return `Your turn · match ${activeColor} or play a wild`;
  return `${activeName}'s turn · color is ${activeColor}`;
}

/**
 * Derive the `GameView` the table renders from the public state + the caller's
 * own hand (+ partner hand in 2v2). Returns null until enough has hydrated
 * (room + state + own hand).
 */
export function toGameView(store: RealtimeStore): GameView | null {
  const roomView = toRoomView(store);
  const state = store.state;
  const selfId = store.playerId;
  if (!roomView || !state || !selfId) return null;

  const isTeam = roomView.mode === "team";
  const seated = store.players.filter((p) => p.doc.seatIndex !== null);
  const me = seated.find((p) => p.playerId === selfId) ?? null;

  const activePlayer = playerAtSeat(seated, state.activeSeat);
  const activeSeatId = activePlayer?.playerId ?? selfId;
  const isYourTurn = activeSeatId === selfId;

  // Own hand → HandCardView with advisory playable flags (Req 7.5/7.6).
  const ownCards = store.ownHand?.cards ?? [];
  const pendingCardId = store.pendingAction?.cardId ?? null;
  const hand: HandCardView[] = ownCards.map((c) => {
    const view: HandCardView = {
      ...cardView(c),
      playable: isCardPlayable(c, state),
    };
    if (pendingCardId && c.id === pendingCardId) view.selected = true;
    return view;
  });

  // Partner (2v2 only): face-up hand from the partner hand doc.
  let partner: PartnerSeatView | undefined;
  if (isTeam && me?.doc.team) {
    const partnerPlayer = seated.find(
      (p) => p.playerId !== selfId && p.doc.team === me.doc.team,
    );
    if (partnerPlayer) {
      partner = {
        id: partnerPlayer.playerId,
        name: partnerPlayer.doc.displayName,
        team: partnerPlayer.doc.team as TeamId,
        connection: viewConnection(partnerPlayer.doc.connectionState),
        hand: (store.partnerHand?.cards ?? []).map(cardView),
      };
    }
  }

  // Opponents: everyone seated except self and the partner, in clockwise
  // seating order from the viewer (by seat index ascending after self).
  const partnerId = partner?.id;
  const opponents: OpponentSeatView[] = clockwiseFromSelf(seated, me?.doc.seatIndex ?? 0)
    .filter((p) => p.playerId !== selfId && p.playerId !== partnerId)
    .map((p) => {
      const seat: OpponentSeatView = {
        id: p.playerId,
        name: p.doc.displayName,
        cardCount: opponentCardCount(store, p.playerId),
        connection: viewConnection(p.doc.connectionState),
      };
      if (p.doc.team) seat.team = p.doc.team as TeamId;
      return seat;
    });

  const { top, prev } = discardTopPrev(state);
  const activeName = activePlayer?.doc.displayName ?? "Someone";

  const view: GameView = {
    room: roomView,
    selfId,
    selfName: me?.doc.displayName ?? "You",
    hand,
    opponents,
    discardTop: top,
    activeColor: state.activeColor as Suit,
    direction: state.direction as Direction,
    activeSeatId,
    turnText: turnText(state, isYourTurn, activeName, state.activeColor as Suit),
    canCallLastCard:
      isYourTurn &&
      state.phase === "active" &&
      hand.length === 2 &&
      state.lastCardCalledSeat !== state.activeSeat,
  };
  if (prev) view.discardPrev = prev;
  if (me?.doc.team) view.selfTeam = me.doc.team as TeamId;
  if (isTeam && partner) view.partner = partner;
  if (state.penaltyCount > 0) view.penaltyCount = state.penaltyCount;
  return view;
}

/**
 * The opponent's remaining card count for the seat badge (Req 13.5). A client
 * cannot read a non-partner hand doc (Security Rules), so the count comes from
 * the SERVER-denormalized `players/{id}.cardCount` — a public integer the
 * server mirrors on every hand change. Falls back to the readable own/partner
 * hand count, then to 0 if not yet dealt.
 */
function opponentCardCount(store: RealtimeStore, playerId: string): number {
  if (playerId === store.playerId) return store.ownHand?.cardCount ?? 0;
  const target = store.players.find((p) => p.playerId === playerId);
  if (target?.doc.cardCount !== undefined) return target.doc.cardCount;
  const me = store.players.find((p) => p.playerId === store.playerId);
  if (
    store.partnerHand?.cardCount !== undefined &&
    me?.doc.team &&
    target?.doc.team === me.doc.team
  ) {
    return store.partnerHand.cardCount;
  }
  return 0;
}

/** Seated players ordered clockwise starting after the viewer's seat. */
function clockwiseFromSelf(
  seated: readonly StorePlayer[],
  selfSeat: number,
): StorePlayer[] {
  const sorted = [...seated].sort(
    (a, b) => (a.doc.seatIndex ?? 0) - (b.doc.seatIndex ?? 0),
  );
  const n = sorted.length;
  const startIdx = sorted.findIndex((p) => p.doc.seatIndex === selfSeat);
  if (startIdx < 0) return sorted;
  const out: StorePlayer[] = [];
  for (let i = 1; i <= n; i++) out.push(sorted[(startIdx + i) % n]);
  return out;
}

// ---------------------------------------------------------------------------
// In-game overlay selection (Task 9.4 / 9.6).
// ---------------------------------------------------------------------------

/** A disconnected opponent whose turn it is, with the live grace countdown. */
export interface DisconnectSelection {
  playerId: string;
  name: string;
  secondsLeft: number;
  graceSeconds: number;
}

/**
 * Which in-game overlay (if any) the live state implies for THIS viewer, plus
 * the extra data the overlay needs. Menu / leave are user-driven (route-local
 * UI), so they are NOT selected here — this covers only the server-driven
 * overlays: the wild picker (your `wild_pending`), the drew sheet (your
 * `drew_decision`), and the disconnected table state.
 */
export function selectAutoOverlay(
  store: RealtimeStore,
  nowMs: number,
): { overlay: OverlayId | null; disconnect?: DisconnectSelection } {
  const state = store.state;
  const selfId = store.playerId;
  if (!state || !selfId) return { overlay: null };

  const seated = store.players.filter((p) => p.doc.seatIndex !== null);
  const active = playerAtSeat(seated, state.activeSeat);
  const isYourTurn = active?.playerId === selfId;

  // Your wild-color choice (Req 8.1/8.2) — re-shown after resume too via
  // pendingChoice.
  if (state.phase === "wild_pending" && isYourTurn) return { overlay: "wild" };

  // Your play/keep decision after drawing a playable card (Req 10.2).
  if (state.phase === "drew_decision" && isYourTurn) return { overlay: "drew" };

  // A disconnected opponent whose turn it is → the 06c table state with a
  // live countdown derived from lastSeen (Req 15.1/15.3/15.5).
  if (state.phase === "active" && active && active.playerId !== selfId) {
    const doc = active.doc;
    const disconnected =
      doc.connectionState !== "connected" ||
      graceSecondsLeft(doc, nowMs) < GRACE_SECONDS;
    if (disconnected && doc.connectionState !== "connected") {
      return {
        overlay: "disconnected",
        disconnect: {
          playerId: active.playerId,
          name: doc.displayName,
          secondsLeft: graceSecondsLeft(doc, nowMs),
          graceSeconds: GRACE_SECONDS,
        },
      };
    }
  }

  return { overlay: null };
}

/** Whole seconds left in the grace countdown, clamped to [0, GRACE_SECONDS]. */
export function graceSecondsLeft(doc: PlayerDoc, nowMs: number): number {
  const lastSeenMs = doc.lastSeen ? doc.lastSeen.toMillis() : nowMs;
  const elapsed = Math.max(0, nowMs - lastSeenMs);
  const left = GRACE_SECONDS - Math.floor(elapsed / 1000);
  return Math.max(0, Math.min(GRACE_SECONDS, left));
}

// ---------------------------------------------------------------------------
// Paused-overlay view (Task 9.6).
// ---------------------------------------------------------------------------

/** Format a paused-duration into the "Paused for m:ss" label. */
export function elapsedLabel(pausedAtMs: number | null, nowMs: number): string {
  if (pausedAtMs === null) return "Paused for 0:00";
  const total = Math.max(0, Math.floor((nowMs - pausedAtMs) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `Paused for ${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Derive the `PausedView` when the game is paused/auto-paused, else null. The
 * variant is chosen from WHO paused and WHO is offline:
 *  - `auto`    — the state is `auto_paused` (a whole team / <2 connected).
 *  - `waiting` — a manual pause while some player is offline (waiting for them).
 *  - `break`   — a manual pause with everyone connected (a plain break).
 */
export function toPausedView(store: RealtimeStore, nowMs: number): PausedView | null {
  const state = store.state;
  const room = store.room;
  if (!state || !room) return null;
  if (state.phase !== "paused" && state.phase !== "auto_paused") return null;

  const isTeam = room.gameMode === "team";
  const seated = store.players.filter((p) => p.doc.seatIndex !== null);
  const pausedByName =
    store.players.find((p) => p.playerId === state.pausedBy)?.doc.displayName ??
    "Someone";
  const offline = seated.filter((p) => p.doc.connectionState !== "connected");
  const first = offline[0];
  const pausedAtMs = state.pausedAt ? state.pausedAt.toMillis() : null;
  const label = elapsedLabel(pausedAtMs, nowMs);
  const tableState = isTeam ? "03" : "04";

  if (state.phase === "auto_paused") {
    const team = first?.doc.team as Team | null | undefined;
    const view: PausedView = {
      variant: "auto",
      title: team ? `Team ${team} lost connection` : "Waiting for players",
      body: team
        ? "The game paused by itself. It resumes when they come back."
        : "The game paused by itself because too few players are connected.",
      elapsedLabel: label,
      tableState,
    };
    if (first) view.offlineName = first.doc.displayName;
    if (team) view.offlineTeam = team as TeamId;
    return view;
  }

  // Manual pause: waiting for an offline player, or a plain break.
  if (first) {
    const view: PausedView = {
      variant: "waiting",
      title: `Waiting for ${first.doc.displayName}`,
      body: `${pausedByName} paused the game. It resumes by itself when ${first.doc.displayName} is back.`,
      elapsedLabel: label,
      offlineName: first.doc.displayName,
      primaryCaption: `${first.doc.displayName}'s turns will be skipped until they return`,
      tableState,
    };
    return view;
  }

  return {
    variant: "break",
    title: "Game paused",
    body: `${pausedByName} paused the game. Anyone can resume when everyone's ready.`,
    elapsedLabel: label,
    tableState,
  };
}

// ---------------------------------------------------------------------------
// Game-over view (Task 9.5).
// ---------------------------------------------------------------------------

/** Derive the `GameResultView` once the game has ended, else null. */
export function toResultView(store: RealtimeStore): GameResultView | null {
  const state = store.state;
  const room = store.room;
  const selfId = store.playerId;
  if (!state || !room || !selfId) return null;
  if (state.phase !== "ended") return null;

  const roomView = toRoomView(store);
  if (!roomView) return null;

  const isTeam = room.gameMode === "team";
  const mode: GameMode = isTeam ? "team" : "normal";
  const winner = state.winner;

  const seated = byJoinOrder(store.players);

  // Who went out (played the last card): the winning player in Normal, or in
  // Team the seat that emptied — derived from the winner descriptor + counts.
  const isWinningSide = (p: StorePlayer): boolean => {
    if (!winner) return false;
    if (winner.kind === "player") return p.playerId === winner.playerId;
    return (p.doc.team as Team | null) === winner.team;
  };

  const rows: ResultPlayerView[] = seated.map((p) => {
    const count = resultCount(store, p.playerId);
    const row: ResultPlayerView = {
      id: p.playerId,
      name: p.playerId === selfId ? "You" : p.doc.displayName,
      cardCount: count,
      isWinner: isWinningSide(p),
      wentOut: count === 0 && isWinningSide(p),
    };
    if (p.doc.team) row.team = p.doc.team as TeamId;
    return row;
  });

  const winners = rows.filter((r) => r.isWinner);
  const kind: ResultKind = winner === null ? "none" : winner.kind === "team" ? "team" : "player";

  const title = resultTitle(kind, winner, rows);
  const wentOutRow = rows.find((r) => r.wentOut);

  const selfIsHost = room.hostPlayerId === selfId;
  const view: GameResultView = {
    room: roomView,
    selfId,
    kind,
    mode,
    title,
    winners,
    players: rows,
    selfIsHost,
  };
  if (wentOutRow) {
    view.subtitle = `${wentOutRow.id === selfId ? "You" : wentOutRow.name} played the last card`;
  }
  return view;
}

/** Compose the result title from the outcome. */
function resultTitle(
  kind: ResultKind,
  winner: StateDoc["winner"],
  rows: ResultPlayerView[],
): string {
  if (kind === "none" || winner === null) return "Game ended";
  if (winner.kind === "team") return `Team ${winner.team} wins!`;
  const w = rows.find((r) => r.id === winner.playerId);
  return `${w?.name ?? "Someone"} wins!`;
}

/**
 * A player's remaining-card count for the results card (Req 12.3). Uses the
 * server-denormalized `players/{id}.cardCount`, falling back to the readable
 * own/partner hand count.
 */
function resultCount(store: RealtimeStore, playerId: string): number {
  if (playerId === store.playerId) return store.ownHand?.cardCount ?? 0;
  const target = store.players.find((p) => p.playerId === playerId);
  if (target?.doc.cardCount !== undefined) return target.doc.cardCount;
  const me = store.players.find((p) => p.playerId === store.playerId);
  if (
    store.partnerHand?.cardCount !== undefined &&
    me?.doc.team &&
    target?.doc.team === me.doc.team
  ) {
    return store.partnerHand.cardCount;
  }
  return 0;
}
