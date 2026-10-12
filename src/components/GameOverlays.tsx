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
 * - `wild`         → `BottomSheet` + the played wild card + `WildColorButtons`
 *                    (four, NO cancel — §5.16, Req 8.1/8.2/9.6).
 * - `drew`         → `BottomSheet` + `SpotlightCard` ("You drew") + a
 *                    "<card> fits the pile" line + Play it / Keep it (Req 10.2).
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
 * color choice). Firebase is DEFERRED: settings come from the device store, the
 * rest from the view-model. Tokens only; reuse before create.
 */
import { BottomSheet } from "@/components/BottomSheet";
import { Button } from "@/components/Button";
import { Dialog } from "@/components/Dialog";
import { MenuDrawer, type MenuCardCount } from "@/components/MenuDrawer";
import { PlayingCard } from "@/components/PlayingCard";
import { SpotlightCard } from "@/components/SpotlightCard";
import { Toast } from "@/components/Toast";
import { TurnPill } from "@/components/TurnPill";
import { WildColorButtons } from "@/components/WildColorButtons";
import type { Suit } from "@/design/suits";
import type { OverlayId, OverlayView } from "@/game/view/overlays";
import type { GameView } from "@/game/view/types";
import { supportsVibration, useSettings } from "@/lib/settings";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { useState } from "react";

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

  if (overlay === "wild" && data.wild) {
    return (
      <BottomSheet
        spacious
        title="Choose a color"
        subtitle={data.wild.consequence}
        // NO onClose — the wild picker has no cancel (§5.16, Req 8.5/8.6).
        reduced={reduced}
        header={
          <div className="flex items-center gap-4">
            <PlayingCard
              variant="partner"
              value={data.wild.card}
              disabled
              tabIndex={-1}
            />
          </div>
        }
      >
        <WildColorButtons onSelect={(suit: Suit) => onChooseColor?.(suit)} />
      </BottomSheet>
    );
  }

  if (overlay === "drew" && data.drew) {
    return (
      <>
        {/* The enlarged drawn card floats over the table above the sheet
            (§5.17), matching the reference — not inside the sheet body. */}
        <div className="pointer-events-none absolute left-0 top-[240px] flex w-full justify-center">
          <SpotlightCard
            {...(data.drew.suit ? { suit: data.drew.suit } : {})}
            value={data.drew.value}
            reduced={reduced}
          />
        </div>
        <BottomSheet
          title={data.drew.fitsLine}
          subtitle="Play it now, or keep it and end your turn."
          reduced={reduced}
        >
          <div className="flex flex-col gap-2.5 pt-1">
            <Button
              variant="primary"
              className="font-display text-cta"
              onClick={() => onPlayDrawn?.()}
            >
              Play it
            </Button>
            <Button
              variant="outline"
              className="h-[50px] font-extrabold"
              onClick={() => onKeepDrawn?.()}
            >
              Keep it
            </Button>
          </div>
        </BottomSheet>
      </>
    );
  }

  if (overlay === "disconnected" && data.disconnected) {
    const dc = data.disconnected;
    const grace = dc.graceSeconds ?? 60;
    return (
      <>
        {/* "[name] lost connection" toast, centered above the piles (§5.19). */}
        <div className="pointer-events-none absolute left-0 top-[214px] flex w-full justify-center">
          <Toast>{dc.name} lost connection</Toast>
        </div>

        {/* Waiting/skipping pill + "Pause and wait" chip under it (§5.5, Req 25.2).
            Overlaid at the turn-pill position so it replaces the table's pill. */}
        <div className="absolute left-0 top-[512px] flex w-full flex-col items-center gap-2">
          <TurnPill tone="yellow">
            Waiting for {dc.name} · skipping in {dc.secondsLeft}s
          </TurnPill>
          <Button
            variant="soft"
            className="h-9"
            onClick={() => onPauseAndWait?.()}
            // The ring fraction the countdown maps to (documented seam for 9.6).
            data-grace-seconds={grace}
          >
            Pause and wait
          </Button>
        </div>
      </>
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
