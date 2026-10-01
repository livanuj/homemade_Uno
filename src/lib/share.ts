/**
 * Invite-link sharing helpers (Task 9.1, Req 1.4/1.5/1.6).
 *
 * `copyToClipboard` writes text to the clipboard and reports success/failure so
 * the caller can show a confirmation toast, or a manual-copy fallback when the
 * Clipboard API is unavailable or blocked (Req 1.5).
 *
 * `shareInvite` opens the native share sheet when supported (`navigator.share`),
 * and otherwise falls back to copying the link to the clipboard (Req 1.6). It
 * distinguishes a real share, a clipboard fallback, and a user-cancel so the UI
 * can react appropriately.
 *
 * Both are defensive: no throw escapes, and they degrade gracefully in
 * environments without the relevant APIs (older browsers, tests).
 */

/**
 * Copy `text` to the clipboard. Returns `true` on success, `false` when the
 * Clipboard API is missing or the write is rejected (permission / insecure
 * context) so the caller can present a manual-copy fallback.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy fallback / failure
  }

  // Legacy fallback for browsers without the async Clipboard API.
  try {
    if (typeof document !== "undefined" && document.body) {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "absolute";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand?.("copy") ?? false;
      document.body.removeChild(area);
      return ok;
    }
  } catch {
    // ignore
  }
  return false;
}

/** The payload passed to the native share sheet. */
export interface ShareData {
  title: string;
  text: string;
  url: string;
}

/** Outcome of a share attempt. */
export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

/**
 * Share `data` via the native share sheet when available, else copy the URL to
 * the clipboard as a fallback (Req 1.6). A user-cancelled native share resolves
 * to `"cancelled"` (an `AbortError`), not an error.
 */
export async function shareInvite(data: ShareData): Promise<ShareResult> {
  if (
    typeof navigator !== "undefined" &&
    typeof (navigator as Navigator & { share?: unknown }).share === "function"
  ) {
    try {
      await navigator.share(data);
      return "shared";
    } catch (err: unknown) {
      // The user dismissing the sheet throws an AbortError — not a failure.
      if (
        typeof err === "object" &&
        err !== null &&
        "name" in err &&
        (err as { name: unknown }).name === "AbortError"
      ) {
        return "cancelled";
      }
      // Any other share error falls back to clipboard.
    }
  }
  const copied = await copyToClipboard(data.url);
  return copied ? "copied" : "failed";
}

/**
 * Build the shareable invite link for a room code, RELATIVE to wherever the app
 * is actually served (Req 1.4). The link points at the Home route with the code
 * prefilled via `?code=…`, which `HomeRoute` reads to pre-populate the join
 * field. We never hardcode a domain: the origin is read from
 * `window.location.origin` at call time so the link is correct whether the app
 * runs on localhost, a Firebase Hosting URL, or a custom domain.
 *
 * In a non-DOM context (tests / SSR) there is no origin, so we return a
 * root-relative URL (`/?code=…`) — still a valid, shareable path.
 */
export function inviteLinkForCode(code: string): string {
  const path = `/?code=${encodeURIComponent(code)}`;
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
}
