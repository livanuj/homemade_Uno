/**
 * Room document store over Postgres (`public.room_docs`), with a small
 * transaction API shaped like the slice of the Firestore Admin SDK the game
 * handlers use: `runTransaction`, `tx.get` (a document or a collection),
 * `tx.set`, `tx.update`, `tx.delete`.
 *
 * A transaction is scoped to ONE room. On first read it loads every document
 * of that room plus the room's revision; writes are buffered and committed
 * atomically by `commit_room`, which refuses the commit if another commit
 * landed in between. The transaction function is then re-run against fresh
 * data, exactly like a Firestore transaction retry.
 *
 * Runs with the service role, so Row Level Security does not apply here; the
 * draw pile (`private/deck`) is only ever read on this side.
 */
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.117.3";

/** Reference to one document: `{ roomId, path }`. */
export interface DocRef<T> {
  readonly kind: "doc";
  readonly roomId: string;
  readonly path: string;
  /** The last path segment (Firestore's `ref.id`). */
  readonly id: string;
  /** Phantom field carrying the document type. */
  readonly __type?: T;
}

/** Reference to every document under a path prefix, e.g. `players/`. */
export interface CollectionRef<T> {
  readonly kind: "collection";
  readonly roomId: string;
  readonly prefix: string;
  /** A new document in this collection with a random id. */
  doc(): DocRef<T>;
  readonly __type?: T;
}

export function docRef<T>(roomId: string, path: string): DocRef<T> {
  return { kind: "doc", roomId, path, id: path.slice(path.lastIndexOf("/") + 1) };
}

export function collectionRef<T>(roomId: string, prefix: string): CollectionRef<T> {
  return {
    kind: "collection",
    roomId,
    prefix,
    doc: () => docRef<T>(roomId, `${prefix}${crypto.randomUUID()}`),
  };
}

export interface DocSnapshot<T> {
  readonly id: string;
  readonly exists: boolean;
  data(): T | undefined;
}

export interface QuerySnapshot<T> {
  readonly docs: { id: string; data(): T }[];
  readonly empty: boolean;
  readonly size: number;
}

type Op =
  | { op: "set"; path: string; doc: unknown }
  | { op: "update"; path: string; doc: unknown }
  | { op: "delete"; path: string };

/** Thrown when a transaction keeps losing the race; surfaces as `aborted`. */
export class TransactionContention extends Error {}

const MAX_ATTEMPTS = 6;

let admin: SupabaseClient | null = null;

/** Service-role client (bypasses RLS). Created once per worker. */
export function adminClient(): SupabaseClient {
  if (!admin) {
    admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return admin;
}

/** Deep copy so handler code can never mutate the loaded snapshot. */
function clone<T>(value: T): T {
  return structuredClone(value);
}

export class Transaction {
  private roomId: string | null = null;
  private rev = 0;
  private docs = new Map<string, unknown>();
  private ops: Op[] = [];

  private async ensureLoaded(roomId: string): Promise<void> {
    if (this.roomId === roomId) return;
    if (this.roomId !== null) {
      throw new Error(`A transaction spans one room (got ${this.roomId} and ${roomId}).`);
    }
    this.roomId = roomId;
    const db = adminClient();
    const [docs, rev] = await Promise.all([
      db.from("room_docs").select("path, doc").eq("room_id", roomId),
      db.from("room_revs").select("rev").eq("room_id", roomId).maybeSingle(),
    ]);
    if (docs.error) throw docs.error;
    if (rev.error) throw rev.error;
    for (const row of docs.data ?? []) this.docs.set(row.path as string, row.doc);
    this.rev = (rev.data?.rev as number | undefined) ?? 0;
  }

  private claim(roomId: string): void {
    if (this.roomId === null) this.roomId = roomId;
    else if (this.roomId !== roomId) {
      throw new Error(`A transaction spans one room (got ${this.roomId} and ${roomId}).`);
    }
  }

  get<T>(ref: DocRef<T>): Promise<DocSnapshot<T>>;
  get<T>(ref: CollectionRef<T>): Promise<QuerySnapshot<T>>;
  async get<T>(ref: DocRef<T> | CollectionRef<T>): Promise<DocSnapshot<T> | QuerySnapshot<T>> {
    await this.ensureLoaded(ref.roomId);
    if (ref.kind === "doc") {
      const raw = this.docs.get(ref.path);
      return {
        id: ref.id,
        exists: raw !== undefined,
        data: () => (raw === undefined ? undefined : clone(raw as T)),
      };
    }
    const docs = [...this.docs.entries()]
      .filter(([path]) => path.startsWith(ref.prefix) && !path.slice(ref.prefix.length).includes("/"))
      .map(([path, raw]) => ({ id: path.slice(ref.prefix.length), data: () => clone(raw as T) }));
    return { docs, empty: docs.length === 0, size: docs.length };
  }

  set<T>(ref: DocRef<T>, doc: T): this {
    this.claim(ref.roomId);
    this.ops.push({ op: "set", path: ref.path, doc: stripUndefined(doc) });
    return this;
  }

  update<T>(ref: DocRef<T>, patch: Partial<T>): this {
    this.claim(ref.roomId);
    this.ops.push({ op: "update", path: ref.path, doc: stripUndefined(patch) });
    return this;
  }

  delete<T>(ref: DocRef<T>): this {
    this.claim(ref.roomId);
    this.ops.push({ op: "delete", path: ref.path });
    return this;
  }

  /** Commit buffered writes. Resolves false when the room changed underneath. */
  async commit(): Promise<boolean> {
    if (this.ops.length === 0 || this.roomId === null) return true;
    const { data, error } = await adminClient().rpc("commit_room", {
      p_room: this.roomId,
      p_rev: this.rev,
      p_ops: this.ops,
    });
    if (error) throw error;
    return (data as number) !== -1;
  }
}

/**
 * Run `fn` in a room transaction, retrying on contention (Firestore
 * semantics). `fn` must be side-effect free apart from `tx` writes.
 */
export async function runTransaction<R>(fn: (tx: Transaction) => Promise<R>): Promise<R> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const tx = new Transaction();
    const result = await fn(tx);
    if (await tx.commit()) return result;
  }
  throw new TransactionContention("The room is busy; try again.");
}

/** JSON has no `undefined`; drop such keys like Firestore's ignoreUndefinedProperties. */
function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
