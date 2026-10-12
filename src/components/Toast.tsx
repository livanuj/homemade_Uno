/**
 * Toast — a transient message pill (design.md §5.19).
 *
 * A short notice for events everyone should notice (disconnects, penalties,
 * mode auto-switch): `bg-ink text-surface rounded-full px-4 py-2.5 text-label
 * shadow-cta`, `role="status"`. On the table it is centered at about y 214,
 * above the piles; only one shows at a time.
 *
 * Motion (Task 7.2): the pill slides down 8px and fades in on mount, then
 * slides/fades out (`toastSlide`), driven by `AnimatePresence` on `open` (Req
 * 17.9, §5.19). Auto-dismiss (§5.19): when `durationMs` and `onDismiss` are
 * supplied, the toast schedules its own dismissal after the timeout (default
 * 3s); the caller flips `open`/removes it in `onDismiss`. `role="status"` is
 * kept so it is announced politely (task 10 layers on `aria-live`). Reduced
 * motion (Req 17.6): the slide/fade becomes instant while the auto-dismiss
 * timing is preserved.
 *
 * Tokens only (token-policy.md); native element (styling.md). `className` is
 * the seam for table positioning at the call site.
 */
import { instant, toastSlide } from "@/design/motion";
import { cn } from "@/lib/cn";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, type ReactNode } from "react";

/** Default auto-dismiss window (§5.19 — 3 seconds). */
export const TOAST_DEFAULT_DURATION_MS = 3000;

export interface ToastProps {
  children: ReactNode;
  /**
   * Drives the enter/exit animation via `AnimatePresence`. Defaults to `true`
   * so existing call sites render the pill immediately.
   */
  open?: boolean;
  /**
   * Fired when the auto-dismiss timeout elapses (§5.19). The caller removes /
   * hides the toast in response. Omit for a toast the caller controls manually.
   */
  onDismiss?: () => void;
  /** Auto-dismiss window in ms; defaults to {@link TOAST_DEFAULT_DURATION_MS}. */
  durationMs?: number;
  /** Honor reduced motion (Req 17.6) — pass from `usePrefersReducedMotion()`. */
  reduced?: boolean;
  className?: string;
}

export function Toast({
  children,
  open = true,
  onDismiss,
  durationMs = TOAST_DEFAULT_DURATION_MS,
  reduced = false,
  className,
}: ToastProps) {
  // Auto-dismiss: schedule the timeout while shown. The timing is independent
  // of motion, so it is preserved under reduced motion (Req 17.6 / §5.19).
  useEffect(() => {
    if (!open || !onDismiss) return;
    const id = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(id);
  }, [open, onDismiss, durationMs]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="status"
          variants={toastSlide}
          initial="hidden"
          animate="visible"
          exit="exit"
          {...(reduced ? { transition: instant } : {})}
          className={cn(
            "inline-flex items-center gap-2 bg-ink text-surface rounded-full px-4 py-2.5 text-label shadow-cta",
            className,
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
