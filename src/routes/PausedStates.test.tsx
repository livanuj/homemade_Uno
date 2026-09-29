import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { GameRoute } from "./GameRoute";

/**
 * Tests for the paused overlays (screens `08a-paused`, `08b-paused-waiting`,
 * `08c-paused-team-offline`, task 8.7). The `PausedOverlay` (§11/§12) is
 * composed OVER the game table and reached via `?overlay=` on the game route,
 * so each variant is a distinct, backend-free screen. The resume / continue /
 * end-game interactions are task 9.6; here we assert the states render with the
 * right copy, controls, and that the table's menu stays reachable (Req 25.15).
 */

function renderPaused(overlay: string, state = "03") {
  render(
    <MemoryRouter
      initialEntries={[`/room/K7QX/game?state=${state}&overlay=${overlay}`]}
    >
      <GameRoute />
    </MemoryRouter>,
  );
}

describe("Paused overlays — break variant (08a)", () => {
  it("shows 'Game paused', who paused, elapsed, and a Resume game action (Req 25.3/25.4/25.7)", async () => {
    renderPaused("paused-break");
    // The overlay mounts through `AnimatePresence`, so await its appearance.
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Game paused");
    expect(dialog).toHaveTextContent(/Maya paused the game/);
    expect(dialog).toHaveTextContent("Paused for 2:14");
    expect(
      screen.getByRole("button", { name: "Resume game" }),
    ).toBeInTheDocument();
  });
});

describe("Paused overlays — waiting variant (08b)", () => {
  it("shows 'Waiting for [name]', the offline avatar, and Continue without [name] (Req 25.5/25.8/25.9)", async () => {
    renderPaused("paused-waiting", "04");
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Waiting for Nora");
    // The disconnected player's faded OfflineAvatar (role="img") is present.
    expect(
      screen.getByRole("img", { name: /Nora is offline/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continue without Nora" }),
    ).toBeInTheDocument();
    // Their turns will be skipped note.
    expect(dialog).toHaveTextContent(/turns will be skipped/);
  });
});

describe("Paused overlays — auto variant (08c)", () => {
  it("shows the team-offline message and a red End game action (Req 25.10/25.11/25.13)", async () => {
    renderPaused("paused-auto");
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Team B lost connection");
    expect(dialog).toHaveTextContent(/resumes when Leo or Sara comes back/);
    const endGame = screen.getByRole("button", { name: "End game" });
    expect(endGame).toBeInTheDocument();
    // The danger treatment is red (§5.4 danger variant → danger-toned text/border).
    expect(endGame.className).toContain("text-danger");
  });
});

describe("Paused overlays — menu stays available (Req 25.15)", () => {
  it("keeps the in-game menu button reachable while paused", () => {
    renderPaused("paused-break");
    // The table's top-bar menu button is still in the document behind/with the
    // overlay — pausing does not remove it.
    expect(screen.getByRole("button", { name: "Menu" })).toBeInTheDocument();
  });
});

describe("Paused overlays — no overlay id renders the plain table", () => {
  it("does not render a paused dialog for an unknown overlay value", () => {
    renderPaused("something-else", "04");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
