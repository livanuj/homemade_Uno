import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PausedOverlay } from "./PausedOverlay";

describe("PausedOverlay (§11/§12)", () => {
  it("break variant shows the Resume game action", () => {
    render(
      <PausedOverlay
        variant="break"
        title="Game paused"
        body="Maya paused the game."
        elapsedLabel="Paused for 2:14"
        onPrimary={() => {}}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Game paused" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resume game" })).toBeInTheDocument();
  });

  it("waiting variant shows Continue without [name]", () => {
    render(
      <PausedOverlay
        variant="waiting"
        title="Waiting for Nora"
        body="Leo paused the game."
        elapsedLabel="Paused for 1:05"
        offlineName="Nora"
        primaryCaption="Nora's turns will be skipped until she returns"
        onPrimary={() => {}}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Continue without Nora" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/turns will be skipped/i),
    ).toBeInTheDocument();
  });

  it("auto variant shows the End game action", () => {
    render(
      <PausedOverlay
        variant="auto"
        title="Team B lost connection"
        body="The game paused by itself."
        elapsedLabel="Paused for 3:40"
        offlineName="Leo"
        offlineTeam="B"
        onPrimary={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "End game" })).toBeInTheDocument();
  });

  it("fires onPrimary when the primary action is activated", async () => {
    const onPrimary = vi.fn();
    render(
      <PausedOverlay
        variant="break"
        title="Game paused"
        body="Maya paused the game."
        elapsedLabel="Paused for 2:14"
        onPrimary={onPrimary}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Resume game" }));
    expect(onPrimary).toHaveBeenCalledOnce();
  });
});
