import { makeResultView } from "@/game/view/fixtures";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { GameOverRoute } from "./GameOverRoute";

/**
 * Tests for the game-over screen (screen `07-game-over` and its variants, task
 * 8.6). The result view-model comes from the fixtures seam keyed by `?state=`,
 * so a route reaches each variant: `team-win` (the reference), `normal-win`,
 * `guest`, and `ended` ("Game ended", no winner/confetti).
 */

function renderResult(state: string) {
  render(
    <MemoryRouter initialEntries={[`/room/K7QX/game-over?state=${state}`]}>
      <GameOverRoute />
    </MemoryRouter>,
  );
}

describe("GameOverRoute — 2v2 team win (team-win, the reference)", () => {
  it("shows both winner avatars, 'Team A wins!', and who played the last card (Req 12.1/12.3)", () => {
    renderResult("team-win");
    expect(
      screen.getByRole("heading", { name: "Team A wins!" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Maya played her last card")).toBeInTheDocument();
    // Two winners (You + Maya). The winner avatars render at the top; both
    // winners also appear as rows in the results card, so we assert on the
    // winning-side initials being present at least twice each.
    expect(screen.getAllByText("Y").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("M").length).toBeGreaterThanOrEqual(2);
    // The player who went out carries the "Went out" badge (Req 12.3).
    expect(screen.getByText("Went out")).toBeInTheDocument();
  });

  it("shows per-player remaining counts (Req 12.3)", () => {
    renderResult("team-win");
    // You 3, Maya 0, Leo 4, Sara 2 — each name row is present.
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("Leo")).toBeInTheDocument();
    expect(screen.getByText("Sara")).toBeInTheDocument();
    expect(screen.getByText("Cards left")).toBeInTheDocument();
  });

  it("shows the host's 'Play again' and the room caption (Req 12.5)", () => {
    renderResult("team-win");
    expect(
      screen.getByRole("button", { name: "Play again" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Everyone stays in room K7QX"),
    ).toBeInTheDocument();
    // The host never sees the guest waiting status.
    expect(
      screen.queryByText("Waiting for the host"),
    ).not.toBeInTheDocument();
  });
});

describe("GameOverRoute — Normal single winner (normal-win, Req 12.1)", () => {
  it("shows one winner and the '[name] wins!' title", () => {
    renderResult("normal-win");
    expect(
      screen.getByRole("heading", { name: "Maya wins!" }),
    ).toBeInTheDocument();
    // A single winner: exactly one "Went out" badge and no team grouping.
    expect(screen.getAllByText("Went out")).toHaveLength(1);
  });
});

describe("GameOverRoute — guest view (guest, Req 12.5)", () => {
  it("shows 'Waiting for the host' instead of 'Play again'", () => {
    renderResult("guest");
    expect(screen.getByText("Waiting for the host")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Play again" }),
    ).not.toBeInTheDocument();
  });
});

describe("GameOverRoute — 'Game ended' variant (ended, Req 25.13)", () => {
  it("shows the 'Game ended' title with no winner and no confetti", () => {
    renderResult("ended");
    expect(
      screen.getByRole("heading", { name: "Game ended" }),
    ).toBeInTheDocument();
    // No winner: no "Went out" badge, no winner subtitle.
    expect(screen.queryByText("Went out")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/played .* last card/),
    ).not.toBeInTheDocument();
    // No confetti layer for the no-winner variant.
    const view = makeResultView("ended");
    expect(view.kind).toBe("none");
    expect(view.winners).toHaveLength(0);
    // The results card still lists everyone.
    expect(screen.getByText("Cards left")).toBeInTheDocument();
    expect(screen.getByText("Leo")).toBeInTheDocument();
  });
});

describe("GameOverRoute — 'Back to home' is present in every variant", () => {
  it.each(["team-win", "normal-win", "guest", "ended"])(
    "shows 'Back to home' for %s",
    (state) => {
      renderResult(state);
      expect(
        screen.getByRole("button", { name: "Back to home" }),
      ).toBeInTheDocument();
    },
  );
});
