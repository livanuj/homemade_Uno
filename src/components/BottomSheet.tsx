/**
 * BottomSheet — a sheet that sits over the table (design.md §5.15).
 *
 * Used by the Wild color picker (`06a`) and "Drew a playable card" (`06b`). It
 * renders over a `bg-ink/50` backdrop as `fixed inset-x-0 bottom-0 bg-surface
 * rounded-t-drawer shadow-sheet px-5 pt-6 pb-safe flex flex-col gap-4` (the
 * picker uses `gap-5`). It is `role="dialog"` with `aria-labelledby` pointing
 * at its title (`text-sheet`, Bricolage); an optional subtitle is `text-label`
 * in `ink-muted`.
 *
 * Reuses `Backdrop` (reuse-before-create). Tokens only (token-policy.md).
 *
 * Motion (Task 7.2): the sheet slides up from `y=100%` (`sheetSlide`) while the
 * backdrop fades in, via `AnimatePresence` on `open` so it also animates on
 * dismissal (Req 17.9). Reduced motion (Req 17.6): both become instant. Focus
 * management arrives in task 10. `open` defaults to `true` so existing call
 * sites keep working.
 *
 * The Wild picker deliberately has NO backdrop-close / cancel affordance
 * (§5.16); callers omit `onClose` in that case, and the backdrop stays inert.
 */
import { instant, sheetSlide } from "@/design/motion";
import { cn } from "@/lib/cn";
import { AnimatePresence, motion } from "motion/react";
import { useId, useRef, type ReactNode } from "react";
import { MotionBackdrop } from "./MotionBackdrop";
import { useModalA11y } from "@/lib/useModalA11y";

export interface BottomSheetProps {
  /** Sheet title (`text-sheet`, wired to `aria-labelledby`). */
  title: ReactNode;
  /** Optional subtitle / consequence line under the title. */
  subtitle?: ReactNode;
  /**
   * Tap-backdrop-to-close. Omitted for the Wild picker (§5.16 — no cancel), in
   * which case the backdrop is inert and no dismissal is offered.
   */
  onClose?: () => void;
  /** Wider vertical rhythm (`gap-5`) for the Wild picker (§5.15). */
  spacious?: boolean;
  /** Optional element rendered above the sheet (e.g. the played Wild card). */
  header?: ReactNode;
  children: ReactNode;
  /**
   * Drives the enter/exit animation via `AnimatePresence` (Req 17.9). Defaults
   * to `true` so existing call sites keep working.
   */
  open?: boolean;
  /** Honor reduced motion (Req 17.6) — pass from `usePrefersReducedMotion()`. */
  reduced?: boolean;
  className?: string;
}

export function BottomSheet({
  title,
  subtitle,
  onClose,
  spacious = false,
  header,
  children,
  open = true,
  reduced = false,
  className,
}: BottomSheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);

  // Focus-in / return-focus / trap. Escape only closes when a close affordance
  // exists — the Wild picker omits `onClose` and must NOT dismiss on Escape
  // (§5.16, Req 18.10).
  useModalA11y(panelRef, {
    open,
    onClose: () => onClose?.(),
    escapeCloses: onClose != null,
  });

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end">
          <MotionBackdrop
            onActivate={onClose}
            label="Close"
            reduced={reduced}
          />
          <motion.section
            ref={panelRef}
            role="dialog"
            aria-labelledby={titleId}
            variants={sheetSlide}
            initial="hidden"
            animate="visible"
            exit="exit"
            {...(reduced ? { transition: instant } : {})}
            className={cn(
              "relative flex flex-col bg-surface rounded-t-drawer shadow-sheet px-5 pt-6 pb-safe",
              spacious ? "gap-5" : "gap-4",
              className,
            )}
          >
            {header}
            <div className="flex flex-col gap-1.5">
              <h2 id={titleId} className="font-display text-sheet text-ink">
                {title}
              </h2>
              {subtitle && (
                <p className="text-label text-ink-muted">{subtitle}</p>
              )}
            </div>
            {children}
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}
