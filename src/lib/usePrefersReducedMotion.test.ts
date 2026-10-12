import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  prefersReducedMotion,
  usePrefersReducedMotion,
} from "./usePrefersReducedMotion";

/**
 * A minimal fake MediaQueryList that records listeners and lets a test flip
 * `matches` and fire a `change` event — mirroring how the browser notifies the
 * hook when the OS "reduce motion" preference toggles (Req 17.6).
 */
function installMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<(e: MediaQueryListEvent) => void>();

  const mql = {
    get matches() {
      return matches;
    },
    media: "(prefers-reduced-motion: reduce)",
    addEventListener: (_type: string, cb: (e: MediaQueryListEvent) => void) =>
      listeners.add(cb),
    removeEventListener: (_type: string, cb: (e: MediaQueryListEvent) => void) =>
      listeners.delete(cb),
    // legacy no-ops so the modern path is exercised
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
    onchange: null,
  } as unknown as MediaQueryList;

  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => mql),
  );

  return {
    /** Simulate the user toggling the OS reduced-motion preference. */
    set(next: boolean) {
      matches = next;
      listeners.forEach((cb) =>
        cb({ matches } as MediaQueryListEvent),
      );
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("prefersReducedMotion", () => {
  it("mirrors the media query's matches flag", () => {
    expect(prefersReducedMotion({ matches: true })).toBe(true);
    expect(prefersReducedMotion({ matches: false })).toBe(false);
  });
});

describe("usePrefersReducedMotion", () => {
  it("returns true when the media query matches", () => {
    installMatchMedia(true);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
  });

  it("returns false when the media query does not match", () => {
    installMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  it("updates when the preference changes at runtime", () => {
    const media = installMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);

    act(() => media.set(true));
    expect(result.current).toBe(true);

    act(() => media.set(false));
    expect(result.current).toBe(false);
  });
});
