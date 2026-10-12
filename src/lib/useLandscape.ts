import { createContext, useContext } from "react";

/**
 * Which landscape layout is active:
 *  - `wide`: desktop, laptop, tablet on its side (at least 600px tall).
 *  - `compact`: a phone on its side (short and wide) — the same landscape
 *    layouts, with a tighter game table and pages that scroll vertically.
 */
export type LandscapeKind = "wide" | "compact";

/**
 * Whether screens render their landscape layout (see `viewportMode` in
 * `useViewportSupported.ts`), and which kind.
 *
 * App provides a kind for the `landscape` / `compact` viewport modes;
 * everything else (portrait phones, upright tablets, tests, previews) gets the
 * default `null` and renders the portrait layout unchanged. Screens reuse the
 * same components in every layout and only rearrange them.
 */
export const LandscapeContext = createContext<LandscapeKind | null>(null);

/** True in either landscape layout. */
export function useLandscape(): boolean {
  return useContext(LandscapeContext) !== null;
}

/** True only on a phone held sideways (short, wide viewport). */
export function useCompactLandscape(): boolean {
  return useContext(LandscapeContext) === "compact";
}
