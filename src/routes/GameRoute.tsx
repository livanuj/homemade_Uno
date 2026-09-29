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
 * The in-game overlays (task 8.5) render OVER this table through the
 * `GameTable` `overlay` slot, reached by an `?overlay=` query param
 * (`menu | wild | drew | disconnected | leave`) so Playwright and links reach
 * each distinct state. `05-menu` / `06a` / `06b` / `06d` float over the table;
 * `06c-player-disconnected` is a table STATE — the route marks the disconnected
 * seat offline on the `GameView` and feeds the table a `seatCountdown` so its
 * `OfflineAvatar` drains, while the waiting pill + toast + "Pause and wait" chip
 * come from the overlay slot.
 *
 * The paused overlays (task 8.7) reuse the SAME `?overlay=` seam with DISTINCT
 * values (`paused-break | paused-waiting | paused-auto`) so they never collide
 * with 8.5's overlay ids. When one is present the route composes `PausedOverlay`
 * over the table (choosing the underlying table from the fixture's `tableState`)
 * and takes precedence over the 8.5 branch; the menu button in the top bar stays
 * reachable behind it (Req 25.15). The resume / continue / end-game wiring is
 * task 9.6 — the primary handler is an intentional no-op here.
 */
import { GameOverlays } from "@/components/GameOverlays";
import { GameTable } from "@/components/GameTable";
import { PausedOverlay } from "@/components/PausedOverlay";
import { makeGameView, makePausedView } from "@/game/view/fixtures";
import { isOverlayId, makeOverlayView } from "@/game/view/overlays";
import type { GameView } from "@/game/view/types";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

export function GameRoute() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { code } = useParams();
  const reduced = usePrefersReducedMotion();

  const overlayParam = params.get("overlay");

  // A paused overlay (8.7) takes precedence and selects its own underlying
  // table (`08a` over 2v2, `08b`/`08c` over normal). It reuses the `?overlay=`
  // seam with distinct `paused-*` values, so it never collides with 8.5.
  const paused = makePausedView(overlayParam);
  const baseView = makeGameView(
    paused ? paused.tableState : params.get("state"),
  );

  const overlay = isOverlayId(overlayParam) ? overlayParam : null;
  const overlayData = makeOverlayView(overlayParam);

  // `06c-player-disconnected` is a table state: mark the disconnected seat
  // offline on the view and hand the table a per-seat grace countdown so its
  // `OfflineAvatar` drains. Everything else renders the plain table.
  const dc = overlay === "disconnected" ? overlayData.disconnected : undefined;
  const view: GameView = dc
    ? {
        ...baseView,
        opponents: baseView.opponents.map((seat) =>
          seat.id === dc.playerId ? { ...seat, connection: "offline" } : seat,
        ),
      }
    : baseView;

  const seatCountdown = dc
    ? {
        [dc.playerId]: {
          progress: dc.secondsLeft / (dc.graceSeconds ?? 60),
          secondsLeft: dc.secondsLeft,
        },
      }
    : undefined;

  return (
    <GameTable
      view={view}
      {...(seatCountdown ? { seatCountdown } : {})}
      // Interactions are task 9; the callbacks below are intentional seams so
      // the buttons/piles are present and reachable without a backend.
      onMenu={() => {
        // Opening the drawer flips `?overlay=menu`; task 9 replaces this with
        // real menu state once the realtime layer lands.
        const next = new URLSearchParams(params);
        next.set("overlay", "menu");
        navigate(`?${next.toString()}`);
      }}
      onDraw={() => {
        /* task 9 wires drawOne + the "drew a card" sheet */
      }}
      onCallLastCard={() => {
        /* task 9 wires callLast */
      }}
      overlay={
        paused ? (
          <PausedOverlay
            variant={paused.variant}
            title={paused.title}
            body={paused.body}
            elapsedLabel={paused.elapsedLabel}
            reduced={reduced}
            {...(paused.offlineName ? { offlineName: paused.offlineName } : {})}
            {...(paused.offlineCardCount !== undefined
              ? { offlineCardCount: paused.offlineCardCount }
              : {})}
            {...(paused.offlineTeam ? { offlineTeam: paused.offlineTeam } : {})}
            {...(paused.primaryCaption
              ? { primaryCaption: paused.primaryCaption }
              : {})}
            onPrimary={() => {
              /* task 9.6 wires resume / continueWithout / endGame */
            }}
          />
        ) : overlay ? (
          <GameOverlays
            overlay={overlay}
            view={view}
            data={overlayData}
            onHowToPlay={() => navigate("/how-to-play")}
            onClose={() => {
              const next = new URLSearchParams(params);
              next.delete("overlay");
              const qs = next.toString();
              navigate(qs ? `?${qs}` : `/room/${code}/game`);
            }}
          />
        ) : undefined
      }
    />
  );
}
