/**
 * MotionDragRow — the lift / tilt / drop-spring visual for a draggable 2v2
 * lobby row (Task 7.2, design.md §5.13 / §9, Req 17.8, 21).
 *
 * The full pointer drag-and-drop wiring is task 9.2; this wrapper ships the
 * *visual* language so it is ready to drop in. When `lifted` is true the row
 * scales to 1.02 and tilts −2° (`dragLift`); when it settles back it springs to
 * its slot (`dropSpring`). It wraps a row's contents without changing their
 * markup, aria, or the existing `DragHandle` control (which keeps its
 * tap/keyboard fallback, Req 21.6).
 *
 * The `shadow-card-lifted` treatment lives in `DRAG_STATE.liftedRow`; this
 * wrapper animates only the transform so the shadow class and the transform
 * agree (styling.md — static classes; animation.md — centralized presets;
 * timings from `src/design/motion.ts`).
 *
 * Reduced motion (Req 17.6): the lift/drop becomes an instant transform change
 * — the row still reads as lifted (scale/tilt applied) but without the spring
 * travel, matching theme.css's reduced-motion neutralization.
 */
import { dragLift, dropSpring, instant } from "@/design/motion";
import { cn } from "@/lib/cn";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { DRAG_STATE } from "./DragHandle";

export interface MotionDragRowProps {
  /** Whether this row is currently lifted (being dragged). */
  lifted?: boolean;
  /** Honor reduced motion (Req 17.6) — pass from `usePrefersReducedMotion()`. */
  reduced?: boolean;
  children: ReactNode;
  className?: string;
}

export function MotionDragRow({
  lifted = false,
  reduced = false,
  children,
  className,
}: MotionDragRowProps) {
  return (
    <motion.div
      variants={dragLift}
      initial={false}
      animate={lifted ? "lifted" : "resting"}
      transition={reduced ? instant : dropSpring}
      className={cn(lifted && DRAG_STATE.liftedRow, className)}
    >
      {children}
    </motion.div>
  );
}
