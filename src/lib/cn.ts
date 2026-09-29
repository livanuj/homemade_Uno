import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names with clsx + tailwind-merge.
 *
 * `clsx` resolves conditional/array/object class inputs into a string, then
 * `tailwind-merge` dedupes conflicting Tailwind utilities so a later class
 * wins (e.g. `cn("shadow-card", selected && "shadow-card-lifted")`).
 *
 * See styling.md / component-architecture.md — `cn()` is the standard helper
 * for conditional and overriding classes.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export type { ClassValue };
