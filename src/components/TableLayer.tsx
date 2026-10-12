import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * The landscape table's 1280×800 stage element, provided by `GameTable` to its
 * overlay slot (null in portrait, where the overlay already renders inside the
 * table).
 */
export const TableStageContext = createContext<HTMLElement | null>(null);

/**
 * Renders overlay pieces that are anchored to the table — the disconnected
 * toast and waiting pill, the drawn-card spotlight — in table coordinates.
 *
 * In landscape the overlay slot sits outside the scaled stage (so sheets and
 * dialogs cover the whole window unscaled); `TableLayer` portals its children
 * into the stage so they scale and line up with the table. In portrait it
 * renders them in place.
 */
export function TableLayer({ children }: { children: ReactNode }) {
  const stage = useContext(TableStageContext);
  return stage ? createPortal(children, stage) : <>{children}</>;
}
