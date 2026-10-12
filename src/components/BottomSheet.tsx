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
 * Structure only — the slide-up animation and focus management arrive in tasks
 * 7 and 10; the panel accepts `className` as the motion seam.
 *
 * The Wild picker deliberately has NO backdrop-close / cancel affordance
 * (§5.16); callers omit `onClose` in that case, and the backdrop stays inert.
 */
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Backdrop } from "./Backdrop";

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
  className?: string;
}

export function BottomSheet({
  title,
  subtitle,
  onClose,
  spacious = false,
  header,
  children,
  className,
}: BottomSheetProps) {
  const titleId = useId();

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <Backdrop onActivate={onClose} label="Close" />
      <section
        role="dialog"
        aria-labelledby={titleId}
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
      </section>
    </div>
  );
}
