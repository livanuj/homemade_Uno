/**
 * Lobby route — screens `02a`–`02f` (design.md §7.2). Mode, host/guest, and the
 * drag state are all *state*, not separate routes, so one component renders the
 * lot from a `LobbyView`.
 *
 * The view-model comes from the injectable fixtures seam (task 8.1): the six
 * states map to the `02a`–`02f` fixtures in `@/game/view/fixtures`, chosen by a
 * `?state=` query param so Playwright (and links) can reach each distinct
 * screen. The realtime Firestore wiring + real drag-and-drop behaviour land in
 * task 9.2; here the buttons/mode/drag are visual with optimistic feedback.
 *
 * Host vs. guest is driven by `LobbyView.selfId === <host id>`. Tokens only,
 * built to the PNGs (design-fidelity.md / token-policy.md); reuses
 * `IconButton`, `Button`, `ModeControl`, `PlayerRow`, `EmptySlot`, `TeamCard`,
 * `DragHandle` (+ `DRAG_STATE` / `MotionDragRow`), `StartControl`, `HostBadge`.
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
import { makeLobbyView } from "@/game/view/fixtures";
import type {
  GameMode,
  LobbyView,
  PlayerView,
  TeamId,
} from "@/game/view/types";
import { cn } from "@/lib/cn";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

/** 2v2 needs exactly 4 players (design.md §5.14 / Req 4.8). */
const TEAM_PLAYER_COUNT = 4;
/** Normal mode needs at least 2 players to start (Req 4.7). */
const NORMAL_MIN_PLAYERS = 2;
/** "Play 2v2" is disabled once the room grows past 4 (Req 4.9). */
const TEAM_MAX_PLAYERS = TEAM_PLAYER_COUNT;

/** The room host is the player carrying `isHost`. */
function hostOf(view: LobbyView): PlayerView | undefined {
  return view.room.players.find((p) => p.isHost);
}

/** Compose the disabled/enabled Start caption for the current view (§5.14). */
function startCaption(view: LobbyView): { caption: string; disabled: boolean } {
  const count = view.room.players.length;
  if (view.room.mode === "team") {
    if (count !== TEAM_PLAYER_COUNT) {
      return {
        disabled: true,
        caption: `2v2 needs exactly 4 players. ${count} of ${TEAM_PLAYER_COUNT} have joined.`,
      };
    }
    return { disabled: false, caption: "Everyone is ready" };
  }
  if (count < NORMAL_MIN_PLAYERS) {
    return {
      disabled: true,
      caption: "Invite at least 1 more player to start",
    };
  }
  return { disabled: false, caption: "Everyone is ready" };
}

/** Avatar ring for a filled row: team color in 2v2, else host/neutral ink. */
function ringFor(player: PlayerView, mode: GameMode): AvatarRing {
  if (mode === "team") return player.team === "B" ? "team-b" : "team-a";
  return player.isHost ? "ink" : "ink-muted";
}

export function LobbyRoute() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const view = makeLobbyView(params.get("state"));

  const host = hostOf(view);
  const isHost = host?.id === view.selfId;
  const { code, inviteLink, mode, players } = view.room;

  // Optimistic mode selection (real host mutation is task 9.2). Seeded from the
  // fixture so the control reflects the state being previewed.
  const [selectedMode, setSelectedMode] = useState<GameMode>(mode);
  const [copied, setCopied] = useState(false);

  const teamDisabled = players.length > TEAM_MAX_PLAYERS;
  const { caption, disabled: startDisabled } = startCaption(view);

  async function handleCopyLink() {
    // Optimistic confirmation; the clipboard-failure fallback is task 9.1.
    try {
      await navigator.clipboard?.writeText(inviteLink);
    } catch {
      // Swallowed here — 9.1 wires the toast + manual-copy fallback.
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function handleShare() {
    // Native share sheet with a graceful no-op when unsupported (9.1 adds the
    // clipboard fallback + toast).
    try {
      await navigator.share?.({
        title: "Homemade Uno",
        text: `Join my game — room ${code}`,
        url: inviteLink,
      });
    } catch {
      // User dismissed / unsupported — nothing to do in 8.3.
    }
  }

  return (
    <div className="flex h-full flex-col gap-3 px-5 pt-4 pb-6 pt-safe pb-safe">
      {/* Header — back, "Game room" title, 44px right spacer for symmetry. */}
      <header className="flex h-11 shrink-0 items-center justify-between">
        <IconButton aria-label="Back" onClick={() => navigate("/")}>
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
            onClick={handleShare}
          >
            Share invite
          </Button>
        </div>
      </section>

      {/* Mode control — host editable / guest read-only "chosen by the host". */}
      <ModeControl
        mode={isHost ? selectedMode : mode}
        canEdit={isHost}
        teamDisabled={teamDisabled}
        onModeChange={setSelectedMode}
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
          <TeamArea view={view} isHost={isHost} />
          {/* The dragged row floats over the drop target (screen 02e). The real
              pointer tracking is task 9.2; here it sits near the swap target. */}
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
          disabled={startDisabled}
          onStart={() => navigate(`/room/${code}/game`)}
        />
      ) : (
        <GuestFooter
          hostName={host?.name ?? "the host"}
          onLeave={() => navigate("/")}
        />
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
function TeamArea({ view, isHost }: { view: LobbyView; isHost: boolean }) {
  return (
    <>
      <TeamCard team="a" name="TEAM A">
        <TeamSlots view={view} team="A" isHost={isHost} />
      </TeamCard>
      <TeamCard team="b" name="TEAM B">
        <TeamSlots view={view} team="B" isHost={isHost} />
      </TeamCard>
    </>
  );
}

/**
 * The two seats of one team: filled rows for that team's players (host gets a
 * drag handle), the dragging visuals for screen `02e`, then a dashed
 * "Waiting for a player" slot for each unfilled seat.
 */
function TeamSlots({
  view,
  team,
  isHost,
}: {
  view: LobbyView;
  team: TeamId;
  isHost: boolean;
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

        // The lifted row is drawn detached; its origin seat shows a dashed
        // placeholder (design.md §5.13 / screen 02e).
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
                      onMove={() => {
                        /* keyboard/tap swap wiring is task 9.2 */
                      }}
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

/**
 * The lifted/tilted row following the finger (design.md §5.13 / screen 02e).
 * The real pointer tracking is task 9.2; here it floats as an absolute overlay
 * near the swap target with the `MotionDragRow` lift/tilt + `shadow-card-lifted`
 * treatment. Left-aligned near the top of the player area to overlap the drop
 * target, mirroring the reference.
 */
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
