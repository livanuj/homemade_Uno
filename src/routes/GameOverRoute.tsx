/**
 * Game over route — screen `07-game-over` and its variants (design.md §5.25).
 *
 * One presentational component (`GameOverScreen`) renders all four variants
 * from a `GameResultView`: winner vs. no-winner, one vs. two winner avatars,
 * team vs. flat results grouping, and host "Play again" vs. guest waiting.
 *
 * Two containers feed it:
 *  - `LiveGameOver` (the real route): derives the `GameResultView` from the
 *    live realtime channel (`state/current.phase === "ended"`, `winner`, plus
 *    each player's denormalized count) through `mappers.ts`, wires "Play again"
 *    (host → `playAgain`, returns everyone to the lobby with the round bumped)
 *    and "Back to home" to the Cloud Functions / navigation. Host transfer is
 *    handled server-side on leave, so `selfIsHost` simply reflects the current
 *    host after any succession (Req 12.7).
 *  - `FixtureGameOver` (preview/tests): when a `?state=` param is present,
 *    renders the Task-8 fixture variant so Playwright captures and the unit
 *    tests keep working.
 *
 * REUSED components: `Confetti`, `Avatar`, `Button`. Tokens only.
 */
import { Avatar, type AvatarRing } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Confetti } from "@/components/Confetti";
import { callAction } from "@/firebase/callAction";
import { useSession } from "@/firebase/useSession";
import { makeResultView } from "@/game/view/fixtures";
import { toResultView } from "@/game/view/mappers";
import type {
  GameResultView,
  ResultPlayerView,
  TeamId,
} from "@/game/view/types";
import { cn } from "@/lib/cn";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { useRoomChannel } from "@/realtime/useRoomChannel";
import { useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

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

/** Handlers for the result screen; a container supplies them. */
interface ResultHandlers {
  onPlayAgain(): void;
  onBackHome(): void;
}

/** The default route: fixture preview when `?state=` is set, else live. */
export function GameOverRoute() {
  const [params] = useSearchParams();
  if (params.get("state")) return <FixtureGameOver />;
  return <LiveGameOver />;
}

// ---------------------------------------------------------------------------
// Live container.
// ---------------------------------------------------------------------------

function LiveGameOver() {
  const navigate = useNavigate();
  const { code } = useParams();
  const { playerId } = useSession();
  const roomId = code ?? null;
  const { store } = useRoomChannel(roomId, playerId);

  const view = useMemo(() => toResultView(store), [store]);

  // The host's "Play again" returns everyone to the lobby; guests follow when
  // the room flips back to `lobby` via the room snapshot.
  useEffect(() => {
    if (store.room?.phase === "lobby") {
      navigate(`/room/${code}`, { replace: true });
    }
  }, [store.room?.phase, code, navigate]);

  if (!view || !roomId) {
    return <ResultLoading />;
  }

  const handlers: ResultHandlers = {
    onPlayAgain: () => void callAction("playAgain", { roomId }),
    onBackHome: () => navigate("/"),
  };

  return <GameOverScreen view={view} handlers={handlers} />;
}

/** Loading shell until the ended state hydrates. */
function ResultLoading() {
  return (
    <main className="grid h-dvh w-full place-items-center bg-paper">
      <span role="status" className="text-body text-ink-muted">
        Tallying the round…
      </span>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Fixture container (preview / tests via ?state=).
// ---------------------------------------------------------------------------

function FixtureGameOver() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const view = makeResultView(params.get("state"));
  const handlers: ResultHandlers = {
    onPlayAgain: () => {
      /* preview seam */
    },
    onBackHome: () => navigate("/"),
  };
  return <GameOverScreen view={view} handlers={handlers} />;
}

// ---------------------------------------------------------------------------
// Presentational screen + pieces.
// ---------------------------------------------------------------------------

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
 * (winning team first); in Normal it is one flat list.
 */
function ResultsCard({ view }: { view: GameResultView }) {
  const isTeam = view.mode === "team";

  let body: React.ReactNode;
  if (isTeam) {
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

function GameOverScreen({
  view,
  handlers,
}: {
  view: GameResultView;
  handlers: ResultHandlers;
}) {
  const reduced = usePrefersReducedMotion();
  const hasWinner = view.kind !== "none";

  return (
    <main className="relative flex h-dvh flex-col gap-[18px] overflow-hidden bg-paper px-5 pt-4 pb-7 pt-safe pb-safe">
      {/* Confetti bursts only when there IS a winner (Req 25.13). */}
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

      {/* Primary control: host "Play again" vs. guest waiting; "Back to home". */}
      <div className="relative flex flex-col items-center gap-2.5">
        {view.selfIsHost ? (
          <>
            <Button variant="primary" onClick={handlers.onPlayAgain}>
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
        <Button variant="soft" className="w-full" onClick={handlers.onBackHome}>
          Back to home
        </Button>
      </div>
    </main>
  );
}
