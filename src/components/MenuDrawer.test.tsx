import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MenuDrawer, type MenuDrawerProps } from "./MenuDrawer";

function renderDrawer(overrides: Partial<MenuDrawerProps> = {}) {
  const props: MenuDrawerProps = {
    roomCode: "K7QX",
    cardCounts: [
      { playerId: "1", name: "You", count: 7 },
      { playerId: "2", name: "Leo", count: 6 },
    ],
    soundOn: true,
    vibrationOn: false,
    highlightOn: true,
    onSoundChange: () => {},
    onVibrationChange: () => {},
    onHighlightChange: () => {},
    onCopyLink: () => {},
    onPause: () => {},
    onHowToPlay: () => {},
    onLeave: () => {},
    onClose: () => {},
    ...overrides,
  };
  return props;
}

describe("MenuDrawer (§5.10)", () => {
  it("renders the menu with a Pause game, How to play, and Leave game action", () => {
    render(<MenuDrawer {...renderDrawer()} />);
    expect(screen.getByRole("dialog", { name: "Menu" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause game" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "How to play" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave game" })).toBeInTheDocument();
  });

  it("fires onClose when the backdrop is activated", async () => {
    const onClose = vi.fn();
    render(<MenuDrawer {...renderDrawer({ onClose })} />);
    await userEvent.click(screen.getByRole("button", { name: "Close menu" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("hides the Vibration switch when vibration is unsupported (Req 16.7)", () => {
    render(<MenuDrawer {...renderDrawer({ vibrationSupported: false })} />);
    expect(screen.queryByRole("switch", { name: "Vibration" })).toBeNull();
    expect(screen.getByRole("switch", { name: "Sound effects" })).toBeInTheDocument();
  });
});
