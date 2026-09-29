/**
 * MotionDeal — the deal stagger (Task 7.1, Req 5.4).
 *
 * At the start of a round, 7 cards per seat are dealt round-robin, each card
 * appearing 60ms after the previous. `MotionDeal` is the parent that staggers
 * its `MotionDeal.Card` children; the composing screen (task 8) supplies the
 * round-robin ORDER by rendering children in deal order and/or passing an
 * explicit `index` per card.
 *
 * Reduced motion (Req 17.6): all cards appear at once (no stagger, no travel).
 */
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { dealDelay, dealStagger, EASE_CARD, instant } from "@/design/motion";

const cardVariants = {
  hidden: { opacity: 0, y: -12 },
  visible: { opacity: 1, y: 0 },
};

export interface MotionDealProps {
  children: ReactNode;
  /** Honor reduced motion (Req 17.6). */
  reduced?: boolean;
  className?: string;
}

/** The staggering container. Children should be `MotionDeal.Card`s. */
export function MotionDeal({ children, reduced = false, className }: MotionDealProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      transition={reduced ? instant : dealStagger}
    >
      {children}
    </motion.div>
  );
}

export interface MotionDealCardProps {
  /** Round-robin deal index (drives the 60ms cumulative delay). */
  index: number;
  children: ReactNode;
  reduced?: boolean;
  className?: string;
}

/**
 * A single dealt card. Uses an explicit per-index delay so the round-robin
 * order is fully controlled by the caller (seat interleaving), rather than DOM
 * order alone.
 */
function DealCard({ index, children, reduced = false, className }: MotionDealCardProps) {
  return (
    <motion.div
      className={className}
      variants={cardVariants}
      transition={
        reduced ? instant : { delay: dealDelay(index), duration: 0.2, ease: EASE_CARD }
      }
    >
      {children}
    </motion.div>
  );
}

MotionDeal.Card = DealCard;
