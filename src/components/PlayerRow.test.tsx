import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlayerRow } from "./PlayerRow";

describe("PlayerRow", () => {
  it("shows the player name", () => {
    render(<PlayerRow name="Alex" ring="team-a" />);
    expect(screen.getByText("Alex")).toBeInTheDocument();
  });

  it("renders the Host badge when host", () => {
    render(<PlayerRow name="Alex" ring="ink" host />);
    expect(screen.getByText("Host")).toBeInTheDocument();
  });

  it("omits the Host badge for a non-host", () => {
    render(<PlayerRow name="Maya" ring="ink-muted" />);
    expect(screen.queryByText("Host")).not.toBeInTheDocument();
  });

  it("shows a ready check when ready", () => {
    render(<PlayerRow name="Leo" ring="team-b" ready />);
    expect(screen.getByLabelText("Ready")).toBeInTheDocument();
  });

  it("renders a right-slot control (drag handle) when provided", () => {
    render(
      <PlayerRow
        name="Leo"
        ring="team-b"
        rightSlot={<button type="button">grip</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "grip" })).toBeInTheDocument();
  });
});
