import { LandscapeContext, type LandscapeKind } from "@/lib/useLandscape";
import { render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { GameOverRoute } from "./GameOverRoute";
import { GameRoute } from "./GameRoute";
import { HomeRoute } from "./HomeRoute";
import { LobbyRoute } from "./LobbyRoute";
import { SettingsRoute } from "./SettingsRoute";

/**
 * Landscape layouts (wide screens): each screen rearranges the same components,
 * so these check the key content still renders with `LandscapeContext` on.
 */
function renderLandscape(
  url: string,
  element: ReactElement,
  kind: LandscapeKind = "wide",
) {
  render(
    <LandscapeContext.Provider value={kind}>
      <MemoryRouter initialEntries={[url]}>{element}</MemoryRouter>
    </LandscapeContext.Provider>,
  );
}

describe("landscape layouts", () => {
  it("home keeps the hero title, both forms, settings and How to play", () => {
    renderLandscape("/", <HomeRoute />);
    expect(
      screen.getByRole("heading", { name: "Homemade Uno" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Your name")).toBeInTheDocument();
    expect(screen.getByLabelText("Room code")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create a room" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "How to play" })).toBeInTheDocument();
  });

  it("settings keeps the name field and toggles", () => {
    renderLandscape("/settings", <SettingsRoute />);
    expect(screen.getByLabelText("Your name")).toBeInTheDocument();
    expect(screen.getAllByRole("switch").length).toBeGreaterThanOrEqual(2);
  });

  it("the 2v2 lobby keeps the room code, both teams, handles and Start", () => {
    renderLandscape("/room/K7QX?state=02d", <LobbyRoute />);
    expect(screen.getByText("K7QX")).toBeInTheDocument();
    expect(screen.getByText("TEAM A")).toBeInTheDocument();
    expect(screen.getByText("TEAM B")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /Move .* to the other team/ }),
    ).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Start game" })).toBeEnabled();
  });

  it("the game table renders on the scaled 1280×800 stage", () => {
    renderLandscape("/room/K7QX/game?state=03", <GameRoute />);
    expect(screen.getByRole("button", { name: "Menu" })).toBeInTheDocument();
    const stage = document.querySelector(".w-\\[1280px\\].h-\\[800px\\]");
    expect(stage).not.toBeNull();
    expect(stage).toContainElement(
      screen.getByRole("button", { name: "Yellow 5" }),
    );
  });

  it("game over keeps the winners, results and Play again", () => {
    renderLandscape("/room/K7QX/game-over?state=team-win", <GameOverRoute />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Cards left")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play again" })).toBeInTheDocument();
  });

  it("a phone on its side renders the table on the compact 900×440 stage", () => {
    renderLandscape("/room/K7QX/game?state=03", <GameRoute />, "compact");
    const stage = document.querySelector(".w-\\[900px\\].h-\\[440px\\]");
    expect(stage).not.toBeNull();
    expect(stage).toContainElement(
      screen.getByRole("button", { name: "Yellow 5" }),
    );
  });

  it("a phone on its side shows the drawn-card choice on the table, no popup", () => {
    renderLandscape(
      "/room/K7QX/game?state=03&overlay=drew",
      <GameRoute />,
      "compact",
    );
    const group = screen.getByRole("group", { name: "You drew a card" });
    expect(group).toHaveTextContent("Red 3 fits the pile");
    expect(
      within(group).getByRole("button", { name: "Play it" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
