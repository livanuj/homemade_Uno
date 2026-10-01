/**
 * Game route — the table screens `03-game-2v2` / `04-game-normal` plus every
 * in-game overlay (menu, wild picker, drew sheet, disconnected state, leave
 * confirm) and the paused overlays (design.md §7.2, §5.10/§5.15–§5.20, §11/§12).
 *
 * Two containers feed one presentational `GameTable`:
 *  - `LiveGame` (the real route): subscribes to the room's realtime channel
 *    (`useRoomChannel`), derives the `GameView` / overlay selection / paused
 *    view from live state through `mappers.ts`, and wires every action to the
 *    versioned action client (playCard/drawOne/chooseColor/keep/callLast/pause/
 *    resume/continueWithout/endGame/leave). It also drives the server-enforced
 *    grace check (`enforceGrace`) on an interval and surfaces toasts for
 *    penalty/skip/reverse/last-card/lost-connection events (Task 9.4/9.6).
 *  - `FixtureGame` (preview/tests): when a `?state=` or `?overlay=` param is
 *    present, renders the Task-8 fixture so Playwright captures and the existing
 *    overlay/table unit tests keep working deterministically.
 *
 * The optimistic play + illegal-tap revert works over `callAction`: tapping a
 * hand card raises it (optimistic `pendingAction`) and calls `playCard`; a
 * server rejection is recorded on the store's `rejection`, which the live
 * container turns into a one-shot shake on that card (Req 7.3) and reverts to
 * the last confirmed snapshot. Accepts arrive via the `onSnapshot` listeners.
 */
import { GameOverlays } from "@/components/GameOverlays";
import { GameTable } from "@/components/GameTable";
import { PausedOverlay } from "@/components/PausedOverlay";
import type { Suit } from "@/design/suits";
import { useSession } from "@/firebase/useSession";
import { makeGameView, makePausedView } from "@/game/view/fixtures";
import {
  selectAutoOverlay,
  toGameView,
  toPausedView,
} from "@/game/view/mappers";
import {
  isOverlayId,
  makeOverlayView,
  type OverlayId,
  type OverlayView,
} from "@/game/view/overlays";
import type { GameView } from "@/game/view/types";
import { useSettings } from "@/lib/settings";
import { copyToClipboard } from "@/lib/share";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { useRoomChannel } from "@/realtime/useRoomChannel";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

/** The real route dispatches to a fixture preview or the live game. */
export function GameRoute() {
  const [params] = useSearchParams();
  const preview = params.get("state") || params.get("overlay");
  if (preview) return <FixtureGame />;
  return <LiveGame />;
}

/** How often connected clients ask the server to enforce grace (Task 5.4). */
const GRACE_POLL_MS = 5000;

// ---------------------------------------------------------------------------
// Live container (the real route).
// ---------------------------------------------------------------------------

function LiveGame() {
  const navigate = useNavigate();
  const { code } = useParams();
  const { playerId } = useSession();
  const roomId = code ?? null;
  const { store, actions } = useRoomChannel(roomId, playerId);
  const reduced = usePrefersReducedMotion();
  const { settings } = useSettings();

  // A ticking clock so the grace countdown + "Paused for m:ss" advance.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Local UI: whether the user opened the menu / leave dialog (these are
  // user-driven, not server-driven, so they live here).
  const [menuOverlay, setMenuOverlay] = useState<OverlayId | null>(null);
  // The card id currently shaking from an illegal-tap rejection (Req 7.3).
  const [shakeCardId, setShakeCardId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const view = useMemo(() => toGameView(store), [store]);
  const paused = useMemo(() => toPausedView(store, nowMs), [store, nowMs]);
  const auto = useMemo(() => selectAutoOverlay(store, nowMs), [store, nowMs]);

  // Turn a server rejection of the LAST tapped card into a one-shot shake +
  // revert (the store already dropped the optimistic pending action).
  const lastRejectionAt = useRef(0);
  useEffect(() => {
    const r = store.rejection;
    if (!r || r.at === lastRejectionAt.current) return;
    lastRejectionAt.current = r.at;
    if (r.kind === "play" && store.pendingAction === null) {
      // The card that was optimistically raised is the one to shake. We stored
      // its id on the pending action before it was cleared; fall back to the
      // rejection kind otherwise.
      const cardId = pendingCardIdRef.current;
      if (cardId) {
        setShakeCardId(cardId);
        window.setTimeout(() => setShakeCardId(null), 260);
      }
    }
    setToast(rejectionToast(r.reason));
    window.setTimeout(() => setToast(null), 2600);
  }, [store.rejection, store.pendingAction]);

  // Remember the last card the player tried to play so the shake can target it.
  const pendingCardIdRef = useRef<string | null>(null);

  // Transition to game-over when the game ends.
  useEffect(() => {
    if (store.state?.phase === "ended") {
      navigate(`/room/${code}/game-over`, { replace: true });
    }
  }, [store.state?.phase, code, navigate]);

  // Server-enforced grace: connected clients poll `enforceGrace` so the SERVER
  // performs the skip / auto-pause / auto-resume against `lastSeen` (never the
  // client). We only poll while a game is live (not ended).
  useEffect(() => {
    if (!roomId || !playerId) return;
    if (!store.state || store.state.phase === "ended") return;
    const tick = () => void actions.enforceGrace();
    const t = window.setInterval(tick, GRACE_POLL_MS);
    return () => window.clearInterval(t);
  }, [roomId, playerId, store.state?.phase, actions]);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  if (!view) {
    return <GameLoading />;
  }

  // Decide which overlay is showing. A paused overlay takes precedence; then a
  // user-opened menu / leave; then the server-driven wild/drew/disconnected.
  const overlayId: OverlayId | null = menuOverlay ?? auto.overlay;
  const overlayData: OverlayView = auto.disconnect
    ? { disconnected: { ...auto.disconnect } }
    : overlayDataFor(store, overlayId);

  const play = (cardId: string) => {
    pendingCardIdRef.current = cardId;
    void actions.playCard(cardId);
  };

  return (
    <GameTable
      view={view}
      highlight={settings.highlight}
      reduced={reduced}
      onPlayCard={play}
      shakeCardId={shakeCardId}
      onDraw={() => void actions.drawOne()}
      onCallLastCard={() => void actions.callLast()}
      onMenu={() => setMenuOverlay("menu")}
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
              if (paused.variant === "break") void actions.resume();
              else if (paused.variant === "waiting")
                void actions.continueWithout();
              else void actions.endGame();
            }}
          />
        ) : overlayId ? (
          <GameOverlays
            overlay={overlayId}
            view={view}
            data={overlayData}
            onHowToPlay={() => navigate("/how-to-play")}
            onClose={() => setMenuOverlay(null)}
            onCopyLink={async () => {
              const ok = await copyToClipboard(view.room.inviteLink);
              flash(
                ok ? "Link copied" : `Copy failed — ${view.room.inviteLink}`,
              );
            }}
            onPause={() => {
              setMenuOverlay(null);
              void actions.pause();
            }}
            onLeave={async () => {
              await actions.leave();
              navigate("/");
            }}
            onChooseColor={(color: Suit) => void actions.chooseColor(color)}
            onPlayDrawn={() => {
              const drawn = store.ownHand?.cards.at(-1);
              if (drawn) void actions.playCard(drawn.id);
            }}
            onKeepDrawn={() => void actions.keep()}
            onPauseAndWait={() => void actions.pause()}
          />
        ) : toast ? (
          <ToastOverlay message={toast} />
        ) : undefined
      }
    />
  );
}

/** Compose the overlay-only view-model for the current wild/drew overlay. */
function overlayDataFor(
  store: ReturnType<typeof useRoomChannel>["store"],
  overlayId: OverlayId | null,
): OverlayView {
  const state = store.state;
  if (!state) return {};
  if (overlayId === "wild") {
    const top = state.discardPile[state.discardPile.length - 1];
    return {
      wild: {
        card: top?.value === "wild4" ? "wild4" : "wild",
      },
    };
  }
  if (overlayId === "drew") {
    const drawn = store.ownHand?.cards.at(-1);
    if (drawn) {
      return {
        drew: {
          ...(drawn.suit ? { suit: drawn.suit } : {}),
          value: drawn.value,
          fitsLine: "This card fits the pile",
        },
      };
    }
  }
  return {};
}

/** A one-line toast pinned above the piles (penalty/skip/reverse/etc.). */
function ToastOverlay({ message }: { message: string }) {
  return (
    <div className="pointer-events-none absolute left-0 top-[214px] flex w-full justify-center">
      <div className="rounded-full bg-ink px-4 py-2 text-label font-bold text-surface shadow-cta">
        {message}
      </div>
    </div>
  );
}

/** Human toast for a server rejection reason (Req 7.3 illegal tap etc.). */
function rejectionToast(reason: string): string {
  switch (reason) {
    case "illegal_card":
    case "illegal_play":
      return "That card can't be played right now";
    case "not_active":
      return "It's not your turn yet";
    case "stale_version":
      return "Catching up…";
    case "paused":
      return "The game is paused";
    default:
      return "That move was rejected";
  }
}

/** Loading shell while the table hydrates. */
function GameLoading() {
  return (
    <div className="grid h-dvh w-full place-items-center bg-paper">
      <span role="status" className="text-body text-ink-muted">
        Dealing…
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fixture container (preview / tests via ?state= / ?overlay=).
// ---------------------------------------------------------------------------

function FixtureGame() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { code } = useParams();
  const reduced = usePrefersReducedMotion();

  const overlayParam = params.get("overlay");
  const paused = makePausedView(overlayParam);
  const baseView = makeGameView(
    paused ? paused.tableState : params.get("state"),
  );
  const overlay = isOverlayId(overlayParam) ? overlayParam : null;
  const overlayData = makeOverlayView(overlayParam);

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
      onMenu={() => {
        const next = new URLSearchParams(params);
        next.set("overlay", "menu");
        navigate(`?${next.toString()}`);
      }}
      onDraw={() => {
        /* preview seam */
      }}
      onCallLastCard={() => {
        /* preview seam */
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
              /* preview seam */
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
