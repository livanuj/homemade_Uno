/**
 * LiveAnnouncer — an `aria-live="polite"` region that announces turn changes
 * and card plays to assistive technology (Requirement 18.4, 18.7).
 *
 * The game table is a spatial, color-and-shape surface; a screen-reader user
 * needs the same "whose turn is it / what was just played" information the
 * sighted turn pill and discard glow convey. This component renders a single
 * visually-hidden (`sr-only`) polite region whose text is swapped as the game
 * advances; `aria-atomic` makes the whole message re-read each time.
 *
 * Req 18.7 — "without discarding the most recent turn-change or card-played
 * announcement": the `useGameAnnouncements` hook composes the newest card play
 * AND the current turn into one string, so a card play that lands together with
 * a turn advance is never lost, and it nudges the text for a repeated identical
 * play (screen readers only re-read when the region content actually changes).
 *
 * No visual tokens are used — the region is `sr-only` and never painted
 * (token-policy.md is N/A for non-visual, screen-reader-only text).
 */

/** A message for the polite live region. Empty string renders nothing audible. */
export interface LiveAnnouncerProps {
  /** The current announcement text (composed by `useGameAnnouncements`). */
  message: string;
}

export function LiveAnnouncer({ message }: LiveAnnouncerProps) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}

/**
 * Inputs the announcer derives its message from. All optional so callers can
 * feed whatever they have; the hook composes a stable string from them.
 */
export interface GameAnnouncementInput {
  /**
   * The current turn line (e.g. "Maya's turn · red"). Mirrors the visible
   * `TurnPill` text so the announcement matches what sighted players see.
   */
  turnText?: string;
  /**
   * The most recent card play, phrased for speech (e.g. "Maya played Red 7").
   * Optional — omitted when nothing was just played.
   */
  lastPlay?: string;
  /**
   * A monotonically increasing sequence for `lastPlay`. When two identical
   * plays occur back-to-back (same `lastPlay` string), bumping `playSeq` lets
   * the hook change the emitted text so the repeat is actually re-announced
   * (Req 18.7). Optional; defaults to treating each distinct `lastPlay` as new.
   */
  playSeq?: number;
}

/**
 * Compose the polite-region text from the current turn and the latest play,
 * keeping the newest of each (Req 18.7). Returns the string to hand to
 * `LiveAnnouncer`.
 *
 * This is a pure derivation — no internal state — so it is deterministic and
 * easy to test: given the same inputs it yields the same string, and it only
 * changes when the turn text, the play text, or the play sequence changes.
 * The card play leads (it is the freshest event) followed by the turn line.
 */
export function useGameAnnouncements(input: GameAnnouncementInput): string {
  const { turnText, lastPlay, playSeq } = input;

  const parts: string[] = [];
  if (lastPlay) {
    // A distinct sequence number for a repeated identical play is appended as a
    // zero-width nudge so the region content differs and is re-read, without
    // being audible ("Red 7 " reads the same regardless of trailing spaces).
    const nudge = playSeq && playSeq > 1 ? " ".repeat(playSeq) : "";
    parts.push(`${lastPlay}.${nudge}`);
  }
  if (turnText) {
    parts.push(turnText);
  }
  return parts.join(" ");
}
