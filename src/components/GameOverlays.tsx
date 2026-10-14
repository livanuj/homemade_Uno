/**
 * GameOverlays — the five in-game overlays composed over the game table
 * (design.md §5.10/§5.15–§5.20, screens `05-menu`, `06a`–`06d`, task 8.5).
 *
 * This is the `overlay` slot content for `GameTable` (the seam left open by
 * task 8.4). It renders exactly one overlay for a given `OverlayId`, composed
 * from the task-6/7 components — nothing is recreated here:
 *
 * - `menu`         → `MenuDrawer` (§5.10): room code + Copy link, "CARDS LEFT"
 *                    per player (grouped by team in 2v2), the three `Switch`es
 *                    (wired to `useSettings`, task 8.2), Pause game (Req 25.1),
 *                    How to play (→ route), and Leave game (danger → the
 *                    leave-confirm dialog).
 * - `wild`         → a choice ON the table, above the hand (no popup, so the
 *                    hand stays visible): who draws next + one row of four
 *                    `WildColorButtons` (NO cancel — §5.16, Req 8.1/8.2/9.6).
 * - `drew`         → a choice on the table: the drawn card + "<card> fits the
 *                    pile" + Play it / Keep it (Req 10.2).
 * - `disconnected` → a table STATE: the waiting/skipping `TurnPill` + a
 *                    "Pause and wait" chip + a "[name] lost connection" `Toast`
 *                    over the same table; the disconnected seat's offline
 *                    treatment (`OfflineAvatar` + `CountdownRing`) is applied by
 *                    the route on the `GameView` it feeds the table
 *                    (Req 15.1/15.3/15.5, 25.2).
 * - `leave`        → the leave-confirm `Dialog` (§5.18, Req 22.1).
 *
 * Interactions/wiring are task 9 — the callbacks here are local UI state only
 * (open/close the leave dialog) and no-op seams (Copy link, Pause, Play/Keep,
 * color choice). The backend is not involved: settings come from the device store, the
 * rest from the view-model. Tokens only; reuse before create.
 */
import { Button } from "@/components/Button";
import { Dialog } from "@/components/Dialog";
import { MenuDrawer, type MenuCardCount } from "@/components/MenuDrawer";
import { PlayingCard } from "@/components/PlayingCard";
import { TableLayer } from "@/components/TableLayer";
import { Toast } from "@/components/Toast";
import { TurnPill } from "@/components/TurnPill";
import { WildColorButtons } from "@/components/WildColorButtons";
import type { Suit } from "@/design/suits";
import type { OverlayId, OverlayView } from "@/game/view/overlays";
import type { GameView } from "@/game/view/types";
import { cn } from "@/lib/cn";
import { supportsVibration, useSettings } from "@/lib/settings";
import { useCompactLandscape, useLandscape } from "@/lib/useLandscape";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { useEffect, useRef, useState, type ReactNode } from "react";

export interface GameOverlaysProps {
  /** Which overlay to show (from the `?overlay=` param). */
  overlay: OverlayId;
  /** The underlying table projection (for room code, players, mode). */
  view: GameView;
  /** Extra overlay-only view-model (wild target, drawn card, disconnected). */
  data: OverlayView;
  /** Leave to the How to play route (task 9 wires navigation). */
  onHowToPlay?: () => void;
  /** Close the whole overlay (task 9 wires navigation back to the table). */
  onClose?: () => void;

  // ---- live action handlers (Task 9.4 / 9.6) — optional so the fixture
  // preview path can omit them and keep the seams as no-ops. ----
  /** Copy the invite link from the menu (Req 1.3). */
  onCopyLink?: () => void;
  /** Pause the game from the menu (Req 25.1). */
  onPause?: () => void;
  /** Leave the game (menu → confirm, or the direct leave overlay) (Req 22.1). */
  onLeave?: () => void;
  /** Choose a color for a played wild (Req 8.2). */
  onChooseColor?: (color: Suit) => void;
  /** Play the freshly drawn card (Req 10.2). */
  onPlayDrawn?: () => void;
  /** Keep the freshly drawn card and end the turn (Req 10.4). */
  onKeepDrawn?: () => void;
  /** Pause to wait for the disconnected player (Req 25.2). */
  onPauseAndWait?: () => void;
}

/** Build the "CARDS LEFT" rows from the room roster (§5.10). */
function cardCountsFrom(view: GameView): MenuCardCount[] {
  return view.room.players.map((p) => ({
    playerId: p.id,
    name: p.id === view.selfId ? "You" : p.name,
    count: p.cardCount ?? 0,
    ...(p.team ? { team: p.team } : {}),
  }));
}

/** A left-facing door/arrow glyph for the leave-confirm dialog (§5.18). */
function LeaveIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-danger)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

/**
 * The leave-confirm dialog (`06d`, §5.18, Req 22.1). Reused by the direct
 * `leave` overlay and by the menu's "Leave game" action.
 */
function LeaveConfirmDialog({
  reduced,
  onStay,
  onLeave,
}: {
  reduced: boolean;
  onStay?: () => void;
  onLeave?: () => void;
}) {
  return (
    <Dialog
      icon={<LeaveIcon />}
      title="Leave this game?"
      description="The game keeps going without you. Your turns are skipped, and you can come back through the invite link until it ends."
      reduced={reduced}
      {...(onStay ? { onClose: onStay } : {})}
      actions={
        <>
          <Button variant="primary" className="h-[50px]" onClick={onStay}>
            Stay in game
          </Button>
          <Button variant="danger" onClick={onLeave}>
            Leave game
          </Button>
        </>
      }
    />
  );
}

export function GameOverlays({
  overlay,
  view,
  data,
  onHowToPlay,
  onClose,
  onCopyLink,
  onPause,
  onLeave,
  onChooseColor,
  onPlayDrawn,
  onKeepDrawn,
  onPauseAndWait,
}: GameOverlaysProps) {
  const reduced = usePrefersReducedMotion();
  const landscape = useLandscape();
  const compact = useCompactLandscape();
  const { settings, set } = useSettings();
  const isTeam = view.room.mode === "team";

  // Local UI state: the menu's "Leave game" opens the leave-confirm dialog over
  // the drawer (task 9 wires the actual leave). Reaching `?overlay=leave`
  // directly opens the same dialog with no drawer behind it.
  const [leaveOpen, setLeaveOpen] = useState(overlay === "leave");

  if (overlay === "menu") {
    return (
      <>
        <MenuDrawer
          roomCode={view.room.code}
          cardCounts={cardCountsFrom(view)}
          isTeamMode={isTeam}
          soundOn={settings.sound}
          vibrationOn={settings.vibration}
          highlightOn={settings.highlight}
          vibrationSupported={supportsVibration()}
          onSoundChange={(on) => set({ sound: on })}
          onVibrationChange={(on) => set({ vibration: on })}
          onHighlightChange={(on) => set({ highlight: on })}
          onCopyLink={() => onCopyLink?.()}
          onPause={() => onPause?.()}
          onHowToPlay={() => onHowToPlay?.()}
          onLeave={() => setLeaveOpen(true)}
          onClose={() => onClose?.()}
          reduced={reduced}
        />
        {leaveOpen && (
          <LeaveConfirmDialog
            reduced={reduced}
            onStay={() => setLeaveOpen(false)}
            onLeave={() => onLeave?.()}
          />
        )}
      </>
    );
  }

  // Wild color / drew-a-card choices sit ON the table between the piles and
  // the hand — no popup or backdrop — so the hand stays in view while
  // choosing. Positions are table (stage) coordinates via `TableLayer`.
  const trayPosition = compact
    ? "top-[266px] w-[440px]"
    : landscape
      ? "top-[440px] w-[520px]"
      : "top-[470px] w-[358px]";

  if (overlay === "wild" && data.wild) {
    return (
      <TableLayer>
        {/* NO cancel — the wild picker requires a choice (§5.16, Req 8.5/8.6). */}
        <ChoiceTray label="Choose a color" className={trayPosition}>
          <div
            className={cn(
              "flex flex-col gap-1.5 rounded-panel bg-surface shadow-cta",
              compact ? "p-1.5" : "p-2.5",
            )}
          >
            <p
              className={cn(
                "text-center text-label text-ink",
                compact && "sr-only",
              )}
            >
              {data.wild.consequence}
            </p>
            <WildColorButtons
              compact={compact}
              onSelect={(suit: Suit) => onChooseColor?.(suit)}
            />
          </div>
        </ChoiceTray>
      </TableLayer>
    );
  }

  if (overlay === "drew" && data.drew) {
    return (
      <TableLayer>
        <ChoiceTray
          label="You drew a card"
          className={cn(trayPosition, "flex-row items-center justify-center")}
        >
          <div
            className={cn(
              "flex items-center gap-3 rounded-panel bg-surface shadow-cta",
              compact ? "px-3 py-1" : "p-2.5 pr-3",
            )}
          >
            {!compact && (
              <PlayingCard
                variant="partner"
                {...(data.drew.suit ? { suit: data.drew.suit } : {})}
                value={data.drew.value}
                disabled
                tabIndex={-1}
              />
            )}
            <div
              className={cn(
                "flex gap-2",
                compact ? "flex-row items-center" : "flex-col",
              )}
            >
              <span className="text-label text-ink">{data.drew.fitsLine}</span>
              <div className="flex gap-2">
                <Button
                  variant="primary-small"
                  className={cn("px-5", compact && "h-9")}
                  onClick={() => onPlayDrawn?.()}
                >
                  Play it
                </Button>
                <Button
                  variant="outline"
                  className={cn("px-5", compact && "h-9")}
                  onClick={() => onKeepDrawn?.()}
                >
                  Keep it
                </Button>
              </div>
            </div>
          </div>
        </ChoiceTray>
      </TableLayer>
    );
  }

  if (overlay === "disconnected" && data.disconnected) {
    const dc = data.disconnected;
    const grace = dc.graceSeconds ?? 60;
    const pauseAndWait = (
      <Button
        variant="soft"
        className={cn("h-9", compact && "bg-surface")}
        onClick={() => onPauseAndWait?.()}
        // The ring fraction the countdown maps to (documented seam for 9.6).
        data-grace-seconds={grace}
      >
        Pause and wait
      </Button>
    );
    return (
      <TableLayer>
        {/* "[name] lost connection" toast, centered above the piles (§5.19). */}
        <div
          className={cn(
            "pointer-events-none absolute left-0 flex w-full justify-center",
            compact ? "top-[116px]" : "top-[214px]",
          )}
        >
          <Toast>{dc.name} lost connection</Toast>
        </div>

        {/* Waiting/skipping pill + "Pause and wait" chip under it (§5.5, Req 25.2).
            Overlaid at the turn-pill position so it replaces the table's pill.
            On a phone on its side the chip moves to the right edge, clear of
            the hand. */}
        <div
          className={cn(
            "absolute left-0 flex w-full flex-col items-center gap-2",
            compact ? "top-[280px]" : landscape ? "top-[470px]" : "top-[512px]",
          )}
        >
          <TurnPill tone="yellow">
            Waiting for {dc.name} · skipping in {dc.secondsLeft}s
          </TurnPill>
          {!compact && pauseAndWait}
        </div>
        {compact && (
          <div className="absolute top-[288px] right-4">{pauseAndWait}</div>
        )}
      </TableLayer>
    );
  }

  if (overlay === "leave") {
    return (
      <LeaveConfirmDialog
        reduced={reduced}
        onStay={() => onClose?.()}
        onLeave={() => onLeave?.()}
      />
    );
  }

  return null;
}

/**
 * A labelled group of choices placed on the table (wild color, drew a card).
 * Focus moves to its first button so keyboard and screen-reader users land on
 * the choice; it is not modal, so the table — your hand — stays visible.
 */
function ChoiceTray({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, []);
  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      className={cn(
        "absolute left-1/2 z-30 flex -translate-x-1/2 flex-col gap-1.5",
        className,
      )}
    >
      {children}
    </div>
  );
}
