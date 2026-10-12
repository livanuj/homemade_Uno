/**
 * Centralized Motion for React presets (design.md §9 "Animation System").
 *
 * Every timing and spring here is taken directly from the Design_Spec — no new
 * values are invented (animation.md). Components import named presets from this
 * module instead of scattering magic numbers, so the spec table lives in one
 * place and is tuned in one place.
 *
 * Organization:
 *   1. Shared primitives (easing, durations, spring configs).
 *   2. Card-flight & turn presets (Task 7.1 — wired now).
 *   3. Overlay / drag / pause / confetti presets (Task 7.2 — declared here so
 *      7.2 EXTENDS this file rather than rewriting it; not yet wired).
 *
 * Reduced motion (Req 17.6): presets that travel (card flights, pulse) expose
 * a reduced variant or are gated by callers via `usePrefersReducedMotion()`.
 * Helpers at the bottom pick the right transition given the preference.
 */
import type { Target, Transition, Variants } from "motion/react";

/* ------------------------------------------------------------------ */
/* 1. Shared primitives                                                */
/* ------------------------------------------------------------------ */

/**
 * The design's `ease-card` curve. theme.css defines the CSS `--ease-card`
 * token; this mirrors it for JS-driven Motion transitions (cubic-bezier).
 */
export const EASE_CARD: [number, number, number, number] = [0.22, 1, 0.36, 0.58];

/** Durations in seconds, keyed to the spec's millisecond values. */
export const DURATION = {
  /** Opponent card flight + flip (Req 17.2). */
  flightFlip: 0.35,
  /** Draw slide + flip (Req 10.6, 17). */
  drawSlide: 0.3,
  /** Select-card raise (Req 17.3). */
  selectRaise: 0.15,
  /** Illegal-tap shake (Req 7.3, 17). */
  illegalShake: 0.24,
  /** Turn-pill cross-fade (Req 17.4). */
  turnCrossFade: 0.2,
  /** Wild color ring/glow cross-fade (Req 8.3, 17). */
  wildCrossFade: 0.3,
  /** Deal per-card stagger (Req 5.4). */
  dealStagger: 0.06,
} as const;

/**
 * Play / throw shared-layout spring (Req 17.1): stiffness 380, damping 30.
 * Used as the `layout`/shared `layoutId` transition for the card that travels
 * from the hand to the top of the discard pile.
 */
export const playSpring: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 30,
};

/* ------------------------------------------------------------------ */
/* 2. Card-flight & turn presets (Task 7.1)                            */
/* ------------------------------------------------------------------ */

/** Random final rotation in −10°…+10° for a settled played card (Req 17.1). */
export function randomSettleRotation(
  rng: () => number = Math.random,
): number {
  return Math.round((rng() * 20 - 10) * 100) / 100;
}

/**
 * Opponent-play flight + flip (Req 17.2): the card flies from the seat to the
 * pile while flipping `rotateY 180 → 0` (face-down → face-up) over ~350ms.
 * Variants are keyed so a caller can drive `from`/`to` with `initial`/`animate`.
 */
export const flightFlip: Variants = {
  from: { rotateY: 180 },
  to: {
    rotateY: 0,
    transition: { duration: DURATION.flightFlip, ease: EASE_CARD },
  },
};

/** The transition half of {@link flightFlip}, for callers that animate x/y too. */
export const flightFlipTransition: Transition = {
  duration: DURATION.flightFlip,
  ease: EASE_CARD,
};

/**
 * Draw slide + flip (Req 10.6, 17): a card slides from the draw pile into the
 * fan and flips face-up over ~300ms with the `ease-card` curve.
 */
export const drawSlide: Variants = {
  from: { rotateY: 180, opacity: 0.6 },
  to: {
    rotateY: 0,
    opacity: 1,
    transition: { duration: DURATION.drawSlide, ease: EASE_CARD },
  },
};

export const drawSlideTransition: Transition = {
  duration: DURATION.drawSlide,
  ease: EASE_CARD,
};

/**
 * Deal stagger (Req 5.4): 7 cards per seat, dealt round-robin, each card 60ms
 * after the previous. Spread onto a parent `motion` element as `transition`
 * (with `staggerChildren`) or used to compute per-card `delay`.
 */
export const dealStagger: Transition = {
  staggerChildren: DURATION.dealStagger,
};

/** Per-card deal delay for an index in the round-robin order. */
export function dealDelay(index: number): number {
  return index * DURATION.dealStagger;
}

/**
 * Select-card raise (Req 17.3): the tapped hand card rises to its selected
 * position (top offset 0, rotation 0) over 150ms. `raised`/`resting` variants;
 * callers supply the resting rotation/offset via custom or inline values.
 */
export const selectRaise: Variants = {
  resting: { y: 0, rotate: 0 },
  raised: {
    y: -18,
    rotate: 0,
    transition: { duration: DURATION.selectRaise, ease: EASE_CARD },
  },
};

/**
 * Illegal-tap shake (Req 7.3, 17): horizontal shake ±6px, 3 cycles, over
 * 240ms, then settle. Trigger by animating to the `shake` variant.
 */
export const illegalShake: Variants = {
  still: { x: 0 },
  shake: {
    x: [0, -6, 6, -6, 6, -6, 6, 0],
    transition: { duration: DURATION.illegalShake, ease: "easeInOut" },
  },
};

/** The raw keyframe/transition for callers using `animate` controls directly. */
export const illegalShakeKeyframes: Target = {
  x: [0, -6, 6, -6, 6, -6, 6, 0],
};

/**
 * Turn-pill cross-fade (Req 17.4): the pill fades its old content out and the
 * new active player / constraint in when the active player changes.
 */
export const turnCrossFade: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: DURATION.turnCrossFade, ease: EASE_CARD },
  },
  exit: {
    opacity: 0,
    transition: { duration: DURATION.turnCrossFade, ease: EASE_CARD },
  },
};

/**
 * Wild color-change cross-fade (Req 8.3, 17): the direction ring + discard glow
 * cross-fade to the newly chosen suit color over 300ms.
 */
export const wildColorCrossFade: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: DURATION.wildCrossFade, ease: EASE_CARD },
  },
  exit: {
    opacity: 0,
    transition: { duration: DURATION.wildCrossFade, ease: EASE_CARD },
  },
};

/* ------------------------------------------------------------------ */
/* 3. Overlay / drag / pause / confetti presets — SEAM for Task 7.2    */
/*    Declared here so 7.2 extends this module. NOT wired by 7.1.      */
/* ------------------------------------------------------------------ */

/** Menu drawer: slides in from x=100% over 250ms; backdrop fades 0→50% (Req 17.5). */
export const drawerSlide: Variants = {
  hidden: { x: "100%" },
  visible: {
    x: 0,
    transition: { duration: 0.25, ease: EASE_CARD },
  },
  exit: { x: "100%", transition: { duration: 0.25, ease: EASE_CARD } },
};

/** Backdrop fade to 50% opacity (paired with drawer / sheets). */
export const backdropFade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 0.5 },
  exit: { opacity: 0 },
};

/** Bottom sheet: slides up from y=100% (Req 17.9). */
export const sheetSlide: Variants = {
  hidden: { y: "100%" },
  visible: { y: 0, transition: { duration: 0.25, ease: EASE_CARD } },
  exit: { y: "100%", transition: { duration: 0.25, ease: EASE_CARD } },
};

/** Spotlight card scale 0.9 → 1.25 (Req 17.9). */
export const spotlightScale: Variants = {
  hidden: { scale: 0.9 },
  visible: { scale: 1.25, transition: playSpring },
};

/** Dialog: fades and scales 0.96 → 1 over 200ms (Req 17.9). */
export const dialogFade: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.2, ease: EASE_CARD },
  },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.2, ease: EASE_CARD } },
};

/** Toast: slides down 8px + fades in, then out (§5.19). */
export const toastSlide: Variants = {
  hidden: { opacity: 0, y: -8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: EASE_CARD } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2, ease: EASE_CARD } },
};

/** Drag lift/tilt: row scales 1.02, −2° rotation; drop springs to slot (Req 17.8, 21). */
export const dragLift: Variants = {
  resting: { scale: 1, rotate: 0 },
  lifted: { scale: 1.02, rotate: -2 },
};

/** Drop-to-slot spring (Req 17.8). */
export const dropSpring: Transition = playSpring;

/** Pause overlay: fades in with card scale 0.96 → 1; fades out on resume (Req 17.10). */
export const pauseFade: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: EASE_CARD } },
  exit: { opacity: 0, transition: { duration: 0.2, ease: EASE_CARD } },
};

/**
 * Confetti burst (§5.25): pieces burst in once, 900ms. Each piece scales
 * 0 → 1 and settles from a small upward offset. Applied per-piece; the caller
 * supplies each piece's `custom` delay for a lightly staggered burst. Under
 * reduced motion the caller renders the pieces statically (no burst).
 */
export const CONFETTI_BURST_DURATION = 0.9;

export const confettiBurst: Variants = {
  hidden: { opacity: 0, scale: 0, y: -8 },
  burst: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: CONFETTI_BURST_DURATION, ease: EASE_CARD },
  },
};

/**
 * Countdown ring drain (§5.20): the progress stroke drains linearly over the
 * 60s grace period. This is the default full-drain duration; the live value
 * comes from the server-fed remaining time (task 5). Exposed here so the ring
 * animates with a spec timing rather than a scattered magic number.
 */
export const COUNTDOWN_DRAIN_DURATION = 60;

/** Linear transition for the countdown drain (a steady, non-eased sweep). */
export const countdownDrain: Transition = {
  duration: COUNTDOWN_DRAIN_DURATION,
  ease: "linear",
};

/* ------------------------------------------------------------------ */
/* Reduced-motion helpers (Req 17.6)                                   */
/* ------------------------------------------------------------------ */

/** Zero-duration transition used to make any animated move instant. */
export const instant: Transition = { duration: 0 };

/**
 * Given the reduced-motion preference and a normal transition, return the
 * transition to use. Under reduced motion card flights become instant moves to
 * the final position — no travel animation (Req 17.6).
 */
export function motionTransition(
  reduced: boolean,
  normal: Transition,
): Transition {
  return reduced ? instant : normal;
}

/**
 * The shared `layoutId` to apply to a played card. Under reduced motion we
 * return `undefined` so Motion does NOT run a shared-layout flight — the card
 * simply appears at the discard top (Req 17.6 / 17.7 fallback).
 */
export function sharedCardLayoutId(
  reduced: boolean,
  cardId: string,
): string | undefined {
  return reduced ? undefined : cardId;
}
