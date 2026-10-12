/**
 * Dialog — a centered modal (design.md §5.18, screen `06d-leave-confirm`).
 *
 * A centered card over a `bg-ink/50` backdrop with `role="alertdialog"`:
 * `w-[calc(100%-48px)] max-w-[342px] bg-surface rounded-panel shadow-cta p-6
 * flex flex-col gap-[18px]`. Top to bottom (§5.18): a 48px `bg-paper` circle
 * holding a 22px icon, the title (`text-sheet`), the explanation
 * (`text-paragraph text-ink-muted`), then the stacked actions (`gap-2.5`) with
 * the safe action first and the destructive action second.
 *
 * Reuses `Backdrop` and `Button` (reuse-before-create). Tokens only
 * (token-policy.md). The title / explanation / actions are slots so the same
 * shell serves leave-confirm and any future confirmation.
 *
 * Motion (Task 7.2): the card fades and scales 0.96 → 1 over 200ms
 * (`dialogFade`) and the backdrop fades in, driven by `AnimatePresence` on
 * `open` so it also animates on close (Req 17.9). Reduced motion (Req 17.6):
 * both become instant. Focus trap / Escape come in task 10. `open` defaults to
 * `true` so callers that mount/unmount the dialog keep working.
 */
import { dialogFade, instant } from "@/design/motion";
import { cn } from "@/lib/cn";
import { AnimatePresence, motion } from "motion/react";
import { useId, type ReactNode } from "react";
import { MotionBackdrop } from "./MotionBackdrop";

export interface DialogProps {
  /** Title line (`text-sheet`, wired to `aria-labelledby`). */
  title: ReactNode;
  /** Explanation paragraph (`text-paragraph text-ink-muted`). */
  description?: ReactNode;
  /** The 22px icon shown in the 48px `bg-paper` circle. */
  icon?: ReactNode;
  /**
   * Stacked action buttons (`gap-2.5`), safe action first then destructive
   * (§5.18). Supplied by the caller so the shell stays generic.
   */
  actions: ReactNode;
  /** Backdrop tap-to-close (Escape is wired in task 10). */
  onClose?: () => void;
  /**
   * Drives the enter/exit animation via `AnimatePresence` (Req 17.9). Defaults
   * to `true` so existing call sites that mount/unmount the dialog keep working.
   */
  open?: boolean;
  /** Honor reduced motion (Req 17.6) — pass from `usePrefersReducedMotion()`. */
  reduced?: boolean;
  className?: string;
}

export function Dialog({
  title,
  description,
  icon,
  actions,
  onClose,
  open = true,
  reduced = false,
  className,
}: DialogProps) {
  const titleId = useId();
  const descId = useId();

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center px-6">
          <MotionBackdrop
            onActivate={onClose}
            label="Close"
            reduced={reduced}
          />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            variants={dialogFade}
            initial="hidden"
            animate="visible"
            exit="exit"
            {...(reduced ? { transition: instant } : {})}
            className={cn(
              "relative flex w-[calc(100%-48px)] max-w-[342px] flex-col gap-[18px]",
              "bg-surface rounded-panel shadow-cta p-6",
              className,
            )}
          >
            {icon && (
              <span className="grid size-12 place-items-center rounded-full bg-paper text-ink">
                {icon}
              </span>
            )}
            <div className="flex flex-col gap-1.5">
              <h2 id={titleId} className="font-display text-sheet text-ink">
                {title}
              </h2>
              {description && (
                <p id={descId} className="text-paragraph text-ink-muted">
                  {description}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2.5">{actions}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
