import { cn } from "@/lib/cn";
import { APP_SHELL_CLASS } from "@/lib/mobile";
import type { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
  /** Extra classes for the shell (e.g. a screen-specific background). */
  className?: string;
}

/**
 * App root shell (Requirement 16.3, design.md §9).
 *
 * Sizes the app to the full dynamic viewport (`h-dvh`, never `100vh`) and
 * applies safe-area padding (`pt-safe` / `pb-safe`) so no control or text sits
 * under the notch or home bar. Screens compose their own horizontal padding
 * and scrolling inside this shell.
 *
 * The safe-area padding lives here (one place) so individual routes don't each
 * re-apply — and must not double-apply — `pt-safe` / `pb-safe`.
 */
export function Layout({ children, className }: LayoutProps) {
  return <div className={cn(APP_SHELL_CLASS, className)}>{children}</div>;
}
