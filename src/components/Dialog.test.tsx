import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

describe("Dialog (§5.18)", () => {
  it("renders its title, description, and actions", () => {
    render(
      <Dialog
        title="Leave this game?"
        description="You can rejoin from the same link while the game is on."
        actions={
          <>
            <Button variant="soft">Stay in the game</Button>
            <Button variant="danger">Leave game</Button>
          </>
        }
      />,
    );

    const dialog = screen.getByRole("alertdialog", { name: "Leave this game?" });
    expect(dialog).toBeInTheDocument();
    expect(
      screen.getByText(/rejoin from the same link/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stay in the game" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave game" })).toBeInTheDocument();
  });

  it("fires onClose when the backdrop is activated", async () => {
    const onClose = vi.fn();
    render(<Dialog title="Leave this game?" actions={null} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
