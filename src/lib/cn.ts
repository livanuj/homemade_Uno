import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Custom type-scale tokens from `design/uno-design/theme.css` (`--text-*`).
 * These are font-size utilities (`text-cta`, `text-body`, …), NOT colors.
 * tailwind-merge cannot infer that from the class name alone, so without this
 * it would treat `text-cta` and a color like `text-ink-muted` as the same
 * conflicting group and silently drop one. Registering them under `font-size`
 * lets a type token and a color token coexist on the same element.
 */
const TYPE_SCALE_TOKENS = [
  "code",
  "hero",
  "sheet",
  "title",
  "cta",
  "input",
  "body",
  "label",
  "paragraph",
  "caption",
  "micro",
  "card-lg",
  "card",
  "card-corner",
];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: TYPE_SCALE_TOKENS }],
    },
  },
});

/**
 * Merge class names with clsx + tailwind-merge.
 *
 * `clsx` resolves conditional/array/object class inputs into a string, then
 * `tailwind-merge` dedupes conflicting Tailwind utilities so a later class
 * wins (e.g. `cn("shadow-card", selected && "shadow-card-lifted")`).
 *
 * The merge instance is extended so the design's custom `text-*` type-scale
 * tokens are recognized as font sizes (see `TYPE_SCALE_TOKENS`), keeping them
 * from colliding with `text-*` color tokens.
 *
 * See styling.md / component-architecture.md — `cn()` is the standard helper
 * for conditional and overriding classes.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export type { ClassValue };
