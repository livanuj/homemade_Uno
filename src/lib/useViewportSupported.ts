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
