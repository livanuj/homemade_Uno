/**
 * Game route — the table screens `03-game-2v2` and `04-game-normal`
 * (design.md §7.2). Mode (2v2 vs. normal), whose turn it is, and the discard
 * state are all *state*, not separate routes, so one component renders both
 * tables from a `GameView`.
 *
 * The view-model comes from the injectable fixtures seam (task 8.1): the two
 * table states map to the `03` / `04` fixtures in `@/game/view/fixtures`,
 * chosen by a `?state=` query param so Playwright (and links) reach each
 * distinct screen. The realtime Firestore wiring + interactions (tap-to-play,
 * draw, wild picker, last-card) land in task 9; here the table renders
 * statically with clean callback seams.
 *
 * The overlays that render OVER this table — the menu drawer / sheets (8.5) and
 * the paused overlay (8.7) — are separate parallel tasks. `GameTable` exposes
 * an `overlay` slot so they can mount over the frame without touching it; 8.4
 * leaves that slot empty.
 */
import { GameTable } from "@/components/GameTable";
import { makeGameView } from "@/game/view/fixtures";
import { useSearchParams } from "react-router-dom";

export function GameRoute() {
  const [params] = useSearchParams();
  const view = makeGameView(params.get("state"));

  return (
    <GameTable
      view={view}
      // Interactions are task 9; the callbacks below are intentional no-ops so
      // the buttons/piles are present and reachable without a backend.
      onMenu={() => {
        /* task 8.5 mounts the menu drawer via the overlay slot */
      }}
      onDraw={() => {
        /* task 9 wires drawOne + the "drew a card" sheet */
      }}
      onCallLastCard={() => {
        /* task 9 wires callLast */
      }}
    />
  );
}
