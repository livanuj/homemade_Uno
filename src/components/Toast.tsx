/**
 * Toast — a transient message pill (design.md §5.19).
 *
 * A short notice for events everyone should notice (disconnects, penalties,
 * mode auto-switch): `bg-ink text-surface rounded-full px-4 py-2.5 text-label
 * shadow-cta`, `role="status"`. On the table it is centered at about y 214,
 * above the piles; only one shows at a time. The 3-second auto-dismiss and the
 * `aria-live` politeness are wired in tasks 7/10 — this component renders the
 * pill statically with the correct `role`.
 *
 * Tokens only (token-policy.md); native element (styling.md). `className` is
 * the seam for the slide+fade motion and for table positioning at the call
 * site.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface ToastProps {
  children: ReactNode;
  className?: string;
}

export function Toast({ children, className }: ToastProps) {
  return (
    <div
      role="status"
      className={cn(
        "inline-flex items-center gap-2 bg-ink text-surface rounded-full px-4 py-2.5 text-label shadow-cta",
        className,
      )}
    >
      {children}
    </div>
  );
}
