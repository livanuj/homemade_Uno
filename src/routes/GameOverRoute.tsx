/**
 * Game over route — screen `07-game-over` and its variants (design.md §5.25).
 *
 * The design's `07` is the 2v2 team-win example; the `screen-map.json`
 * "not_yet_designed" notes add three variants that share the same layout:
 *   - Normal-mode single winner ("Maya wins!", one avatar) — Req 12.1
 *   - Guest view ("Waiting for the host" instead of "Play again") — Req 12.5
 *   - "Game ended" (Auto_Pause end): no winner, no confetti — Req 25.13
 *
 * One component renders all four from a `GameResultView`: whether there is a
 * winner, one vs. two winner avatars, the results grouping (by team in 2v2),
 * and host vs. guest primary control are all *state*, not separate screens.
 *
 * The view-model comes from the injectable fixtures seam (task 8.1): the four
 * variants map to the `team-win` / `normal-win` / `guest` / `ended` fixtures in
 * `@/game/view/fixtures`, chosen by a `?state=` query param so Playwright (and
 * links) reach each distinct screen. The realtime Firestore wiring lands in
 * task 5; the "Play again" / "Back to home" interactions are task 9.5 — here
 * the buttons are present with intentional no-op seams.
 *
 * REUSED components (not recreated): `Confetti` (§5.25), `Avatar` (§5.3) for
 * winner avatars + results rows, and `Button` (§5.4) for the primary / soft
 * CTAs. Every value is a token (token-policy.md); no firebase import.
 */
import { Avatar, type AvatarRing } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Confetti } from "@/components/Confetti";
import { makeResultView } from "@/game/view/fixtures";
import type {
  GameResultView,
  ResultPlayerView,
  TeamId,
} from "@/game/view/types";
import { cn } from "@/lib/cn";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { useSearchParams } from "react-router-dom";

/** Team → Avatar ring token. Non-team players (Normal) use the neutral `ink` ring. */
const TEAM_RING: Record<TeamId, AvatarRing> = {
  A: "team-a",
  B: "team-b",
};

/** Team → "Went out" badge fill (matches the team ring color). */
const TEAM_BADGE: Record<TeamId, string> = {
  A: "bg-team-a",
  B: "bg-team-b",
};

/** The ring color for a result row's / winner's avatar. */
function ringFor(player: ResultPlayerView): AvatarRing {
  return player.team ? TEAM_RING[player.team] : "ink";
}

/**
 * One "CARDS LEFT" row: avatar, name, an optional team-colored "Went out"
 * badge on the player who played the last card (Req 12.3), and a count pill.
 */
function ResultRow({ player }: { player: ResultPlayerView }) {
  return (
    <div className="flex h-10 items-center gap-2.5">
      <Avatar name={player.name} size={36} ring={ringFor(player)} />
      <span className="grow text-body font-bold">{player.name}</span>
      {player.wentOut && (
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-caption font-bold text-surface",
            player.team ? TEAM_BADGE[player.team] : "bg-ink",
          )}
        >
          Went out
        </span>
      )}
      <span className="grid h-[26px] min-w-7 place-items-center rounded-full bg-paper px-2 font-display text-caption">
        {player.cardCount}
      </span>
    </div>
  );
}

/**
 * The "CARDS LEFT" results card (§5.25). In 2v2 the rows are grouped by team
 * (winning team first) with a `felt-edge` divider between the two teams; in
 * Normal it is one flat list.
 */
function ResultsCard({ view }: { view: GameResultView }) {
  const isTeam = view.mode === "team";

  let body: React.ReactNode;
  if (isTeam) {
    // Group by team, winning team first (matches the reference: A then B).
    const winningTeam = view.winners[0]?.team;
    const teams: TeamId[] = winningTeam === "B" ? ["B", "A"] : ["A", "B"];
    const rowsFor = (team: TeamId) =>
      view.players.filter((p) => p.team === team);
    body = (
      <>
        {teams.map((team, i) => (
          <div key={team} className="flex flex-col gap-1">
            {i > 0 && <div className="my-1 h-px bg-line" />}
            {rowsFor(team).map((p) => (
              <ResultRow key={p.id} player={p} />
            ))}
          </div>
        ))}
      </>
    );
  } else {
    body = view.players.map((p) => <ResultRow key={p.id} player={p} />);
  }

  return (
    <div className="flex flex-col gap-1 rounded-panel bg-surface p-4 shadow-panel">
      <span className="text-caption font-display uppercase tracking-wide text-ink-muted">
        Cards left
      </span>
      {body}
    </div>
  );
}

export function GameOverRoute() {
  const [params] = useSearchParams();
  const view = makeResultView(params.get("state"));
  const reduced = usePrefersReducedMotion();

  const hasWinner = view.kind !== "none";

  return (
    <main className="relative flex h-dvh flex-col gap-[18px] overflow-hidden bg-paper px-5 pt-4 pb-7 pt-safe pb-safe">
      {/* Confetti bursts only when there IS a winner (no confetti for "Game ended", Req 25.13). */}
      {hasWinner && <Confetti reduced={reduced} />}

      {/* Winners + title */}
      <div className="relative flex flex-col items-center gap-3.5 pt-24">
        {view.winners.length > 0 && (
          <div className="flex">
            {view.winners.map((w, i) => (
              <Avatar
                key={w.id}
                name={w.name}
                size={44}
                ring={ringFor(w)}
                className={cn("shadow-cta", i > 0 && "-ml-4")}
              />
            ))}
          </div>
        )}
        <div className="flex flex-col items-center gap-1.5 text-center">
          <h1 className="font-display text-hero">{view.title}</h1>
          {view.subtitle && (
            <p className="text-paragraph text-ink-muted">{view.subtitle}</p>
          )}
        </div>
      </div>

      <ResultsCard view={view} />

      <div className="grow" />

      {/* Primary control: host "Play again" vs. guest waiting; "Back to home" for all. */}
      <div className="relative flex flex-col items-center gap-2.5">
        {view.selfIsHost ? (
          <>
            <Button
              variant="primary"
              onClick={() => {
                /* task 9.5 wires "Play again" (return to lobby, bump round) */
              }}
            >
              Play again
            </Button>
            <span className="text-label font-semibold text-ink-muted">
              Everyone stays in room {view.room.code}
            </span>
          </>
        ) : (
          <span
            className="flex h-14 w-full items-center justify-center rounded-full bg-line text-cta font-display text-ink-muted"
            role="status"
          >
            Waiting for the host
          </span>
        )}
        <Button
          variant="soft"
          className="w-full"
          onClick={() => {
            /* task 9.5 wires "Back to home" navigation */
          }}
        >
          Back to home
        </Button>
      </div>
    </main>
  );
}
