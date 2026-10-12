import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StartControl } from "./StartControl";

describe("StartControl", () => {
  it("renders an enabled button with its caption", () => {
    render(<StartControl caption="Everyone is ready" onStart={() => {}} />);
    const button = screen.getByRole("button", { name: /start game/i });
    expect(button).toBeEnabled();
    expect(screen.getByText("Everyone is ready")).toBeInTheDocument();
  });

  it("disables the button and shows the caption when not ready", () => {
    render(
      <StartControl
        disabled
        caption="Invite at least 1 more player to start"
        onStart={() => {}}
      />,
    );
    const button = screen.getByRole("button", { name: /start game/i });
    expect(button).toBeDisabled();
    expect(
      screen.getByText("Invite at least 1 more player to start"),
    ).toBeInTheDocument();
  });

  it("wires the caption to the button via aria-describedby", () => {
    render(<StartControl caption="Everyone is ready" onStart={() => {}} />);
    const button = screen.getByRole("button", { name: /start game/i });
    const describedBy = button.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toHaveTextContent(
      "Everyone is ready",
    );
  });

  it("does not fire onStart when disabled", async () => {
    const onStart = vi.fn();
    render(<StartControl disabled caption="Not yet" onStart={onStart} />);
    await userEvent.click(screen.getByRole("button", { name: /start game/i }));
    expect(onStart).not.toHaveBeenCalled();
  });
});
