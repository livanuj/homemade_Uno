import { act, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  LiveAnnouncer,
  useGameAnnouncements,
  type GameAnnouncementInput,
} from "./LiveAnnouncer";

describe("LiveAnnouncer (Req 18.4, 18.7)", () => {
  it("renders a polite, atomic live region that is visually hidden", () => {
    render(<LiveAnnouncer message="Maya's turn · red" />);
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-atomic", "true");
    expect(region).toHaveClass("sr-only");
    expect(region).toHaveTextContent("Maya's turn · red");
  });

  it("renders empty when there is no message", () => {
    render(<LiveAnnouncer message="" />);
    expect(screen.getByRole("status")).toHaveTextContent("");
  });
});

describe("useGameAnnouncements (Req 18.4, 18.7)", () => {
  function turn(text: string): GameAnnouncementInput {
    return { turnText: text };
  }

  it("announces the turn text when it changes", () => {
    const { result, rerender } = renderHook(
      (props: GameAnnouncementInput) => useGameAnnouncements(props),
      { initialProps: turn("Maya's turn · red") },
    );
    expect(result.current).toBe("Maya's turn · red");

    rerender(turn("Leo's turn · blue"));
    expect(result.current).toBe("Leo's turn · blue");
  });

  it("announces a card play and, when combined with a turn change, keeps the latest (Req 18.7)", () => {
    const { result, rerender } = renderHook(
      (props: GameAnnouncementInput) => useGameAnnouncements(props),
      { initialProps: turn("Maya's turn · red") },
    );

    // A card is played and the turn advances in the same update: the newest
    // announcement (the card play) must not be dropped.
    rerender({ turnText: "Leo's turn · blue", lastPlay: "Maya played Red 7" });
    expect(result.current).toContain("Maya played Red 7");
    expect(result.current).toContain("Leo's turn · blue");
  });

  it("does not repeat an identical announcement string across renders", () => {
    const { result, rerender } = renderHook(
      (props: GameAnnouncementInput) => useGameAnnouncements(props),
      { initialProps: turn("Maya's turn · red") },
    );
    const first = result.current;
    // Same inputs → same string, and the region text stays stable (no churn).
    rerender(turn("Maya's turn · red"));
    expect(result.current).toBe(first);
  });

  it("re-announces a repeated card play by nudging the text so it is not lost (Req 18.7)", () => {
    // Two identical card plays in a row (e.g. two Red 7s) must each be
    // announced; assistive tech only re-reads when the region text actually
    // changes, so the hook must ensure the string differs.
    const { result, rerender } = renderHook(
      (props: GameAnnouncementInput) => useGameAnnouncements(props),
      { initialProps: { turnText: "Maya's turn", lastPlay: "Leo played Red 7", playSeq: 1 } },
    );
    const first = result.current;
    expect(first).toContain("Leo played Red 7");

    rerender({ turnText: "Maya's turn", lastPlay: "Leo played Red 7", playSeq: 2 });
    expect(result.current).toContain("Leo played Red 7");
    expect(result.current).not.toBe(first);
  });
});

// Silence unused import in some TS configs; `act` is used implicitly by RTL.
void act;
