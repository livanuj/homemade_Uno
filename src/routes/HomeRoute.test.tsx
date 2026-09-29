import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { RoomStoreProvider, type RoomStore } from "@/game/view/store";
import { makeFreshRoom, makeJoinedRoom } from "@/game/view/fixtures";
import { HomeRoute } from "./HomeRoute";

/**
 * Renders HomeRoute inside a router + an injected RoomStore so we can assert on
 * the create/join actions and drive the error/blocked states deterministically.
 */
function renderHome(
  store: Partial<RoomStore>,
  { route = "/" }: { route?: string } = {},
) {
  const full: RoomStore = {
    createRoom: vi.fn(async (hostName: string) => ({
      ok: true as const,
      room: makeFreshRoom("K7QX", hostName),
    })),
    join: vi.fn(async (code: string, name: string) => ({
      ok: true as const,
      room: makeJoinedRoom(code, name),
    })),
    ...store,
  };
  render(
    <MemoryRouter initialEntries={[route]}>
      <RoomStoreProvider store={full}>
        <HomeRoute />
      </RoomStoreProvider>
    </MemoryRouter>,
  );
  return full;
}

describe("HomeRoute — 01-home", () => {
  it("requires a non-empty (non-whitespace) name to create a room", async () => {
    const createRoom = vi.fn(async (hostName: string) => ({
      ok: true as const,
      room: makeFreshRoom("K7QX", hostName),
    }));
    const user = userEvent.setup();
    renderHome({ createRoom });

    // Whitespace-only name is rejected — createRoom is not called.
    await user.type(screen.getByLabelText("Your name"), "   ");
    await user.click(screen.getByRole("button", { name: "Create a room" }));

    expect(createRoom).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/name/i);
  });

  it("creates a room when a name is provided", async () => {
    const createRoom = vi.fn(async (hostName: string) => ({
      ok: true as const,
      room: makeFreshRoom("K7QX", hostName),
    }));
    const user = userEvent.setup();
    renderHome({ createRoom });

    await user.type(screen.getByLabelText("Your name"), "Alex");
    await user.click(screen.getByRole("button", { name: "Create a room" }));

    await waitFor(() => expect(createRoom).toHaveBeenCalledWith("Alex"));
  });

  it("uppercases and strips invalid characters as the code is typed", async () => {
    const user = userEvent.setup();
    renderHome({});

    const code = screen.getByLabelText("Room code") as HTMLInputElement;
    await user.type(code, "a1-b!z");
    // Only A–Z/0–9, uppercased, capped at 4 chars.
    expect(code.value).toBe("A1BZ");
  });

  it("rejects a join with fewer than 4 characters and keeps the input", async () => {
    const join = vi.fn();
    const user = userEvent.setup();
    renderHome({ join });

    await user.type(screen.getByLabelText("Your name"), "Alex");
    await user.type(screen.getByLabelText("Room code"), "AB");
    await user.click(screen.getByRole("button", { name: "Join" }));

    expect(join).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/4-character/i);
    expect((screen.getByLabelText("Room code") as HTMLInputElement).value).toBe(
      "AB",
    );
  });

  it("requires a name to join", async () => {
    const join = vi.fn();
    const user = userEvent.setup();
    renderHome({ join });

    await user.type(screen.getByLabelText("Room code"), "K7QX");
    await user.click(screen.getByRole("button", { name: "Join" }));

    expect(join).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/name/i);
  });

  it("pre-fills the code from an invite-link query param, uppercased", () => {
    renderHome({}, { route: "/?code=k7qx" });
    expect((screen.getByLabelText("Room code") as HTMLInputElement).value).toBe(
      "K7QX",
    );
  });
});

describe("HomeRoute — 01b error states", () => {
  it("shows the room-not-found message naming the code", async () => {
    const join = vi.fn(async () => ({
      ok: false as const,
      reason: "room-not-found" as const,
    }));
    const user = userEvent.setup();
    renderHome({ join });

    await user.type(screen.getByLabelText("Your name"), "Alex");
    await user.type(screen.getByLabelText("Room code"), "ABCD");
    await user.click(screen.getByRole("button", { name: "Join" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "No room uses the code ABCD",
      ),
    );
  });

  it("shows the room-full message", async () => {
    const join = vi.fn(async () => ({
      ok: false as const,
      reason: "room-full" as const,
    }));
    const user = userEvent.setup();
    renderHome({ join });

    await user.type(screen.getByLabelText("Your name"), "Alex");
    await user.type(screen.getByLabelText("Room code"), "FULL");
    await user.click(screen.getByRole("button", { name: "Join" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/full/i),
    );
  });
});

describe("HomeRoute — 01c game already started", () => {
  it("renders the blocked screen with its message and a Back to home action", () => {
    renderHome({}, { route: "/?state=game-already-started&code=K7QX" });

    expect(
      screen.getByRole("heading", { name: "This game has already started" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Back to home" }),
    ).toBeInTheDocument();
    // The room code is shown on the blocked screen.
    expect(screen.getByText(/K7QX/)).toBeInTheDocument();
  });
});
