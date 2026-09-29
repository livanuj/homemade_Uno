import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Button variants (design.md §5.4).
 *
 * Each variant maps to a full, static class string so Tailwind's compiler sees
 * complete class names (styling.md — no interpolated class fragments).
 *
 * - `primary`      — h-14 full-width ink CTA with `shadow-cta` (Create a room, Start game).
 * - `primary-small`— h-11 ink pill (Share invite).
 * - `outline`      — h-11 ink-outlined pill (Copy link, Join). "LAST CARD!" adds
 *                    `font-display`/uppercase at the call site.
 * - `soft`         — h-[50px] paper pill (How to play, Back to home, Leave room).
 * - `danger`       — h-[50px] danger-outlined pill (Leave game).
 *
 * The disabled primary uses the documented `bg-line text-ink-muted` (no shadow)
 * treatment from §5.4 and is always paired with a reason caption (§5.14) at the
 * call site.
 */
export type ButtonVariant =
  | "primary"
  | "primary-small"
  | "outline"
  | "soft"
  | "danger";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    "h-14 w-full rounded-full bg-ink text-surface font-display text-cta shadow-cta",
  "primary-small": "h-11 rounded-full bg-ink text-surface text-body",
  outline: "h-11 rounded-full border-2 border-ink text-ink text-body",
  soft: "h-[50px] rounded-full bg-paper text-ink text-body",
  danger:
    "h-[50px] rounded-full border-2 border-danger text-danger font-extrabold",
};

/** Disabled treatment for the primary CTA (§5.4 — `bg-line text-ink-muted`, no shadow). */
const PRIMARY_DISABLED_CLASS =
  "h-14 w-full rounded-full bg-line text-ink-muted font-display text-cta shadow-none";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

/**
 * Text button in one of the design's five variants (design.md §5.4).
 *
 * Renders a real `<button>` (styling.md — interactive elements are native
 * elements) and defaults `type` to `"button"` so it never accidentally submits
 * a form. Disabled `primary` buttons swap to the documented muted treatment.
 */
export function Button({
  variant = "primary",
  disabled = false,
  type = "button",
  className,
  children,
  ...rest
}: ButtonProps) {
  const base =
    variant === "primary" && disabled
      ? PRIMARY_DISABLED_CLASS
      : VARIANT_CLASS[variant];

  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center px-5",
        base,
        "disabled:cursor-not-allowed",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
