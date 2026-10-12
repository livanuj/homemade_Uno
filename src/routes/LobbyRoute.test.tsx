import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LobbyRoute } from "./LobbyRoute";

/**
 * Renders LobbyRoute for a given `02a`–`02f` state. The lobby view-model comes
 * from the fixtures seam keyed by the `?state=` query param, so a route is all
 * we need to reach a specific screen.
 */
function renderLobby(state: string) {
  render(
    <MemoryRouter initialEntries={[`/room/K7QX?state=${state}`]}>
      <LobbyRoute />
    </MemoryRouter>,
  );
}

describe("LobbyRoute — room-code panel (all states)", () => {
  it("shows the room code, Copy link and Share invite", () => {
    renderLobby("02a");
    expect(screen.getByText("K7QX")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy link" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Share invite" }),
    ).toBeInTheDocument();
  });
});

describe("LobbyRoute — host view (02a / 02b / 02d)", () => {
  it("02a: host sees an editable mode control and the disabled Start with the invite reason", () => {
    renderLobby("02a");

    // Editable segmented control — the options are real radios.
    const group = screen.getByRole("radiogroup", { name: "Game mode" });
    expect(within(group).getByRole("radio", { name: /Normal/ })).toBeEnabled();

    const start = screen.getByRole("button", { name: "Start game" });
    expect(start).toBeDisabled();
    expect(
      screen.getByText("Invite at least 1 more player to start"),
    ).toBeInTheDocument();
  });

  it("02b: Normal with 5 players disables Play 2v2 with the note and enables Start", () => {
    renderLobby("02b");

    const team = screen.getByRole("radio", { name: /Play 2v2/ });
    expect(team).toBeDisabled();
    expect(
      screen.getByText(
        "2v2 needs exactly 4 players. It unlocks if the room gets back to 4.",
      ),
    ).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Start game" })).toBeEnabled();
  });

  it("02c: Team mode with 3 players disables Start with the '3 of 4' message", () => {
    renderLobby("02c");

    expect(screen.getByRole("button", { name: "Start game" })).toBeDisabled();
    expect(
      screen.getByText("2v2 needs exactly 4 players. 3 of 4 have joined."),
    ).toBeInTheDocument();
    // One team seat is still unfilled.
    expect(screen.getByText("Waiting for a player")).toBeInTheDocument();
  });

  it("02d: Team mode with exactly 4 players enables Start and shows host drag handles", () => {
    renderLobby("02d");

    expect(screen.getByRole("button", { name: "Start game" })).toBeEnabled();
    // Every row has a keyboard/tap swap control for the host (Req 21.1).
    expect(
      screen.getAllByRole("button", { name: /Move .* to the other team/ })
        .length,
    ).toBe(4);
  });
});

describe("LobbyRoute — guest view (02f)", () => {
  it("shows a read-only mode, no Start, no drag handles, and a waiting + Leave footer (Req 4.12/21.7)", () => {
    renderLobby("02f");

    // Read-only mode: no editable radiogroup, and the 'chosen by the host' label.
    expect(
      screen.queryByRole("radiogroup", { name: "Game mode" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Game mode · chosen by the host")).toBeInTheDocument();

    // No Start button for a guest; the host's name is surfaced instead.
    expect(
      screen.queryByRole("button", { name: "Start game" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Waiting for Alex to start the game"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Leave room" }),
    ).toBeInTheDocument();

    // Guests never get drag handles (Req 21.7).
    expect(
      screen.queryByRole("button", { name: /Move .* to the other team/ }),
    ).not.toBeInTheDocument();
  });
});

describe("LobbyRoute — dragging (02e)", () => {
  it("shows the 'Drop on a player to swap' hint and a Swap target", () => {
    renderLobby("02e");
    expect(screen.getByText("Drop on a player to swap")).toBeInTheDocument();
    expect(screen.getByText("Swap")).toBeInTheDocument();
  });
});
