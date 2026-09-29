import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Accessible name for the icon-only control (Requirement 18.1). Required — an
   * icon button with no visible text label must always carry an `aria-label`.
   */
  "aria-label": string;
  /** The 20px stroke icon (design.md §5.4). */
  children: ReactNode;
}

/**
 * Icon-only button (design.md §5.4 — `size-11 rounded-full bg-surface grid
 * place-items-center`, 20px stroke icon). Used for Menu, back, close, settings.
 *
 * The `aria-label` prop is required at the type level so every icon button is
 * announced with a name (Requirement 18.1 / styling.md). Renders a real
 * `<button>` and defaults `type` to `"button"`.
 */
export function IconButton({
  type = "button",
  className,
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "grid size-11 place-items-center rounded-full bg-surface text-ink",
        "disabled:cursor-not-allowed",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
