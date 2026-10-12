import { useEffect, useState } from "react";

/**
 * Supported viewport bounds (Requirement 16.4 / 16.8).
 *
 * The app targets portrait phones. Width must fall within [360, 430] pixels
 * (inclusive) and the orientation must be portrait — i.e. height is at least
 * width. Anything narrower, wider, or landscape is unsupported and the app
 * shows the {@link UnsupportedViewport} guard instead of the game/lobby.
 */
export const MIN_SUPPORTED_WIDTH = 360;
export const MAX_SUPPORTED_WIDTH = 430;

interface Viewport {
  width: number;
  height: number;
}

/**
 * Pure predicate: is this viewport supported?
 *
 * Supported ⇔ width in [360, 430] inclusive AND portrait (height >= width,
 * i.e. not landscape). Kept pure (no DOM access) so the boundary logic can be
 * unit-tested directly.
 */
export function isViewportSupported({ width, height }: Viewport): boolean {
  const withinWidth =
    width >= MIN_SUPPORTED_WIDTH && width <= MAX_SUPPORTED_WIDTH;
  const isPortrait = height >= width;
  return withinWidth && isPortrait;
}

function readViewport(): Viewport {
  return { width: window.innerWidth, height: window.innerHeight };
}

/**
 * React hook: whether the current viewport is a supported portrait phone size.
 *
 * Re-evaluates on `resize` and `orientationchange` and cleans up both
 * listeners on unmount. See {@link isViewportSupported} for the rule.
 */
export function useViewportSupported(): boolean {
  const [supported, setSupported] = useState(() =>
    isViewportSupported(readViewport()),
  );

  useEffect(() => {
    function update() {
      setSupported(isViewportSupported(readViewport()));
    }

    // Re-check immediately in case the viewport changed between the initial
    // render and effect commit.
    update();

    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return supported;
}

/**
 * Shortest viewport (px) for the full landscape layout. Laptop browsers sit
 * around 650–800px tall once browser chrome is subtracted; a phone on its side
 * (≤ ~430px tall) is below this and gets the compact landscape layout.
 */
export const MIN_WIDE_HEIGHT = 600;

/**
 * Shortest viewport (px) for the compact landscape layout (a phone on its
 * side, including Safari with its toolbars showing). Anything shorter keeps the
 * guard.
 */
export const MIN_COMPACT_HEIGHT = 300;

/**
 * How the app should render for a viewport:
 *  - `phone`: the existing portrait-phone rule ({@link isViewportSupported})
 *    holds — render full-bleed, exactly as before.
 *  - `landscape`: wider than a phone, at least {@link MIN_WIDE_HEIGHT} tall,
 *    and at least as wide as it is tall (desktop, laptop, tablet on its side).
 *  - `compact`: wider than tall but under {@link MIN_WIDE_HEIGHT} (a phone on
 *    its side) — the landscape layouts, compacted to the short height.
 *  - `column`: wider than a phone but taller than wide (an upright tablet) —
 *    the portrait layouts in a centered phone-width column.
 *  - `unsupported`: too narrow, or shorter than {@link MIN_COMPACT_HEIGHT} —
 *    show the guard.
 */
export type ViewportMode =
  | "phone"
  | "landscape"
  | "compact"
  | "column"
  | "unsupported";

export function viewportMode(viewport: Viewport): ViewportMode {
  const { width, height } = viewport;
  if (isViewportSupported(viewport)) return "phone";
  if (width <= MAX_SUPPORTED_WIDTH) return "unsupported";
  if (width >= height) {
    if (height >= MIN_WIDE_HEIGHT) return "landscape";
    if (height >= MIN_COMPACT_HEIGHT) return "compact";
    return "unsupported";
  }
  return height >= MIN_WIDE_HEIGHT ? "column" : "unsupported";
}

/**
 * React hook: the current {@link ViewportMode}, re-evaluated on `resize` and
 * `orientationchange` like {@link useViewportSupported}.
 */
export function useViewportMode(): ViewportMode {
  const [mode, setMode] = useState(() => viewportMode(readViewport()));

  useEffect(() => {
    function update() {
      setMode(viewportMode(readViewport()));
    }

    update();

    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return mode;
}
