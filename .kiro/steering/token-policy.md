---
inclusion: fileMatch
fileMatchPattern: "src/**/*.{tsx,ts,css}"
---

# Design Token Policy

The design system is the single source of truth. Every visual value maps to a token defined in `design/uno-design/theme.css` (mirrored in `tokens.json`). Never invent a color, size, radius, shadow, or type value. This enforces Requirement 20.

Reference material: `design/uno-design/design.md`, `theme.css`, `tokens.json`, and the screen refs in `screen-map.json`.

## Colors — always a token, never a hex

- FORBIDDEN: `className="bg-[#F2EBDD]"` / `style={{ color: '#2B2320' }}`
- REQUIRED: `className="bg-paper text-ink"`

Available color tokens: `paper`, `felt`, `felt-edge`, `surface`, `ink`, `ink-muted`, `ink-faint`, `line`, `avatar`, `card-back`, `card-back-deep`, `danger`, `turn`; suits `suit-red`/`-red-ink`, `suit-yellow`/`-yellow-ink`/`-yellow-on`, `suit-green`/`-green-ink`, `suit-blue`/`-blue-ink`; teams `team-a`, `team-b`.

## Typography — use the type-scale tokens

Each `text-*` token carries its own size, line-height, tracking, and weight. One class is enough.

- FORBIDDEN: `className="text-[42px] font-extrabold tracking-[0.14em]"`
- REQUIRED: `className="font-display text-code"`

Type tokens: `text-code`, `text-hero`, `text-sheet`, `text-title`, `text-cta`, `text-input`, `text-body`, `text-label`, `text-paragraph`, `text-caption`, `text-micro`, `text-card-lg`, `text-card`, `text-card-corner`. Families: `font-display` (Bricolage Grotesque — titles, room codes, card numerals, primary CTAs) and `font-sans` (Manrope — everything else, default).

## Radius / shadow — tokens only

- FORBIDDEN: `className="rounded-[22px] shadow-[0_6px_16px_rgba(0,0,0,.25)]"`
- REQUIRED: `className="rounded-panel shadow-cta"`

Radii: `rounded-card-back`, `-card-sm`, `-card`, `-card-lg`, `-row`, `-input`, `-section`, `-panel`, `-drawer`, plus `rounded-full`. Shadows: `shadow-panel`, `-card`, `-card-lifted`, `-cta`, `-drawer`, `-sheet`, `-turn`, `inset-shadow-felt`.

## Spacing — Tailwind default scale

Spacing uses Tailwind's default 4px scale plus the few exact values documented in `design.md` (e.g. `gap-[22px]` on home). Do not introduce other arbitrary spacing.

- FORBIDDEN: `className="p-[13px]"` (undocumented)
- REQUIRED: `className="p-4"` / `className="gap-[22px]"` (documented in design.md §4)

## Safe areas & motion

- Use `pt-safe` / `pb-safe` utilities (defined in theme.css) for notch/home-bar spacing — never hardcode `env(safe-area-inset-*)` in components.
- Turn pulse is `animate-turn-pulse`; card easing is `ease-card`. Do not redefine these.

## Adding a missing token

If a needed value has no token: (1) use the closest existing token; (2) if truly missing and design-approved, add it to `theme.css` with a **semantic** name describing its purpose (`--color-warning`), never its literal value (`--color-orange-3`); (3) never inline the raw value in a component.

## Pre-commit checklist

- [ ] No hex/rgb literals in `className` or `style`.
- [ ] No arbitrary `text-[...]`, `rounded-[...]`, `shadow-[...]`.
- [ ] Every visual value traces to a token in `theme.css`.
- [ ] Yellow text on paper/surface uses `suit-yellow-ink` or `ink`, never `suit-yellow` (contrast).
