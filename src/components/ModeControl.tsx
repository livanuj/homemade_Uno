import { cn } from "@/lib/cn";
import { useId } from "react";
import { InfoNote } from "./InfoNote";

/**
 * Game mode control (design.md §5.9).
 *
 * Host (editable): a `role="radiogroup"` segmented control with two options —
 * "Normal" and "Play 2v2" — plus a description line, and (only when 2v2 is
 * disabled) an `InfoNote` (§5.22) explaining why. Guest (read-only): the label
 * reads "Game mode · chosen by the host" and the control is replaced with the
 * mode icon plus "Normal game" / "2v2 teams" text.
 *
 * Reuses the existing `InfoNote` primitive. All coloring comes from static
 * class maps (styling.md) referencing theme tokens (token-policy.md).
 */
export type GameMode = "normal" | "team";

const MODE_DESCRIPTION: Record<GameMode, string> = {
  normal: "Everyone plays for themselves. 2 to 8 players.",
  team: "Two teams of two. Partners see each other's cards. Needs exactly 4 players.",
};

const GUEST_MODE_TEXT: Record<GameMode, string> = {
  normal: "Normal game",
  team: "2v2 teams",
};

interface ModeControlProps {
  /** The currently selected mode. */
  mode: GameMode;
  /** Whether the caller is the host (editable) or a guest (read-only). */
  canEdit: boolean;
  /** When true, "Play 2v2" is disabled and the info note is shown (5+ players). */
  teamDisabled?: boolean;
  /** Fired with the newly chosen mode (host only). */
  onModeChange: (mode: GameMode) => void;
  className?: string;
}

/** Panel shell shared by host and guest variants (design.md §5.9). */
const PANEL_CLASS =
  "flex flex-col gap-2.5 rounded-section bg-surface px-3.5 pt-3 pb-3.5 shadow-panel";

export function ModeControl({
  mode,
  canEdit,
  teamDisabled = false,
  onModeChange,
  className,
}: ModeControlProps) {
  const noteId = useId();

  if (!canEdit) {
    return (
      <section className={cn(PANEL_CLASS, className)}>
        <p className="text-label text-ink-muted">
          Game mode · chosen by the host
        </p>
        <p className="flex items-center gap-2 text-input font-extrabold text-ink">
          {mode === "team" ? <TeamIcon /> : <NormalIcon />}
          {GUEST_MODE_TEXT[mode]}
        </p>
      </section>
    );
  }

  return (
    <section className={cn(PANEL_CLASS, className)}>
      <p className="text-label text-ink-muted">Game mode</p>
      <div
        role="radiogroup"
        aria-label="Game mode"
        className="grid grid-cols-2 gap-1 rounded-full bg-paper p-1"
      >
        <ModeOption
          selected={mode === "normal"}
          onSelect={() => onModeChange("normal")}
          icon={<NormalIcon />}
          label="Normal"
        />
        <ModeOption
          selected={mode === "team"}
          disabled={teamDisabled}
          describedBy={teamDisabled ? noteId : undefined}
          onSelect={() => onModeChange("team")}
          icon={<TeamIcon />}
          label="Play 2v2"
        />
      </div>
      <p className="text-label font-medium text-ink-muted">
        {MODE_DESCRIPTION[mode]}
      </p>
      {teamDisabled && (
        <InfoNote className="mt-0.5">
          <span id={noteId}>
            2v2 needs exactly 4 players. It unlocks if the room gets back to 4.
          </span>
        </InfoNote>
      )}
    </section>
  );
}

interface ModeOptionProps {
  selected: boolean;
  disabled?: boolean;
  describedBy?: string | undefined;
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
}

/**
 * One segment of the radiogroup (design.md §5.9). Selected uses `bg-ink
 * text-surface`; unselected is transparent `text-ink`; disabled dims to 40%.
 */
function ModeOption({
  selected,
  disabled = false,
  describedBy,
  onSelect,
  icon,
  label,
}: ModeOptionProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex h-11 items-center justify-center gap-2 rounded-full text-body font-extrabold",
        selected
          ? "bg-ink text-surface shadow-panel"
          : "bg-transparent text-ink",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/** "Normal" icon (design.md §5.9): four small circles, 18px stroke. */
function NormalIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="17" cy="7" r="2.5" />
      <circle cx="7" cy="17" r="2.5" />
      <circle cx="17" cy="17" r="2.5" />
    </svg>
  );
}

/** "Play 2v2" icon (design.md §5.9): two overlapping 12px dots in team colors. */
function TeamIcon() {
  return (
    <span aria-hidden="true" className="relative inline-block h-3 w-[18px]">
      <span className="absolute left-0 top-0 size-3 rounded-full bg-team-a" />
      <span className="absolute right-0 top-0 size-3 rounded-full bg-team-b" />
    </span>
  );
}
