import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsRoute } from "./SettingsRoute";
import { HowToPlayRoute } from "./HowToPlayRoute";
import { DEFAULT_SETTINGS, getSettings, writeSettings } from "@/lib/settings";

/**
 * Tests for the Settings screen (01d) and a light render check of How to play
 * (01e). The settings store persists to localStorage and feature-detects the
 * Vibration API; both are reset/mocked per test so cases don't leak state.
 */

function renderSettings() {
  render(
    <MemoryRouter initialEntries={["/settings"]}>
      <SettingsRoute />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  // Reset the in-memory store snapshot to defaults before each test.
  writeSettings({ ...DEFAULT_SETTINGS });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SettingsRoute — 01d name", () => {
  it("persists the edited name to localStorage (device)", async () => {
    const user = userEvent.setup();
    renderSettings();

    const input = screen.getByLabelText("Your name") as HTMLInputElement;
    await user.type(input, "Maya");

    await waitFor(() => expect(getSettings().name).toBe("Maya"));
    // Backed by localStorage, not just memory.
    expect(localStorage.getItem("uno.settings")).toContain("Maya");
  });

  it("caps the stored name at 16 characters (Req 1.12)", async () => {
    const user = userEvent.setup();
    renderSettings();

    const input = screen.getByLabelText("Your name") as HTMLInputElement;
    await user.type(input, "abcdefghijklmnopqrstuvwxyz");

    // The native input enforces maxLength; the store clamps regardless.
    expect(input.value.length).toBe(16);
    expect(getSettings().name.length).toBe(16);
  });

  it("trims surrounding whitespace from the stored name on blur", async () => {
    const user = userEvent.setup();
    renderSettings();

    const input = screen.getByLabelText("Your name") as HTMLInputElement;
    await user.type(input, "  Alex  ");
    await user.tab(); // blur

    await waitFor(() => expect(getSettings().name).toBe("Alex"));
  });
});

describe("SettingsRoute — 01d switches", () => {
  it("toggles a switch and persists the new value", async () => {
    const user = userEvent.setup();
    renderSettings();

    const sound = screen.getByRole("switch", { name: "Sound effects" });
    expect(sound).toHaveAttribute("aria-checked", "true");

    await user.click(sound);

    await waitFor(() => expect(getSettings().sound).toBe(false));
    expect(sound).toHaveAttribute("aria-checked", "false");
    expect(localStorage.getItem("uno.settings")).toContain('"sound":false');
  });

  it("toggles the Highlight switch independently", async () => {
    const user = userEvent.setup();
    renderSettings();

    const highlight = screen.getByRole("switch", {
      name: "Highlight playable cards",
    });
    await user.click(highlight);

    await waitFor(() => expect(getSettings().highlight).toBe(false));
    // Sound is untouched.
    expect(getSettings().sound).toBe(true);
  });
});

describe("SettingsRoute — 01d Vibration visibility (Req 16.7)", () => {
  it("shows the Vibration row when the device supports vibration", () => {
    vi.stubGlobal("navigator", { vibrate: () => true });
    renderSettings();
    expect(
      screen.getByRole("switch", { name: "Vibration" }),
    ).toBeInTheDocument();
  });

  it("hides the Vibration row when vibration is unsupported (iPhone)", () => {
    // A navigator with no `vibrate` — mirrors iOS Safari.
    vi.stubGlobal("navigator", { userAgent: "iPhone" });
    renderSettings();
    expect(
      screen.queryByRole("switch", { name: "Vibration" }),
    ).not.toBeInTheDocument();
    // The other two rows are still there.
    expect(
      screen.getByRole("switch", { name: "Sound effects" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "Highlight playable cards" }),
    ).toBeInTheDocument();
  });
});

describe("HowToPlayRoute — 01e", () => {
  it("renders all rules sections and a back control", () => {
    render(
      <MemoryRouter initialEntries={["/how-to-play"]}>
        <HowToPlayRoute />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "How to play" }),
    ).toBeInTheDocument();
    for (const section of [
      "On your turn",
      "Action cards",
      "Stacking",
      "Last card!",
      "2v2 teams",
      "If someone drops out",
    ]) {
      expect(
        screen.getByRole("heading", { name: section }),
      ).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
  });
});
