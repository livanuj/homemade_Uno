/**
 * In-game overlay view-model (task 8.5) — the data behind the five overlay
 * states that render OVER the game table (`05-menu`, `06a-wild-color-picker`,
 * `06b-drew-playable-card`, `06c-player-disconnected`, `06d-leave-confirm`).
 *
 * These are the read-only shapes the `GameOverlays` composition consumes,
 * derived (in the future) from the authoritative public state + the caller's
 * own hand. The realtime layer (task 5) and Cloud Functions (task 4) are
 * DEFERRED, so today they are produced by in-memory fixtures keyed by an
 * `?overlay=` query param so Playwright and links reach each distinct state.
 * Nothing here imports firebase or performs I/O.
 *
 * The menu drawer, wild picker, drew sheet, and leave-confirm dialog float over
 * a table (any `GameView`); the disconnected state is a *table state* — it
 * marks one seat offline and adds a waiting pill + toast + "Pause and wait"
 * chip over the same table. So the overlay model carries just the bits each
 * overlay needs beyond the underlying `GameView`.
 */
import type { CardValue, Suit } from "@/design/suits";

/**
 * The five overlay state ids (`05`, `06a`–`06d`), used as the `?overlay=`
 * query-param value so Playwright can reach each distinct state and the route
 * can pick the matching overlay without a backend.
 */
export type OverlayId =
  | "menu" // 05-menu — the in-game menu drawer
  | "wild" // 06a-wild-color-picker — the wild color picker sheet
  | "drew" // 06b-drew-playable-card — the "you drew a playable card" sheet
  | "disconnected" // 06c-player-disconnected — a disconnected table state
  | "leave"; // 06d-leave-confirm — the leave-confirm dialog

/** All valid overlay ids, for validating a `?overlay=` query param. */
export const OVERLAY_IDS: readonly OverlayId[] = [
  "menu",
  "wild",
  "drew",
  "disconnected",
  "leave",
] as const;

/** Type guard: is `value` one of the five overlay ids? */
export function isOverlayId(value: string | null): value is OverlayId {
  return value !== null && (OVERLAY_IDS as readonly string[]).includes(value);
}

/**
 * The played wild card + who draws next, for the `06a` picker (§5.16). The
 * picker itself has NO cancel (Req 8.5/8.6) — the only way out is to choose.
 */
export interface WildPickerView {
  /** The wild card that was played ("wild" or "wild4"). */
  card: CardValue;
  /** Consequence line, e.g. "Leo draws 4 unless he can stack" (Req 9.6). */
  consequence?: string;
}

/**
 * The freshly drawn, playable card for the `06b` sheet (Req 10.2). The player
 * chooses "Play it" (play the drawn card now) or "Keep it" (keep it and end the
 * turn).
 */
export interface DrewCardView {
  /** Suit of the drawn card (omitted for wild / wild4). */
  suit?: Suit;
  /** Value of the drawn card. */
  value: CardValue;
  /** The "<card> fits the pile" line composed for the sheet title. */
  fitsLine: string;
}

/**
 * The disconnected-player table state for `06c` (Req 15.1/15.3/15.5). One seat
 * is faded offline with a draining countdown ring; the turn pill shows
 * "Waiting for [name] · skipping in Ns" with a "Pause and wait" chip under it,
 * and a "[name] lost connection" toast shows above the piles.
 */
export interface DisconnectedView {
  /** The disconnected player's id (the seat marked offline). */
  playerId: string;
  /** The disconnected player's display name. */
  name: string;
  /** Whole seconds left in the grace countdown (Req 15.3). */
  secondsLeft: number;
  /** Total grace-period seconds (drives the ring fraction). Defaults to 60. */
  graceSeconds?: number;
}

/** Everything the overlay layer needs beyond the underlying `GameView`. */
export interface OverlayView {
  wild?: WildPickerView;
  drew?: DrewCardView;
  disconnected?: DisconnectedView;
}

/**
 * `06a` fixture — a played Wild +4 with Leo up next, matching the reference.
 */
function overlayWild(): OverlayView {
  return {
    wild: {
      card: "wild4",
      consequence: "Leo draws 4 unless he can stack",
    },
  };
}

/**
 * `06b` fixture — a drawn Red 3 that fits the pile, matching the reference.
 */
function overlayDrew(): OverlayView {
  return {
    drew: {
      suit: "red",
      value: 3,
      fitsLine: "Red 3 fits the pile",
    },
  };
}

/**
 * `06c` fixture — Nora offline on the normal table with 42s left, matching the
 * reference. The route marks Nora's seat offline on the `04` `GameView` and
 * hands this to the overlay for the pill + toast + chip.
 */
function overlayDisconnected(): OverlayView {
  return {
    disconnected: {
      playerId: "nora",
      name: "Nora",
      secondsLeft: 42,
      graceSeconds: 60,
    },
  };
}

/** Map each overlay id to any extra view-model it needs. */
const OVERLAY_FIXTURES: Record<OverlayId, () => OverlayView> = {
  menu: () => ({}),
  wild: overlayWild,
  drew: overlayDrew,
  disconnected: overlayDisconnected,
  leave: () => ({}),
};

/**
 * Resolve an `?overlay=` value to its {@link OverlayView} extras. Unknown /
 * missing values return an empty model (no extra data needed).
 */
export function makeOverlayView(overlay: string | null): OverlayView {
  if (!isOverlayId(overlay)) return {};
  return OVERLAY_FIXTURES[overlay]();
}
