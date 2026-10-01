import { useEffect, type RefObject } from "react";

/**
 * useModalA11y — focus management, focus-trap, and Escape handling for modal
 * surfaces: dialogs, bottom sheets, the menu drawer, the wild color picker, and
 * the paused overlay (Requirements 18.6, 18.9, 18.10, 21.6-adjacent).
 *
 * When a modal opens it must take keyboard focus, keep Tab within it, and give
 * focus back to whatever opened it on close so a keyboard / screen-reader user
 * is never stranded on the inert page behind the overlay. Escape closes most
 * modals, but NOT the wild color picker or the paused overlay — those are
 * decision gates the player must resolve, so callers pass `escapeCloses: false`
 * for them (Req 18.10).
 *
 * Behavior while `open`:
 *   - On open: moves focus to the first focusable element inside `ref`
 *     (falling back to the container itself).
 *   - Tab / Shift+Tab wrap within the container (focus trap, Req 18.6).
 *   - Escape calls `onClose` when `escapeCloses` (default true), Req 18.9.
 *   - On close / unmount: returns focus to the element that was focused when the
 *     modal opened (usually the trigger), Req 18.9.
 *
 * This is non-visual (no tokens; token-policy.md N/A). It drives only focus and
 * key handling; the visible overlay styling stays in each component.
 */
export interface ModalA11yOptions {
  /** Whether the modal is currently open. The hook is inert when false. */
  open: boolean;
  /** Called to request a close (Escape, when `escapeCloses`). */
  onClose: () => void;
  /**
   * Whether Escape closes this modal. Defaults to true. Pass `false` for the
   * wild color picker and the paused overlay (Req 18.10) so Escape is ignored.
   */
  escapeCloses?: boolean;
}

/** CSS selector for the natively focusable elements we trap within. */
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableWithin(container: HTMLElement): HTMLElement[] {
  // Exclude elements explicitly hidden from AT or layout. We deliberately do
  // not test `offsetParent`/layout boxes: jsdom performs no layout, and the
  // modal is always a visible overlay when `open`, so a hidden-attribute check
  // is both sufficient and testable.
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute("hidden") && el.getAttribute("aria-hidden") !== "true",
  );
}

export function useModalA11y(
  ref: RefObject<HTMLElement | null>,
  { open, onClose, escapeCloses = true }: ModalA11yOptions,
): void {
  useEffect(() => {
    if (!open) {
      return;
    }
    const container = ref.current;
    if (!container) {
      return;
    }

    // Remember who had focus so we can restore it on close (Req 18.9).
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Move focus into the modal (Req 18.6). First focusable, else the container.
    const initial = focusableWithin(container)[0] ?? container;
    if (initial === container && !container.hasAttribute("tabindex")) {
      container.setAttribute("tabindex", "-1");
    }
    initial.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (escapeCloses) {
          event.preventDefault();
          onClose();
        }
        return;
      }
      if (event.key !== "Tab" || !container) {
        return;
      }
      // Focus trap: wrap at the ends (Req 18.6).
      const focusables = focusableWithin(container);
      if (focusables.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === first || !container.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !container.contains(active)) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      // Return focus to the trigger on close / unmount (Req 18.9).
      previouslyFocused?.focus?.();
    };
  }, [open, onClose, escapeCloses, ref]);
}
