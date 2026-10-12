/**
 * PausedOverlay — the pause states over the game table (design.md §11/§12,
 * screens `08a-paused`, `08b-paused-waiting`, `08c-paused-team-offline`).
 *
 * A centered card (same shell as the Dialog, §5.18) over a `bg-ink/50`
 * backdrop, `role="dialog"`, with three variants driven by `variant`:
 *
 * - `break`   (`08a`) — a manual pause: a Pause glyph in a `bg-paper` circle,
 *   "Game paused", "[name] paused the game…", the "Paused for m:ss" pill, and a
 *   primary "Resume game" action (Req 25.3, 25.4, 25.7).
 * - `waiting` (`08b`) — paused to wait for a disconnected player: an
 *   `OfflineAvatar` header, "Waiting for [name]", the elapsed pill, and an
 *   outline "Continue without [name]" action with a helper caption (Req 25.5,
 *   25.8, 25.9).
 * - `auto`    (`08c`) — server auto-pause because a team / players are offline:
 *   an `OfflineAvatar` + team label header, "[Team] lost connection", the
 *   elapsed pill, and a danger "End game" action (Req 25.8, 25.10, 25.13).
 *
 * Callers pass the copy (`title`, `body`, `primaryLabel`, offline `name`,
 * `elapsedLabel`) and the primary handler; the menu stays available while
 * paused (Req 25.15) and is rendered by the table, not here. Reuses `Backdrop`,
 * `Button`, `OfflineAvatar` (reuse-before-create). Tokens only
 * (token-policy.md). Motion (overlay fade) and focus management are wired in
 * tasks 7 and 10; `className` is the seam.
 */
import { useId } from "react";
import { cn } from "@/lib/cn";
import { Backdrop } from "./Backdrop";
import { Button } from "./Button";
import { OfflineAvatar } from "./OfflineAvatar";

export type PausedVariant = "break" | "waiting" | "auto";

/** Team → label color for the `auto` variant header (tokens only). */
const TEAM_LABEL: Record<"A" | "B", string> = {
  A: "text-team-a",
  B: "text-team-b",
};

export interface PausedOverlayProps {
  variant: PausedVariant;
  /** Heading (`text-sheet`), e.g. "Game paused", "Waiting for Nora". */
  title: string;
  /** Explanation paragraph under the title. */
  body: string;
  /** "Paused for m:ss" pill text. */
  elapsedLabel: string;
  /**
   * Offline player's name — shown in the `OfflineAvatar` header for the
   * `waiting` and `auto` variants.
   */
  offlineName?: string;
  /** Offline player's remaining card count (badge on the header avatar). */
  offlineCardCount?: number;
  /** Team label for the `auto` variant header (e.g. "B"). */
  offlineTeam?: "A" | "B";
  /**
   * Helper caption under the primary action (e.g. "Nora's turns will be
   * skipped until she returns") — used by the `waiting` variant.
   */
  primaryCaption?: string;
  /** Primary action handler: Resume / Continue without / End game. */
  onPrimary: () => void;
  className?: string;
}

/** Pause glyph shown in the `break` variant's `bg-paper` circle. */
function PauseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1.5" />
      <rect x="14" y="5" width="4" height="14" rx="1.5" />
    </svg>
  );
}

/** Per-variant primary button treatment (§5.4). */
const PRIMARY_VARIANT = {
  break: "primary",
  waiting: "outline",
  auto: "danger",
} as const;

export function PausedOverlay({
  variant,
  title,
  body,
  elapsedLabel,
  offlineName,
  offlineCardCount,
  offlineTeam,
  primaryCaption,
  onPrimary,
  className,
}: PausedOverlayProps) {
  const titleId = useId();
  const bodyId = useId();
  const primaryLabel =
    variant === "break"
      ? "Resume game"
      : variant === "waiting"
        ? `Continue without ${offlineName ?? "them"}`
        : "End game";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center px-6">
      {/* Backdrop is inert: pausing is not dismissed by tapping outside. */}
      <Backdrop />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className={cn(
          "relative flex w-[calc(100%-48px)] max-w-[342px] flex-col gap-[18px]",
          "bg-surface rounded-panel shadow-cta p-6",
          className,
        )}
      >
        {/* Header: pause glyph (break) or offline avatar (waiting / auto). */}
        {variant === "break" ? (
          <span className="grid size-12 place-items-center rounded-full bg-paper text-ink">
            <PauseIcon />
          </span>
        ) : (
          <div className="flex items-center gap-3">
            <OfflineAvatar name={offlineName ?? "?"} cardCount={offlineCardCount} />
            {variant === "auto" && offlineTeam ? (
              <span
                className={cn(
                  "text-caption font-extrabold tracking-[0.06em]",
                  TEAM_LABEL[offlineTeam],
                )}
              >
                TEAM {offlineTeam}
              </span>
            ) : (
              offlineName && (
                <span className="text-label text-ink-muted">
                  {offlineName} · offline
                </span>
              )
            )}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <h2 id={titleId} className="font-display text-sheet text-ink">
            {title}
          </h2>
          <p id={bodyId} className="text-paragraph text-ink-muted">
            {body}
          </p>
        </div>

        {/* "Paused for m:ss" pill with a turn-colored dot. */}
        <span className="inline-flex items-center gap-2 self-start rounded-full bg-paper px-3 py-2 text-label text-ink">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-turn" />
          {elapsedLabel}
        </span>

        <div className="flex flex-col gap-1.5">
          <Button
            variant={PRIMARY_VARIANT[variant]}
            onClick={onPrimary}
            className="w-full"
          >
            {primaryLabel}
          </Button>
          {primaryCaption && (
            <p className="text-center text-label font-semibold text-ink-muted">
              {primaryCaption}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
