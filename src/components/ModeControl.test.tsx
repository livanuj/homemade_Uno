import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ModeControl } from "./ModeControl";

describe("ModeControl (host, editable)", () => {
  it("renders both mode options as radios", () => {
    render(<ModeControl mode="normal" canEdit onModeChange={() => {}} />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(
      screen.getByRole("radio", { name: /normal/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /2v2/i })).toBeInTheDocument();
  });

  it("marks the current mode as checked", () => {
    render(<ModeControl mode="team" canEdit onModeChange={() => {}} />);
    expect(screen.getByRole("radio", { name: /2v2/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("calls onModeChange when the other option is chosen", async () => {
    const onModeChange = vi.fn();
    render(<ModeControl mode="normal" canEdit onModeChange={onModeChange} />);
    await userEvent.click(screen.getByRole("radio", { name: /2v2/i }));
    expect(onModeChange).toHaveBeenCalledWith("team");
  });

  it("disables Play 2v2 and shows the info note when team is not allowed", () => {
    render(
      <ModeControl
        mode="normal"
        canEdit
        teamDisabled
        onModeChange={() => {}}
      />,
    );
    expect(screen.getByRole("radio", { name: /2v2/i })).toBeDisabled();
    expect(screen.getByText(/unlocks if the room gets back to 4/i)).toBeInTheDocument();
  });
});

describe("ModeControl (guest, read-only)", () => {
  it("renders no radios and reads chosen by the host", () => {
    render(<ModeControl mode="team" canEdit={false} onModeChange={() => {}} />);
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.getByText(/chosen by the host/i)).toBeInTheDocument();
    expect(screen.getByText(/2v2 teams/i)).toBeInTheDocument();
  });
});
