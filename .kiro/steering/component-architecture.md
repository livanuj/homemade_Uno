---
inclusion: fileMatch
fileMatchPattern: "src/**/*.{ts,tsx}"
---

# Component & Module Architecture

Folder layout, naming, and reuse rules for the React app.

## Directory structure

```
src/
  main.tsx            # PWA bootstrap, service-worker registration
  App.tsx             # router + global providers
  routes/             # page-level routes (Home, Lobby, Game, GameOver, Settings, HowToPlay)
  components/         # shared, reusable UI (PlayingCard, Avatar, Dialog, Toast, ...)
  game/
    engine/           # PURE rules engine — no React, no I/O (see conventions/game-engine.md)
    view/             # client view-models derived from server state
  realtime/           # channel subscription, presence, reconnect
  supabase/           # client, anon auth, typed queries, Edge Function callers
  design/             # motion presets, token/cn helpers
  lib/                # cn(), small pure utilities
```

Placement rules:
- Reusable across features → `components/`.
- Screen-specific composition → alongside its route in `routes/`.
- Anything overlay-kind in `screen-map.json` (menu, sheets, dialogs, paused overlays) is a **component rendered over the table**, not a route.

## Naming

- Component files and components: `PascalCase.tsx` (`PlayingCard.tsx` → `export function PlayingCard`).
- Hooks: `useCamelCase.ts` (`useRoomChannel`).
- Types/interfaces: `PascalCase`; constants: `UPPER_SNAKE_CASE`; other files: `camelCase.ts`.
- **Named exports only.**
  - FORBIDDEN: `export default function PlayingCard() {}`
  - REQUIRED: `export function PlayingCard() {}`

## Size & responsibility

- One component per file; one clear responsibility.
- If a component exceeds ~150 lines or mixes data-fetching with presentation, split it. Presentational components take props; container/route components wire in realtime state.
- Prefer composition over configuration: small pieces (`CardBack`, `Avatar`, `TurnPill`) composed by `GameTable`, rather than one mega-component with dozens of booleans.

## Reuse before create

Before adding a component, search `src/components/` for an existing one (the design lists the full set: PlayingCard, CardBack, Avatar, buttons, Chip/TurnPill, Input/InputError, Switch, TeamCard/PlayerRow, ModeControl, MenuDrawer, EmptySlot, DragHandle, StartControl, BottomSheet, WildColorButtons, SpotlightCard, Dialog, Toast, OfflineAvatar, CountdownRing, InfoNote, Confetti, PausedOverlay). Extend the existing one before creating a near-duplicate.

## Server state is read-only truth

- FORBIDDEN: mutating game state on the client or writing game tables directly.
- REQUIRED: derive all rendering from the realtime store; send intents through the action client (see `conventions/supabase-data.md`).
