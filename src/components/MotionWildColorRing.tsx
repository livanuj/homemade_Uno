/**
 * MotionWildColorRing — wild color-change cross-fade (Task 7.1, Req 8.3 / 17).
 *
 * When a wild card sets a new active color, the direction ring + discard glow
 * cross-fade to the newly chosen suit color over 300ms. This wrapper animates
 * the color layer: keying on the active suit, the old color fades out and the
 * new one fades in. The visual ring/glow markup is supplied by the composing
 * screen (task 8) as children; this owns the cross-fade timing only.
 *
 * Reduced motion (Req 17.6): the color swaps instantly.
 */
import { instant, wildColorCrossFade } from "@/design/motion";
import type { Suit } from "@/design/suits";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";

export interface MotionWildColorRingProps {
  /** The current active color; changing it triggers the cross-fade. */
  activeColor: Suit;
  /** The ring/glow element rendered for this color (from the screen). */
  children: ReactNode;
  /** Honor reduced motion (Req 17.6). */
  reduced?: boolean;
  className?: string;
}

export function MotionWildColorRing({
  activeColor,
  children,
  reduced = false,
  className,
}: MotionWildColorRingProps) {
  return (
    <AnimatePresence mode="sync" initial={false}>
      <motion.div
        key={activeColor}
        {...(className ? { className } : {})}
        variants={wildColorCrossFade}
        initial="initial"
        animate="animate"
        exit="exit"
        {...(reduced ? { transition: instant } : {})}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
