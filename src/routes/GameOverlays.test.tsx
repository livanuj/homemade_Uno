import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { GameRoute } from "./GameRoute";

/**
 * Tests for the five in-game overlays (screens `05-menu`, `06a`–`06d`, task
 * 8.5). Each overlay is composed from the task-6/7 components and mounted OVER
 * the game table via the `overlay` slot, reached from the route by an
 * `?overlay=` query param. These render `GameRoute` at
 * `/room/K7QX/game?overlay=…` so a route reaches each distinct state, exactly
 * as Playwright does.
 */
function renderOverlay(overlay: string, state = "04") {
  render(
    <MemoryRouter
      initialEntries={[`/room/K7QX/game?state=${state}&overlay=${overlay}`]}
    >
      <GameRoute />
    </MemoryRouter>,
  );
}

describe("05-menu — the in-game menu drawer", () => {
  it("shows the three switches, Pause game, How to play, and Leave game", () => {
    renderOverlay("menu");
    const drawer = screen.getByRole("dialog", { name: "Menu" });
    expect(within(drawer).getByText("Sound effects")).toBeInTheDocument();
    expect(
      within(drawer).getByText("Highlight playable cards"),
    ).toBeInTheDocument();
    expect(
      within(drawer).getByRole("button", { name: "Pause game" }),
    ).toBeInTheDocument();
    expect(
      within(drawer).getByRole("button", { name: "How to play" }),
    ).toBeInTheDocument();
    expect(
      within(drawer).getByRole("button", { name: "Leave game" }),
    ).toBeInTheDocument();
  });

  it("shows the room code and a Copy link button", () => {
    renderOverlay("menu");
    const drawer = screen.getByRole("dialog", { name: "Menu" });
    expect(within(drawer).getByText("ROOM · K7QX")).toBeInTheDocument();
    expect(
      within(drawer).getByRole("button", { name: "Copy link" }),
    ).toBeInTheDocument();
  });

  it("opens the leave-confirm dialog when Leave game is pressed", async () => {
    const user = userEvent.setup();
    renderOverlay("menu");
    await user.click(screen.getByRole("button", { name: "Leave game" }));
    const dialog = screen.getByRole("alertdialog", {
      name: "Leave this game?",
    });
    expect(dialog).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Stay in game" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Leave game" }),
    ).toBeInTheDocument();
  });
});

describe("06a-wild-color-picker — the wild color picker sheet", () => {
  it("shows the four color buttons and NO cancel option (Req 8.1/8.2/9.6)", () => {
    renderOverlay("wild");
    const sheet = screen.getByRole("dialog", { name: "Choose a color" });
    expect(
      within(sheet).getByRole("button", { name: "Red" }),
    ).toBeInTheDocument();
    expect(
      within(sheet).getByRole("button", { name: "Yellow" }),
    ).toBeInTheDocument();
    expect(
      within(sheet).getByRole("button", { name: "Green" }),
    ).toBeInTheDocument();
    expect(
      within(sheet).getByRole("button", { name: "Blue" }),
    ).toBeInTheDocument();
    // No cancel / close / dismiss affordance in the picker (§5.16).
    expect(
      within(sheet).queryByRole("button", { name: /cancel/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /close/i }),
    ).not.toBeInTheDocument();
  });

  it("shows who draws next (Req 9.6)", () => {
    renderOverlay("wild");
    expect(
      screen.getByText("Leo draws 4 unless he can stack"),
    ).toBeInTheDocument();
  });
});

describe("06b-drew-playable-card — the drew-a-card sheet", () => {
  it("shows the drawn card fits line and Play it / Keep it (Req 10.2)", () => {
    renderOverlay("drew");
    expect(screen.getByText("Red 3 fits the pile")).toBeInTheDocument();
    expect(screen.getByText("You drew")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play it" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep it" })).toBeInTheDocument();
  });
});

describe("06c-player-disconnected — a disconnected table state", () => {
  it("shows the waiting/skipping pill, Pause and wait, and the lost-connection toast (Req 15.1/15.3/15.5)", () => {
    renderOverlay("disconnected");
    expect(
      screen.getByText("Waiting for Nora · skipping in 42s"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Pause and wait" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Nora lost connection")).toBeInTheDocument();
    // The disconnected seat is marked offline (accessible label from OfflineAvatar).
    expect(
      screen.getByRole("img", { name: /Nora is offline/ }),
    ).toBeInTheDocument();
  });
});

describe("06d-leave-confirm — the leave-confirm dialog", () => {
  it("shows the title, explanation, and Stay in game / Leave game (Req 22.1)", () => {
    renderOverlay("leave");
    const dialog = screen.getByRole("alertdialog", {
      name: "Leave this game?",
    });
    expect(within(dialog).getByText(/turns are skipped/i)).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Stay in game" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Leave game" }),
    ).toBeInTheDocument();
  });
});
