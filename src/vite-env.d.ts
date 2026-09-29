/// <reference types="vite/client" />

/**
 * Typed Vite env vars. All client config comes from `VITE_FIREBASE_*` (public
 * by design — a web app's Firebase config is not a secret; hidden hands are
 * enforced by Security Rules + Cloud Functions, not by hiding these values).
 *
 * `VITE_USE_EMULATOR` (or Vite's own `DEV`) routes the SDK at the local
 * Emulator Suite instead of a real project. See `.env.example`.
 */
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  /** `"true"` to force the Emulator Suite even outside `import.meta.env.DEV`. */
  readonly VITE_USE_EMULATOR?: string;
  /** Emulator host (defaults to `127.0.0.1`). */
  readonly VITE_EMULATOR_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
