/**
 * MenuDrawer — the in-game menu (design.md §5.10, screen `05-menu`).
 *
 * A 322px right-side drawer (`w-[82.5%] max-w-[340px]`) over a `bg-ink/50`
 * backdrop. Tapping the backdrop or the close button calls `onClose`. Sections
 * top to bottom (§5.10): title "Menu" + close, room box (on `paper`) with Copy
 * link, "CARDS LEFT" (grouped by team in 2v2), a divider, three switches
 * (Sound / Vibration / Highlight), a spacer, then "How to play" (soft) and
 * "Leave game" (danger, opens the leave-confirm dialog).
 *
 * Reuses primitives (component-architecture.md — reuse before create):
 * `Backdrop`, `IconButton`, `Button`, `Switch`. Every value is a token
 * (token-policy.md); suit/team classes come from static maps (styling.md).
 *
 * Structure only — the slide-in animation, Escape handling, and focus trap are
 * wired in tasks 7 and 10. The panel exposes `onClose` and accepts `className`
 * as the seam for the drawer-slide motion.
 */
import { cn } from "@/lib/cn";
import { Backdrop } from "./Backdrop";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { Switch } from "./Switch";

/** A player's remaining-card count, shown under "CARDS LEFT". */
export interface MenuCardCount {
  playerId: string;
  name: string;
  count: number;
  /** Team for 2v2 grouping / ring color; omitted in Normal. */
  team?: "A" | "B";
}

/** Team → dot color (static map, tokens only). */
const TEAM_DOT: Record<"A" | "B", string> = {
  A: "bg-team-a",
  B: "bg-team-b",
};

/** Team → label color. */
const TEAM_LABEL: Record<"A" | "B", string> = {
  A: "text-team-a",
  B: "text-team-b",
};

export interface MenuDrawerProps {
  /** Room code shown in the room box (e.g. "K7QX"). */
  roomCode: string;
  /** Remaining-card counts; grouped by team when `team` is present. */
  cardCounts: MenuCardCount[];
  /** Whether this is a 2v2 room (drives team grouping of "CARDS LEFT"). */
  isTeamMode?: boolean;
  soundOn: boolean;
  vibrationOn: boolean;
  highlightOn: boolean;
  /** Hide the Vibration row on devices without vibration (Req 16.7). */
  vibrationSupported?: boolean;
  onSoundChange: (on: boolean) => void;
  onVibrationChange: (on: boolean) => void;
  onHighlightChange: (on: boolean) => void;
  onCopyLink: () => void;
  onPause: () => void;
  onHowToPlay: () => void;
  /** Opens the leave-confirm dialog (§5.18). */
  onLeave: () => void;
  /** Tap-backdrop-to-close / close-button (§5.10). */
  onClose: () => void;
  className?: string;
}

function CardCountRow({ entry }: { entry: MenuCardCount }) {
  return (
    <li className="flex items-center justify-between px-1 py-1.5">
      <span className="flex items-center gap-2">
        {entry.team && (
          <span
            aria-hidden="true"
            className={cn("size-2.5 rounded-full", TEAM_DOT[entry.team])}
          />
        )}
        <span className="text-body font-semibold text-ink">{entry.name}</span>
      </span>
      <span className="text-body font-extrabold text-ink">{entry.count}</span>
    </li>
  );
}

export function MenuDrawer({
  roomCode,
  cardCounts,
  isTeamMode = false,
  soundOn,
  vibrationOn,
  highlightOn,
  vibrationSupported = true,
  onSoundChange,
  onVibrationChange,
  onHighlightChange,
  onCopyLink,
  onPause,
  onHowToPlay,
  onLeave,
  onClose,
  className,
}: MenuDrawerProps) {
  const teamA = cardCounts.filter((c) => c.team === "A");
  const teamB = cardCounts.filter((c) => c.team === "B");

  return (
    <div className="fixed inset-0 z-40">
      <Backdrop onActivate={onClose} label="Close menu" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="menu-drawer-title"
        className={cn(
          "absolute inset-y-0 right-0 flex w-[82.5%] max-w-[340px] flex-col gap-[18px]",
          "bg-surface rounded-l-drawer shadow-drawer px-5 pb-safe pt-safe",
          className,
        )}
      >
        {/* 1. Title + close button. */}
        <div className="flex items-center justify-between pt-5">
          <h2
            id="menu-drawer-title"
            className="font-display text-sheet text-ink"
          >
            Menu
          </h2>
          <IconButton aria-label="Close" onClick={onClose}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </IconButton>
        </div>

        {/* 2. Room box (on paper) with Copy link. */}
        <div className="flex items-center justify-between rounded-row bg-paper px-3.5 py-3">
          <span className="text-label tracking-[0.08em] text-ink">
            ROOM · {roomCode}
          </span>
          <Button variant="outline" onClick={onCopyLink} className="h-9 px-4">
            Copy link
          </Button>
        </div>

        {/* 3. CARDS LEFT, grouped by team in 2v2. */}
        <div className="flex flex-col gap-1.5">
          <p className="text-caption font-extrabold tracking-[0.08em] text-ink-muted">
            CARDS LEFT
          </p>
          {isTeamMode ? (
            <div className="flex flex-col gap-2.5">
              {(
                [
                  ["A", teamA],
                  ["B", teamB],
                ] as const
              ).map(([team, members]) => (
                <div key={team} className="flex flex-col">
                  <p
                    className={cn(
                      "text-caption font-extrabold tracking-[0.06em]",
                      TEAM_LABEL[team],
                    )}
                  >
                    TEAM {team}
                  </p>
                  <ul>
                    {members.map((entry) => (
                      <CardCountRow key={entry.playerId} entry={entry} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <ul>
              {cardCounts.map((entry) => (
                <CardCountRow key={entry.playerId} entry={entry} />
              ))}
            </ul>
          )}
        </div>

        {/* 4. Divider. */}
        <hr className="border-0 border-t border-felt-edge" />

        {/* 5. Three switches. */}
        <div className="flex flex-col">
          <div className="flex min-h-14 items-center justify-between">
            <span id="menu-sound-label" className="text-body text-ink">
              Sound effects
            </span>
            <Switch
              aria-labelledby="menu-sound-label"
              checked={soundOn}
              onCheckedChange={onSoundChange}
            />
          </div>
          {vibrationSupported && (
            <div className="flex min-h-14 items-center justify-between">
              <span id="menu-vibration-label" className="text-body text-ink">
                Vibration
              </span>
              <Switch
                aria-labelledby="menu-vibration-label"
                checked={vibrationOn}
                onCheckedChange={onVibrationChange}
              />
            </div>
          )}
          <div className="flex min-h-14 items-center justify-between">
            <span id="menu-highlight-label" className="text-body text-ink">
              Highlight playable cards
            </span>
            <Switch
              aria-labelledby="menu-highlight-label"
              checked={highlightOn}
              onCheckedChange={onHighlightChange}
            />
          </div>
        </div>

        {/* 6. Spacer pushes the actions to the bottom. */}
        <div className="flex-1" />

        {/* 7. Pause game, How to play, Leave game (danger → confirm dialog). */}
        <div className="flex flex-col gap-2.5 pb-5">
          <Button variant="primary" onClick={onPause}>
            Pause game
          </Button>
          <Button variant="soft" onClick={onHowToPlay}>
            How to play
          </Button>
          <Button variant="danger" onClick={onLeave}>
            Leave game
          </Button>
        </div>
      </aside>
    </div>
  );
}
