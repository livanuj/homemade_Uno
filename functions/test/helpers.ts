/**
 * Integration-test harness: drives the deployed callables through the client
 * SDK against the local emulator, exactly as a real app would.
 *
 * Each "client" is a separate Firebase app instance with its own anonymous auth
 * session (so `context.auth.uid` differs per player). Helpers wrap the callables
 * and expose raw Firestore reads (as an admin-like reader that can also read the
 * server-only `private/deck` via the Admin SDK) for assertions.
 */
import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  signInAnonymously,
  type Auth,
} from "firebase/auth";
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  type Firestore,
} from "firebase/firestore";
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
  type Functions,
} from "firebase/functions";

const PROJECT_ID = "homemadeuno";
const FIRESTORE_HOST = "127.0.0.1";
const FIRESTORE_PORT = 8080;
const AUTH_URL = "http://127.0.0.1:9099";
const FUNCTIONS_HOST = "127.0.0.1";
const FUNCTIONS_PORT = 5001;

let seq = 0;

export interface Client {
  app: FirebaseApp;
  auth: Auth;
  functions: Functions;
  db: Firestore;
  uid: string;
  call<TReq, TRes>(name: string, data: TReq): Promise<TRes>;
}

/** Create a fresh client app + anonymous session (a distinct player). */
export async function makeClient(): Promise<Client> {
  const app = initializeApp(
    { projectId: PROJECT_ID, apiKey: "fake-api-key" },
    `client-${Date.now()}-${seq++}`,
  );
  const auth = getAuth(app);
  connectAuthEmulator(auth, AUTH_URL, { disableWarnings: true });
  const functions = getFunctions(app);
  connectFunctionsEmulator(functions, FUNCTIONS_HOST, FUNCTIONS_PORT);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, FIRESTORE_HOST, FIRESTORE_PORT);

  const cred = await signInAnonymously(auth);
  const uid = cred.user.uid;

  return {
    app,
    auth,
    functions,
    db,
    uid,
    async call<TReq, TRes>(name: string, data: TReq): Promise<TRes> {
      const fn = httpsCallable<TReq, TRes>(functions, name);
      const res = await fn(data);
      return res.data;
    },
  };
}

export async function destroyClient(client: Client): Promise<void> {
  await deleteApp(client.app);
}

/** Read the public state doc (client-visible). */
export async function readState(client: Client, roomId: string) {
  const snap = await getDoc(doc(client.db, "rooms", roomId, "state", "current"));
  return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
}

/** Read a hand doc (only works for own/partner per rules; used with own uid). */
export async function readHand(client: Client, roomId: string, playerId: string) {
  const snap = await getDoc(doc(client.db, "rooms", roomId, "hands", playerId));
  return snap.exists() ? (snap.data() as { cards: { id: string }[]; cardCount: number }) : null;
}

export async function readRoom(client: Client, roomId: string) {
  const snap = await getDoc(doc(client.db, "rooms", roomId));
  return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
}

export async function readPlayer(client: Client, roomId: string, playerId: string) {
  const snap = await getDoc(doc(client.db, "rooms", roomId, "players", playerId));
  return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
}

export async function readPlayers(
  client: Client,
  roomId: string,
): Promise<Array<{ id: string } & Record<string, unknown>>> {
  const snap = await getDocs(collection(client.db, "rooms", roomId, "players"));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));
}
