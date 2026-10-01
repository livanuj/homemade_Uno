/**
 * The typed Firebase client — the single place the app initializes the SDK.
 *
 * Exposes the initialized `app`, `db` (Firestore), `auth`, and `functions`.
 * In development (or when `VITE_USE_EMULATOR === "true"`) it wires every
 * service to the local Emulator Suite via `connect*Emulator`, so no real
 * project is contacted. See `.kiro/steering/conventions/firestore-data.md`
 * ("Local development" → Emulator Suite) and `.env.example`.
 *
 * The game is server-authoritative: clients only read Security-Rules-scoped
 * documents and call Cloud Functions. This module holds no game logic.
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  type Auth,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from "firebase/firestore";
import {
  connectFunctionsEmulator,
  getFunctions,
  type Functions,
} from "firebase/functions";

/** Default emulator ports — kept in sync with `firebase.json`. */
const EMULATOR_PORTS = {
  auth: 9099,
  firestore: 8080,
  functions: 5001,
} as const;

/**
 * Whether to route the SDK at the local Emulator Suite. True under Vite's
 * `DEV` or when `VITE_USE_EMULATOR` is explicitly `"true"` (e.g. a prod-like
 * build pointed at emulators for testing).
 */
export function useEmulator(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_USE_EMULATOR === "true";
}

/**
 * Firebase web config, read from the `VITE_FIREBASE_*` env (see `.env` /
 * `.env.example`). Each value coalesces to an empty string so the shape is a
 * `FirebaseOptions` with all-`string` properties (strict `exactOptional
 * PropertyTypes`); in real use the env supplies the project values, and when
 * targeting the Emulator Suite the SDK never contacts a real backend so empty
 * strings are harmless. `authDomain` / `storageBucket` fall back to the
 * conventional `${projectId}` forms when their own env vars are unset.
 */
function firebaseConfig() {
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "";
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "",
    authDomain:
      import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ??
      (projectId ? `${projectId}.firebaseapp.com` : ""),
    projectId,
    storageBucket:
      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ??
      (projectId ? `${projectId}.appspot.com` : ""),
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "",
  };
}

/** Guard so `connect*Emulator` runs once even across HMR reloads. */
let emulatorsConnected = false;

function connectEmulators(
  authInstance: Auth,
  dbInstance: Firestore,
  functionsInstance: Functions,
): void {
  if (emulatorsConnected) return;
  emulatorsConnected = true;

  const host = import.meta.env.VITE_EMULATOR_HOST ?? "127.0.0.1";
  connectAuthEmulator(authInstance, `http://${host}:${EMULATOR_PORTS.auth}`, {
    disableWarnings: true,
  });
  connectFirestoreEmulator(dbInstance, host, EMULATOR_PORTS.firestore);
  connectFunctionsEmulator(functionsInstance, host, EMULATOR_PORTS.functions);
}

/** Reuse an existing app across HMR reloads rather than re-initializing. */
export const app: FirebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig());

export const db: Firestore = getFirestore(app);
export const auth: Auth = getAuth(app);
export const functions: Functions = getFunctions(app);

if (useEmulator()) {
  connectEmulators(auth, db, functions);
}
