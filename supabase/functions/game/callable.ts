/**
 * Minimal callable-function surface for the game handlers: `onCall` wraps a
 * handler so the router can run it, and `HttpsError` is a structured error
 * whose `code` (e.g. `not-found`, `failed-precondition`) reaches the client as
 * the call's `reason`.
 */

export type ErrorCode =
  | "invalid-argument"
  | "unauthenticated"
  | "permission-denied"
  | "not-found"
  | "already-exists"
  | "failed-precondition"
  | "resource-exhausted"
  | "aborted"
  | "internal";

export class HttpsError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface CallableRequest<T = unknown> {
  /** The signed-in caller; absent when the request had no valid session. */
  readonly auth?: { readonly uid: string };
  readonly data: T;
}

export interface Callable {
  run(request: CallableRequest<any>): Promise<unknown>;
}

// deno-lint-ignore no-explicit-any
export function onCall(handler: (request: CallableRequest<any>) => Promise<unknown>): Callable {
  return { run: handler };
}
