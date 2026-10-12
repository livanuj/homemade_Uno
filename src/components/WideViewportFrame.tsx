import type { ReactNode } from "react";

/**
 * Phone-width column for upright tablets (the `column` viewport mode).
 *
 * Renders the portrait app unchanged inside a full-height column capped at the
 * widest supported phone (430px, design.md rule 7), centered on a felt
 * backdrop. The backdrop is `fixed inset-0` so it sits outside the shell's
 * safe-area padding and the column gets the full window height, matching the
 * `h-dvh` the game screens size to. `transform-gpu` makes the column the
 * containing block for `position: fixed` descendants, so dialogs, sheets, the
 * menu drawer, and the paused overlay cover the column rather than the window.
 */
export function WideViewportFrame({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 flex justify-center bg-felt-edge">
      <div className="relative h-full w-full max-w-[430px] transform-gpu overflow-hidden bg-paper shadow-panel">
        {children}
      </div>
    </div>
  );
}
