---
inclusion: fileMatch
fileMatchPattern: "src/{components,design,routes}/**/*.{ts,tsx}"
---

# Animation Conventions (Motion for React)

All motion uses `motion/react`, following design.md §9. Timings and springs come from the Design_Spec — do not invent new ones.

## Use shared layout for the card throw

- REQUIRED: the played card animates from hand to discard via a shared `layoutId={card.id}` with a spring `{ stiffness: 380, damping: 30 }`, landing at a random rotation in −10°…+10°.
- Card `id` must be stable across the move so Motion can match the elements.
- If the shared transition is interrupted or its target is unavailable, commit the card to its final discard position (no missing/intermediate state) — Requirement 17.7.

## Centralize presets

- FORBIDDEN: scattering magic numbers (`transition={{ duration: 0.35 }}`) across components.
- REQUIRED: import named presets from `src/design/motion.ts` (e.g. `playSpring`, `flightFlip350`, `drawerSlide`, `sheetSlide`, `dialogFade`, `dragLift`). One place to tune, matching the spec table.

## Always honor reduced motion

- REQUIRED: gate motion on a `usePrefersReducedMotion()` hook. When reduced: card flights become instant moves, the turn pulse is removed, confetti renders statically.
  ```tsx
  const reduced = usePrefersReducedMotion();
  <motion.div animate={reduced ? { x: toX, y: toY } : undefined}
              layoutId={reduced ? undefined : card.id} />
  ```
- theme.css already neutralizes CSS animations under `prefers-reduced-motion`; Motion variants must read the same preference so JS-driven motion matches.

## Map each moment to the spec

Play/throw (shared layout spring), opponent play (flight + `rotateY 180→0`, 350ms), draw (slide + flip), deal (60ms stagger, round-robin), select (raise 150ms), illegal tap (shake ±6px ×3, 240ms), turn change (pill cross-fade + `animate-turn-pulse`), wild color (ring/glow cross-fade 300ms), menu drawer (slide from 100%, 250ms), bottom sheet (slide-up), dialog (fade/scale), drag (lift/tilt + drop spring), pause overlay (fade). Keep these exact — they are specified.

## Do not animate layout-critical game state

Animation is presentational. The authoritative state comes from the server broadcast; never let an in-flight animation gate when server state is applied.
