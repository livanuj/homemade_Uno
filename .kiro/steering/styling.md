---
inclusion: fileMatch
fileMatchPattern: "src/**/*.{tsx,css}"
---

# Styling Standards (Tailwind CSS v4)

Complements `token-policy.md` (which governs *which values* are allowed). This governs *how* classes are written.

## No dynamic class-name string interpolation

Tailwind's compiler only sees complete class strings. Interpolated fragments get purged and silently break at runtime.

- FORBIDDEN:
  ```tsx
  <div className={`bg-suit-${suit}`} />
  <div className={`text-${size}`} />
  ```
- REQUIRED — static mapping object with full class names:
  ```tsx
  const SUIT_FILL = {
    red: "bg-suit-red",
    yellow: "bg-suit-yellow",
    green: "bg-suit-green",
    blue: "bg-suit-blue",
  } as const;
  <div className={SUIT_FILL[suit]} />
  ```
- For genuinely runtime values (e.g. a countdown ring stroke, a fan rotation), use a CSS variable via `style`, not a class:
  ```tsx
  <span style={{ ["--rot" as string]: `${rotation}deg` }} className="rotate-[var(--rot)]" />
  ```

## Merge classes with `cn()`, not template literals

Use a `cn()` helper (clsx + tailwind-merge) so conditional and overriding classes dedupe correctly.

- FORBIDDEN: `className={`rounded-card ${selected ? "shadow-card-lifted" : "shadow-card"} ${className}`}`
- REQUIRED:
  ```tsx
  import { cn } from "@/lib/cn";
  className={cn("rounded-card", selected ? "shadow-card-lifted" : "shadow-card", className)}
  ```

## Class ordering

Order within a `className`: layout (`flex`, `grid`, position) → box model (`w`, `h`, `p`, `m`, `gap`) → typography (`font-*`, `text-*`) → color (`bg-*`, `text-*`, `border-*`) → radius/shadow → state variants → responsive. Keep it consistent; a formatter/plugin may enforce it.

## Mobile-first, state variants

- Mobile-only app: design at 390×844. Do not add desktop breakpoints unless a rule requires it. Prefer no responsive prefix (mobile default).
- Use `hover:`, `focus-visible:`, `disabled:`, `aria-[...]` variants for state. Prefer `focus-visible:` over `focus:` for keyboard rings (base focus ring is defined in theme.css).

## Interactive elements are real elements

- FORBIDDEN: `<div onClick={...}>` for a button.
- REQUIRED: `<button type="button">`, `<a>`, `<input>`. Icon-only controls carry an `aria-label`. (See `component-architecture.md` and Requirement 18.)

## Pre-generation checklist

- [ ] No interpolated class fragments — static maps or CSS vars only.
- [ ] `cn()` used for conditional/merged classes.
- [ ] Interactive = native element with correct `type` / `aria-label`.
- [ ] Only tokens (see `token-policy.md`).
