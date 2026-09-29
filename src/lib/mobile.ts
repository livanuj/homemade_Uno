/**
 * Mobile / PWA shell class constants.
 *
 * Central home for the viewport + gesture rules from Requirement 16 and
 * design.md §9 so later tasks (the game table in task 8.4, the cards in
 * task 6.1) apply them consistently instead of re-deriving the utilities.
 *
 * token-policy.md: these are all token / Tailwind utilities (`h-dvh`,
 * `pt-safe`, `pb-safe`, `touch-manipulation`, `select-none`) — never raw
 * `env(safe-area-inset-*)` or hardcoded values in components.
 */

/**
 * Full-viewport app root. Uses `h-dvh` (dynamic viewport height, not `100vh`)
 * so the layout tracks the mobile URL bar, plus safe-area padding so nothing
 * renders under the notch or home bar on devices with non-zero insets.
 */
export const APP_SHELL_CLASS = "h-dvh w-full overflow-hidden pt-safe pb-safe";

/**
 * Game table context: disable double-tap / pinch zoom so gestures on the table
 * never change zoom. Apply to the GameTable wrapper (task 8.4).
 */
export const GAME_TABLE_TOUCH_CLASS = "touch-manipulation";

/**
 * Cards: disable text/element selection so dragging or long-pressing a card
 * never selects its label. Apply to PlayingCard / CardBack (task 6.1).
 */
export const CARD_NO_SELECT_CLASS = "select-none";
