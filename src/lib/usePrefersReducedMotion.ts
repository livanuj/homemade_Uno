import { useEffect, useState } from "react";

/**
 * `prefers-reduced-motion` hook (Requirement 17.6).
 *
 * Reads the OS-level "reduce motion" preference via the
 * `(prefers-reduced-motion: reduce)` media query and re-renders when the user
 * flips it. Motion presets and animated components gate on this value so that,
 * when reduced motion is requested:
 *   - card flights become instant moves to the final position (no travel),
 *   - the turn-ring pulse is removed, and
 *   - confetti renders statically.
 *
 * `theme.css` already neutralizes CSS-driven animations under the same query;
 * this hook lets JS-driven Motion animations honor the same preference so the
 * two never disagree (animation.md).
 */
const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Pure predicate: does this MediaQueryList indicate reduced motion is on?
 * Extracted so the boundary can be unit-tested without a DOM.
 */
export function prefersReducedMotion(mql: Pick<MediaQueryList, "matches">): boolean {
  return mql.matches;
}

function readInitial(): boolean {
  // Guard for non-DOM environments (SSR / tests without matchMedia): default
  // to "motion allowed" so behavior is unchanged where the query is absent.
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(QUERY).matches;
}

/**
 * React hook returning `true` when the user prefers reduced motion. Subscribes
 * to changes and cleans up its listener on unmount. Supports both the modern
 * `addEventListener("change", …)` API and the legacy `addListener` fallback.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(readInitial);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mql = window.matchMedia(QUERY);

    function update(event: MediaQueryListEvent | MediaQueryList) {
      setReduced(event.matches);
    }

    // Sync immediately in case the preference changed between the initial
    // render and effect commit.
    update(mql);

    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", update);
      return () => mql.removeEventListener("change", update);
    }

    // Legacy Safari (<14) fallback.
    mql.addListener(update);
    return () => mql.removeListener(update);
  }, []);

  return reduced;
}
