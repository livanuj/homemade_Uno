/**
 * Lobby route — screens `02a`–`02f` (design.md §7.2). Mode, host/guest, and the
 * drag state are all *state*, not separate routes, so one presentational
 * component (`LobbyScreen`) renders the lot from a `LobbyView` + handlers.
 *
 * Two containers feed it:
 *  - `LiveLobby` (the real route): subscribes to the room's realtime channel via
 *    `useRoomChannel`, derives the `LobbyView` from live Firestore data through
 *    `mappers.ts`, and wires the buttons/mode/team controls to the Cloud
 *    Functions (`setMode`, `setTeams`, `startGame`, `leave`) plus the clipboard
 *    / native-share flows (Task 9.1/9.2/9.3).
 *  - `FixtureLobby` (preview/tests): when a `?state=02a..02f` param is present,
 *    renders the Task-8 fixture for that screen so Playwright captures and the
 *    existing unit tests keep working against a deterministic view.
 *
 * Host vs. guest is driven by `LobbyView.selfId === <host id>`. Tokens only,
 * built to the PNGs; reuses `IconButton`, `Button`, `ModeControl`, `PlayerRow`,
 * `EmptySlot`, `TeamCard`, `DragHandle`, `StartControl`.
 */
import type { AvatarRing } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { DRAG_STATE, DragHandle } from "@/components/DragHandle";
import { EmptySlot } from "@/components/EmptySlot";
import { IconButton } from "@/components/IconButton";
import { ModeControl } from "@/components/ModeControl";
import { MotionDragRow } from "@/components/MotionDragRow";
import { PlayerRow } from "@/components/PlayerRow";
import { StartControl } from "@/components/StartControl";
import { TeamCard } from "@/components/TeamCard";
import { Toast } from "@/components/Toast";
import { callAction } from "@/firebase/callAction";
import { useSession } from "@/firebase/useSession";
import { makeLobbyView } from "@/game/view/fixtures";
import { startEnablement, toLobbyView } from "@/game/view/mappers";
import type {
  GameMode,
  LobbyView,
  PlayerView,
  TeamId,
} from "@/game/view/types";
import { cn } from "@/lib/cn";
import { copyToClipboard, shareInvite } from "@/lib/share";
import { useRoomChannel } from "@/realtime/useRoomChannel";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

/** 2v2 needs exactly 4 players (design.md §5.14 / Req 4.8). */
const TEAM_PLAYER_COUNT = 4;
/** "Play 2v2" is disabled once the room grows past 4 (Req 4.9). */
const TEAM_MAX_PLAYERS = TEAM_PLAYER_COUNT;
/** Auto-switch to Normal once the room passes this many players (Req 4.11). */
const AUTO_NORMAL_THRESHOLD = 5;

/** The room host is the player carrying `isHost`. */
function hostOf(view: LobbyView): PlayerView | undefined {
  return view.room.players.find((p) => p.isHost);
}

/** Avatar ring for a filled row: team color in 2v2, else host/neutral ink. */
function ringFor(player: PlayerView, mode: GameMode): AvatarRing {
  if (mode === "team") return player.team === "B" ? "team-b" : "team-a";
  return player.isHost ? "ink" : "ink-muted";
}

/** Handlers the presentational `LobbyScreen` calls; a container supplies them. */
interface LobbyHandlers {
  onCopyLink(): void;
  onShare(): void;
  onModeChange(mode: GameMode): void;
  /** Move a player to the other team (tap/keyboard swap, Req 21.6). */
  onMovePlayer(playerId: string): void;
  onStart(): void;
  onLeave(): void;
  onBack(): void;
  /** Optional transient toast text (e.g. copy confirmation, auto-switch). */
  toast?: string | null;
  /** True while a room action is in flight (disables the primary CTAs). */
  busy?: boolean;
}

/** The default route: fixture preview when `?state=` is set, else live. */
export function LobbyRoute() {
  const [params] = useSearchParams();
  const stateParam = params.get("state");
  if (stateParam) return <FixtureLobby state={stateParam} />;
  return <LiveLobby />;
}

// ---------------------------------------------------------------------------
// Live container (the real route).
// ---------------------------------------------------------------------------

function LiveLobby() {
  const navigate = useNavigate();
  const { code } = useParams();
  const { playerId } = useSession();
  const roomId = code ?? null;
  const { store } = useRoomChannel(roomId, playerId);

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const view = useMemo(() => toLobbyView(store), [store]);

  // Once the game starts, everyone (host + guests) transitions to the table.
  useEffect(() => {
    if (store.room?.phase === "playing") {
      navigate(`/room/${code}/game`, { replace: true });
    }
  }, [store.room?.phase, code, navigate]);

  // Auto-switch 2v2 → Normal when the room reaches 5+ players (Req 4.11); only
  // the host performs the mutation, and a toast explains it.
  const playerCount = view?.room.players.length ?? 0;
  const isHost = !!view && hostOf(view)?.id === view.selfId;
  useEffect(() => {
    if (!roomId || !isHost) return;
    if (
      store.room?.gameMode === "team" &&
      playerCount >= AUTO_NORMAL_THRESHOLD
    ) {
      void callAction("setMode", { roomId, mode: "normal" });
      flash("Switched to Normal — 2v2 needs exactly 4 players");
    }
  }, [roomId, isHost, store.room?.gameMode, playerCount, flash]);

  if (!view || !roomId) {
    return <LobbyLoading onBack={() => navigate("/")} />;
  }

  const handlers: LobbyHandlers = {
    onCopyLink: async () => {
      const ok = await copyToClipboard(view.room.inviteLink);
      flash(ok ? "Link copied" : `Copy failed — ${view.room.inviteLink}`);
    },
    onShare: async () => {
      const result = await shareInvite({
        title: "Homemade Uno",
        text: `Join my game — room ${view.room.code}`,
        url: view.room.inviteLink,
      });
      if (result === "copied") flash("Link copied to share");
    },
    onModeChange: (mode) => {
      void callAction("setMode", { roomId, mode });
    },
    onMovePlayer: (pid) => {
      const assignments = swapAssignment(view, pid);
      if (assignments) void callAction("setTeams", { roomId, assignments });
    },
    onStart: async () => {
      setBusy(true);
      await callAction("startGame", { roomId });
      setBusy(false);
      // Navigation happens via the phase→playing effect above.
    },
    onLeave: async () => {
      await callAction("leave", { roomId });
      navigate("/");
    },
    onBack: () => navigate("/"),
    toast,
    busy,
  };

  return <LobbyScreen view={view} handlers={handlers} />;
}

/**
 * Compute the new `{ playerId: team }` assignment for moving `pid` to the other
 * team, swapping with a member of the target team when it is already full
 * (Req 21.3/21.4). Returns null if the move is not possible.
 */
function swapAssignment(
  view: LobbyView,
  pid: string,
): Record<string, TeamId> | null {
  const player = view.room.players.find((p) => p.id === pid);
  if (!player?.team) return null;
  const from = player.team;
  const to: TeamId = from === "A" ? "B" : "A";
  const targetTeam = view.room.players.filter((p) => p.team === to);
  const assignment: Record<string, TeamId> = { [pid]: to };
  if (targetTeam.length >= 2) {
    // Swap: bump one target-team member back to the vacated team.
    assignment[targetTeam[0].id] = from;
  }
  return assignment;
}

/** A minimal loading shell shown until the room snapshot hydrates. */
function LobbyLoading({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex h-full flex-col gap-3 px-5 pt-4 pb-6 pt-safe pb-safe">
      <header className="flex h-11 shrink-0 items-center justify-between">
        <IconButton aria-label="Back" onClick={onBack}>
          <BackIcon />
        </IconButton>
        <h1 className="font-display text-title text-ink">Game room</h1>
        <span className="w-11" aria-hidden="true" />
      </header>
      <div className="flex flex-1 items-center justify-center">
        <span role="status" className="text-body text-ink-muted">
          Loading room…
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fixture container (preview / tests via ?state=).
// ---------------------------------------------------------------------------

function FixtureLobby({ state }: { state: string }) {
  const navigate = useNavigate();
  const view = makeLobbyView(state);
  const { code } = view.room;
  const [selectedMode, setSelectedMode] = useState<GameMode>(view.room.mode);
  const host = hostOf(view);
  const isHost = host?.id === view.selfId;

  const handlers: LobbyHandlers = {
    onCopyLink: () => void copyToClipboard(view.room.inviteLink),
    onShare: () =>
      void shareInvite({
        title: "Homemade Uno",
        text: `Join my game — room ${code}`,
        url: view.room.inviteLink,
      }),
    onModeChange: (mode) => setSelectedMode(mode),
    onMovePlayer: () => {
      /* fixture preview — team changes are exercised live (Req 21.2) */
    },
    onStart: () => navigate(`/room/${code}/game`),
    onLeave: () => navigate("/"),
    onBack: () => navigate("/"),
  };

  // For the fixture preview keep the optimistic selected-mode behaviour on the
  // host's control while everything else renders from the fixture view.
  const previewView: LobbyView = isHost
    ? { ...view, room: { ...view.room, mode: selectedMode } }
    : view;

  return <LobbyScreen view={previewView} handlers={handlers} />;
}

// ---------------------------------------------------------------------------
// Presentational screen.
// ---------------------------------------------------------------------------

function LobbyScreen({
  view,
  handlers,
}: {
  view: LobbyView;
  handlers: LobbyHandlers;
}) {
  const host = hostOf(view);
  const isHost = host?.id === view.selfId;
  const { code, mode, players } = view.room;
  const [copied, setCopied] = useState(false);

  const teamDisabled = players.length > TEAM_MAX_PLAYERS;
  const { caption, disabled: startDisabled } = startEnablement(view.room);

  function handleCopyLink() {
    handlers.onCopyLink();
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="relative flex h-full flex-col gap-3 px-5 pt-4 pb-6 pt-safe pb-safe">
      {/* Header — back, "Game room" title, 44px right spacer for symmetry. */}
      <header className="flex h-11 shrink-0 items-center justify-between">
        <IconButton aria-label="Back" onClick={handlers.onBack}>
          <BackIcon />
        </IconButton>
        <h1 className="font-display text-title text-ink">Game room</h1>
        <span className="w-11" aria-hidden="true" />
      </header>

      {/* Room-code panel — code + Copy link (outline) / Share invite (primary). */}
      <section className="flex flex-col items-center gap-2 rounded-panel bg-surface px-5 pt-3 pb-3.5 shadow-panel">
        <span className="text-label font-bold tracking-[0.1em] text-ink-muted">
          ROOM CODE
        </span>
        <span className="font-display text-code text-ink">{code}</span>
        <div className="flex w-full gap-2.5">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleCopyLink}
            aria-live="polite"
          >
            {copied ? "Link copied" : "Copy link"}
          </Button>
          <Button
            variant="primary-small"
            className="flex-1"
            onClick={handlers.onShare}
          >
            Share invite
          </Button>
        </div>
      </section>

      {/* Mode control — host editable / guest read-only "chosen by the host". */}
      <ModeControl
        mode={mode}
        canEdit={isHost}
        teamDisabled={teamDisabled}
        onModeChange={handlers.onModeChange}
      />

      {/* Players header — count + right-side hint (drag in 2v2, "Up to 8" else). */}
      <div className="flex min-h-5 items-center justify-between px-1">
        <span className="text-body font-extrabold text-ink">
          Players · {players.length}
        </span>
        {isHost && <PlayersHint mode={mode} drag={!!view.drag} />}
      </div>

      {/* Player area — single list (Normal) or Team A / Team B cards (2v2). */}
      {mode === "team" ? (
        <div className="relative flex flex-col gap-3">
          <TeamArea
            view={view}
            isHost={isHost}
            onMovePlayer={handlers.onMovePlayer}
          />
          {view.drag &&
            (() => {
              const dragged = players.find(
                (p) => p.id === view.drag?.draggingId,
              );
              if (!dragged) return null;
              return <LiftedRow name={displayName(dragged, view.selfId)} />;
            })()}
        </div>
      ) : (
        <NormalList view={view} />
      )}

      <div className="flex-1" />

      {/* Start control — host CTA + reason, or guest "waiting" + Leave room. */}
      {isHost ? (
        <StartControl
          caption={caption}
          disabled={startDisabled || !!handlers.busy}
          onStart={handlers.onStart}
        />
      ) : (
        <GuestFooter
          hostName={host?.name ?? "the host"}
          onLeave={handlers.onLeave}
        />
      )}

      {/* Transient toast (copy confirmation, clipboard fallback, auto-switch). */}
      {handlers.toast && (
        <div className="pointer-events-none absolute inset-x-0 top-20 flex justify-center">
          <Toast>{handlers.toast}</Toast>
        </div>
      )}
    </div>
  );
}

/** Right-aligned players hint (design.md §7.2). */
function PlayersHint({ mode, drag }: { mode: GameMode; drag: boolean }) {
  if (mode !== "team") {
    return (
      <span className="text-label font-semibold text-ink-muted">Up to 8</span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-label font-semibold text-ink-muted">
      <GripGlyph />
      {drag ? "Drop on a player to swap" : "Drag to change teams"}
    </span>
  );
}

/** Normal-mode player list — one panel listing every player (screen 02b). */
function NormalList({ view }: { view: LobbyView }) {
  const { players, mode } = view.room;
  return (
    <section className="flex flex-col gap-1 rounded-panel bg-surface px-3 py-2 shadow-panel">
      {players.map((p) => (
        <PlayerRow
          key={p.id}
          name={displayName(p, view.selfId)}
          ring={ringFor(p, mode)}
          host={p.isHost}
          ready
        />
      ))}
      {players.length === 1 && (
        <EmptySlot message="Share the link to invite friends" />
      )}
    </section>
  );
}

/** 2v2 team area — Team A / Team B cards with two slots each (screens 02c–02e). */
function TeamArea({
  view,
  isHost,
  onMovePlayer,
}: {
  view: LobbyView;
  isHost: boolean;
  onMovePlayer: (playerId: string) => void;
}) {
  return (
    <>
      <TeamCard team="a" name="TEAM A">
        <TeamSlots
          view={view}
          team="A"
          isHost={isHost}
          onMovePlayer={onMovePlayer}
        />
      </TeamCard>
      <TeamCard team="b" name="TEAM B">
        <TeamSlots
          view={view}
          team="B"
          isHost={isHost}
          onMovePlayer={onMovePlayer}
        />
      </TeamCard>
    </>
  );
}

/**
 * The two seats of one team: filled rows for that team's players (host gets a
 * drag handle whose tap/keyboard action moves the player to the other team,
 * Req 21.6), the dragging visuals for screen `02e`, then a dashed
 * "Waiting for a player" slot for each unfilled seat.
 */
function TeamSlots({
  view,
  team,
  isHost,
  onMovePlayer,
}: {
  view: LobbyView;
  team: TeamId;
  isHost: boolean;
  onMovePlayer: (playerId: string) => void;
}) {
  const { players, mode } = view.room;
  const seated = players.filter((p) => p.team === team);
  const empties = Math.max(0, 2 - seated.length);
  const drag = view.drag;

  return (
    <>
      {seated.map((p) => {
        const isDragging = drag?.draggingId === p.id;
        const isSwapTarget = drag?.overId === p.id;

        if (isDragging) {
          return <DragPlaceholder key={p.id} name={p.name} />;
        }
        if (isSwapTarget) {
          return (
            <SwapTargetRow key={p.id} name={displayName(p, view.selfId)} />
          );
        }
        return (
          <PlayerRow
            key={p.id}
            name={displayName(p, view.selfId)}
            ring={ringFor(p, mode)}
            host={p.isHost}
            ready
            {...(isHost
              ? {
                  rightSlot: (
                    <DragHandle
                      playerName={displayName(p, view.selfId)}
                      onMove={() => onMovePlayer(p.id)}
                    />
                  ),
                }
              : {})}
          />
        );
      })}

      {Array.from({ length: empties }).map((_, i) => (
        <EmptySlot key={`empty-${team}-${i}`} message="Waiting for a player" />
      ))}
    </>
  );
}

/** Origin placeholder left behind by a lifted row (DRAG_STATE.placeholder). */
function DragPlaceholder({ name }: { name: string }) {
  return <div className={DRAG_STATE.placeholder}>{name}</div>;
}

/** The occupied row under the finger — a dashed swap target (screen 02e). */
function SwapTargetRow({ name }: { name: string }) {
  return (
    <div
      className={cn(
        "flex min-h-[46px] items-center gap-2.5 rounded-row px-2.5",
        DRAG_STATE.dropTarget,
      )}
    >
      <span
        aria-hidden="true"
        className="size-9 shrink-0 rounded-full bg-avatar opacity-45 ring-3 ring-team-a"
      />
      <span className="flex-1 text-body font-bold text-ink-muted">{name}</span>
      <span className="flex items-center gap-1.5 text-label font-extrabold text-ink">
        <SwapGlyph />
        Swap
      </span>
    </div>
  );
}

/** The lifted/tilted row following the finger (design.md §5.13 / screen 02e). */
function LiftedRow({ name }: { name: string }) {
  return (
    <div className="pointer-events-none absolute left-2 right-24 top-[104px] z-10">
      <MotionDragRow lifted>
        <div className="flex min-h-[46px] items-center gap-2.5 rounded-row bg-surface px-2.5 py-1.5">
          <span className="-ml-1.5 grid w-7 place-items-center">
            <GripGlyph tone="ink" />
          </span>
          <span
            aria-hidden="true"
            className="size-9 shrink-0 rounded-full bg-avatar ring-3 ring-team-b"
          />
          <span className="flex-1 text-body text-ink">{name}</span>
          <ReadyCheck />
        </div>
      </MotionDragRow>
    </div>
  );
}

/** Guest footer (screen 02f) — status pill + "Leave room" instead of Start. */
function GuestFooter({
  hostName,
  onLeave,
}: {
  hostName: string;
  onLeave: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5">
      <span
        role="status"
        className="flex items-center gap-2 rounded-full bg-surface px-4 py-2.5 text-label font-bold text-ink"
      >
        <span
          aria-hidden="true"
          className="size-2.5 rounded-full bg-suit-yellow"
        />
        Waiting for {hostName} to start the game
      </span>
      <Button variant="soft" className="w-full" onClick={onLeave}>
        Leave room
      </Button>
    </div>
  );
}

/** Show "You" for the viewer's own row; otherwise the player's name. */
function displayName(player: PlayerView, selfId: string): string {
  return player.id === selfId ? "You" : player.name;
}

/** Six-dot grip glyph reused for the players hint and the lifted row. */
function GripGlyph({ tone = "ink-muted" }: { tone?: "ink-muted" | "ink" }) {
  return (
    <svg
      width="10"
      height="14"
      viewBox="0 0 14 20"
      className={tone === "ink" ? "fill-ink" : "fill-ink-muted"}
      aria-hidden="true"
    >
      <circle cx="4" cy="4" r="1.8" />
      <circle cx="10" cy="4" r="1.8" />
      <circle cx="4" cy="10" r="1.8" />
      <circle cx="10" cy="10" r="1.8" />
      <circle cx="4" cy="16" r="1.8" />
      <circle cx="10" cy="16" r="1.8" />
    </svg>
  );
}

/** 16px swap glyph for the drop target (screen 02e). */
function SwapGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4" />
    </svg>
  );
}

/** 18px ready check reused inside the lifted row. */
function ReadyCheck() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="Ready"
      className="shrink-0 text-suit-green-ink"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/** 20px back chevron (design.md §5.4 icon button). */
function BackIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}
