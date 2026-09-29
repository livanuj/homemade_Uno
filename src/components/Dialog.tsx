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
 * shell serves leave-confirm and any future confirmation. Structure only — the
 * fade/scale animation and focus trap come in tasks 7 and 10; `className` is
 * the motion seam.
 */
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Backdrop } from "./Backdrop";

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
  className?: string;
}

export function Dialog({
  title,
  description,
  icon,
  actions,
  onClose,
  className,
}: DialogProps) {
  const titleId = useId();
  const descId = useId();

  return (
    <div className="fixed inset-0 z-50 grid place-items-center px-6">
      <Backdrop onActivate={onClose} label="Close" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
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
      </div>
    </div>
  );
}
