import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/**
 * Team card (design.md §5.8) — the 2v2 lobby panel for one team.
 *
 * `bg-surface rounded-section shadow-panel px-3 py-2.5 flex flex-col gap-1.5`
 * with a header of a 12px team-color dot plus the team name (`text-label
 * font-extrabold tracking-[0.06em]`, team color). It holds two slots, each a
 * `PlayerRow` (filled) or an `EmptySlot` (§5.12) — passed as `children` by the
 * lobby route so this stays a pure structural container.
 */
export type Team = "a" | "b";

/** Team → header dot fill (static map, styling.md — token classes only). */
const TEAM_DOT: Record<Team, string> = {
  a: "bg-team-a",
  b: "bg-team-b",
};

/** Team → header label text color. */
const TEAM_LABEL: Record<Team, string> = {
  a: "text-team-a",
  b: "text-team-b",
};

interface TeamCardProps {
  /** Which team this card represents; drives the header dot and label color. */
  team: Team;
  /** Team name shown in the header, e.g. "Team A". */
  name: string;
  /** The two seat slots (`PlayerRow` or `EmptySlot`). */
  children: ReactNode;
  className?: string;
}

export function TeamCard({ team, name, children, className }: TeamCardProps) {
  return (
    <section
      className={cn(
        "flex flex-col gap-1.5 rounded-section bg-surface px-3 py-2.5 shadow-panel",
        className,
      )}
    >
      <header className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={cn("size-3 rounded-full", TEAM_DOT[team])}
        />
        <span
          className={cn(
            "text-label font-extrabold tracking-[0.06em]",
            TEAM_LABEL[team],
          )}
        >
          {name}
        </span>
      </header>
      {children}
    </section>
  );
}
