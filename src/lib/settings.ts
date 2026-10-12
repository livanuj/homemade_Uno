/**
 * Device-local settings store (Req 1.7, 1.12, 16.7).
 *
 * Everything here persists to `localStorage` on the device — the display name
 * a player picks and the three game toggles (Sound effects, Vibration,
 * Highlight playable cards). This is the "on device" storage the design calls
 * for (design.md §5.23), separate from any room/backend state: the Firebase
 * backend is deferred, and these preferences never belong on the server anyway.
 *
 * The Home screen, Settings screen, and in-game menu all read/write the same
 * store through the small `useSettings` hook so the name and toggles stay in
 * sync across the app and survive a reload.
 */
import { useCallback, useSyncExternalStore } from "react";

/** The three game toggles plus the device display name. */
export interface Settings {
  /** Display name others see at the table (1–16 chars, trimmed). */
  name: string;
  /** Play card/shuffle/last-card sounds. */
  sound: boolean;
  /** Buzz on your turn — only meaningful where the device supports vibration. */
  vibration: boolean;
  /** Dim the cards you can't play. */
  highlight: boolean;
}

/** Max length of the display name (Req 1.12). */
export const NAME_MAX_LENGTH = 16;

/** localStorage key holding the JSON-encoded settings. */
const STORAGE_KEY = "uno.settings";

/** Sensible defaults — all game aids on, empty name until the player sets one. */
export const DEFAULT_SETTINGS: Settings = {
  name: "",
  sound: true,
  vibration: true,
  highlight: true,
};

/**
 * True when the device exposes the Vibration API. iPhones (iOS Safari) do not,
 * so the Vibration row is hidden there (Req 16.7). Guarded for non-browser
 * (test / SSR) environments where `navigator` may be undefined.
 */
export function supportsVibration(): boolean {
  return typeof navigator !== "undefined" && "vibrate" in navigator;
}

/**
 * Clamp a raw name to the stored form: trimmed of surrounding whitespace and
 * capped at {@link NAME_MAX_LENGTH} characters (Req 1.12). Empty is allowed as
 * a stored value (the player simply hasn't chosen a name yet).
 */
export function clampName(raw: string): string {
  return raw.trim().slice(0, NAME_MAX_LENGTH);
}

function safeParse(raw: string | null): Settings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      name: typeof parsed.name === "string" ? clampName(parsed.name) : "",
      sound: parsed.sound ?? DEFAULT_SETTINGS.sound,
      vibration: parsed.vibration ?? DEFAULT_SETTINGS.vibration,
      highlight: parsed.highlight ?? DEFAULT_SETTINGS.highlight,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function readSettings(): Settings {
  if (typeof localStorage === "undefined") return DEFAULT_SETTINGS;
  return safeParse(localStorage.getItem(STORAGE_KEY));
}

/**
 * A cached snapshot so `useSyncExternalStore` gets a stable reference between
 * renders (returning a fresh object each call would loop). Recomputed only when
 * a write goes through {@link writeSettings}.
 */
let snapshot: Settings = readSettings();

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Reflect changes made in another tab/window.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      snapshot = readSettings();
      listener();
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

function getSnapshot(): Settings {
  return snapshot;
}

/** Persist a patch and notify subscribers. Names are always clamped on write. */
export function writeSettings(patch: Partial<Settings>): void {
  const next: Settings = { ...snapshot, ...patch };
  if (patch.name !== undefined) next.name = clampName(patch.name);
  snapshot = next;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  emit();
}

/** Read the current device settings without subscribing (one-off reads). */
export function getSettings(): Settings {
  return snapshot;
}

/**
 * Subscribe a component to the device settings. Returns the current settings
 * plus a `set` that persists a patch (and re-renders every subscriber). Reusable
 * by Home, Settings, and the in-game menu.
 */
export function useSettings(): {
  settings: Settings;
  set: (patch: Partial<Settings>) => void;
} {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const set = useCallback((patch: Partial<Settings>) => writeSettings(patch), []);
  return { settings, set };
}
