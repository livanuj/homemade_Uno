/**
 * MotionTurnPill — turn-pill cross-fade on active-player change (Task 7.1).
 *
 * When the active player changes, the pill cross-fades its old content out and
 * the new active player / match constraint in (Req 17.4). Wraps the pure
 * {@link TurnPill}; the key that drives the cross-fade is the pill's content
 * identity (e.g. the active seat + constraint), supplied by the screen.
 *
 * The companion moment — the turn-ring pulse on the new active avatar — lives
 * on {@link Avatar} via its `activeTurn` prop (theme.css `animate-turn-pulse`).
 * Use {@link shouldPulse} to gate it so reduced motion removes the pulse
 * (Req 17.6).
 *
 * Reduced motion (Req 17.6): the cross-fade becomes an instant swap.
 */
import { instant, turnCrossFade } from "@/design/motion";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { TurnPill, type TurnPillTone } from "./TurnPill";

export interface MotionTurnPillProps {
  /**
   * Identity of the current pill content (e.g. `${activeSeat}:${constraint}`).
   * Changing this key triggers the cross-fade to the new content.
   */
  transitionKey: string;
  tone: TurnPillTone;
  children: ReactNode;
  /** Honor reduced motion (Req 17.6). */
  reduced?: boolean;
  className?: string;
}

/**
 * Whether the new active avatar should show the turn-ring pulse. Removes the
 * pulse under reduced motion (Req 17.6). Screens pass the result to
 * `Avatar activeTurn={…}`.
 */
export function shouldPulse(isActiveTurn: boolean, reduced: boolean): boolean {
  return isActiveTurn && !reduced;
}

export function MotionTurnPill({
  transitionKey,
  tone,
  children,
  reduced = false,
  className,
}: MotionTurnPillProps) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={transitionKey}
        variants={turnCrossFade}
        initial="initial"
        animate="animate"
        exit="exit"
        {...(reduced ? { transition: instant } : {})}
      >
        <TurnPill tone={tone} {...(className ? { className } : {})}>
          {children}
        </TurnPill>
      </motion.div>
    </AnimatePresence>
  );
}
