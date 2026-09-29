---
inclusion: always
---

# Design Fidelity (non-negotiable)

All UI generation is locked to the Design_Spec. This is the always-on principle; the detailed rules live in the files cross-linked below and load automatically when you edit UI code. Enforces Requirement 20.

## The Design_Spec is the single source of truth

Every visual value and every screen traces back to `design/uno-design/`:

- `theme.css` — the tokens (color, typography, radius, shadow) as CSS.
- `tokens.json` — the same tokens as data.
- `design.md` — the documented spacing and layout values.
- `screen-map.json` — the index mapping screen IDs to their references.
- `screens/` — the per-screen `.html`/`.png` references.

## Core rules

- REQUIRED: use only the tokens in `theme.css` / `tokens.json`, Tailwind's default spacing scale, and the exact values documented in `design.md`.
- REQUIRED: build each screen to match its reference in `design/uno-design/screens/` (resolve IDs via `screen-map.json`), rebuilt as React + Tailwind — never copy the reference inline styles verbatim.
- FORBIDDEN: inventing any color, size, radius, shadow, or type value, or inlining a raw literal (hex/rgb/`text-[…]`/`rounded-[…]`/`shadow-[…]`). If a value is missing, use the closest token or resolve it per `token-policy.md` — never inline it.

## Detailed rules (load when editing UI)

- `token-policy.md` — which visual values are allowed (the full token catalog, adding-a-missing-token flow, checklist).
- `styling.md` — how classes are written (static maps over interpolation, `cn()`, native interactive elements).

Keep these consulted; do not duplicate their contents here.
