import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlayingCard } from "./PlayingCard";
import { CardBack } from "./CardBack";
import { Avatar } from "./Avatar";
import { SUIT_SHAPE } from "@/design/suits";

describe("PlayingCard", () => {
  it("renders a real <button> with the correct aria-label per suit + value", () => {
    render(<PlayingCard suit="red" value={7} />);
    const btn = screen.getByRole("button", { name: "Red 7" });
    expect(btn).toBeInTheDocument();
    expect(btn.tagName).toBe("BUTTON");
    expect(btn).toHaveAttribute("type", "button");
  });

  it("labels action cards by symbol name, not glyph (Req 18.2/18.3)", () => {
    const { rerender } = render(<PlayingCard suit="blue" value="skip" />);
    expect(screen.getByRole("button", { name: "Blue skip" })).toBeInTheDocument();

    rerender(<PlayingCard suit="green" value="reverse" />);
    expect(
      screen.getByRole("button", { name: "Green reverse" }),
    ).toBeInTheDocument();

    rerender(<PlayingCard suit="yellow" value="+2" />);
    expect(
      screen.getByRole("button", { name: "Yellow draw two" }),
    ).toBeInTheDocument();
  });

  it("labels wild and wild+4", () => {
    const { rerender } = render(<PlayingCard value="wild" />);
    expect(screen.getByRole("button", { name: "Wild" })).toBeInTheDocument();

    rerender(<PlayingCard value="wild4" />);
    expect(
      screen.getByRole("button", { name: "Wild draw four" }),
    ).toBeInTheDocument();
  });

  it("shows a distinct suit shape, not color alone (Req 18.3)", () => {
    render(<PlayingCard suit="green" value={3} />);
    // The suit glyph (■) must be present in the DOM at every size.
    expect(screen.getByText(SUIT_SHAPE.green)).toBeInTheDocument();
  });

  it("shows the suit shape on the small partner variant too", () => {
    render(<PlayingCard suit="red" value={5} variant="partner" />);
    expect(screen.getByText(SUIT_SHAPE.red)).toBeInTheDocument();
  });

  it("renders +4 text on the wild+4 face", () => {
    render(<PlayingCard value="wild4" />);
    expect(screen.getByText("+4")).toBeInTheDocument();
  });

  it("marks the selected state via aria-pressed", () => {
    render(<PlayingCard suit="blue" value={1} selected />);
    expect(screen.getByRole("button", { name: "Blue 1" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

describe("CardBack", () => {
  it("renders a card back with a generic label by default", () => {
    render(<CardBack />);
    expect(screen.getByLabelText("Face-down card")).toBeInTheDocument();
  });

  it("renders the draw pile as a Draw a card button", () => {
    render(<CardBack variant="draw-pile" />);
    expect(
      screen.getByRole("button", { name: "Draw a card" }),
    ).toBeInTheDocument();
  });
});

describe("Avatar", () => {
  it("renders the player's initial", () => {
    render(<Avatar name="Nora" />);
    expect(screen.getByText("N")).toBeInTheDocument();
  });

  it("renders the real card-count badge (Req 13.5)", () => {
    render(<Avatar name="Alex" cardCount={4} />);
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("applies the turn-pulse animation when it is the player's turn", () => {
    const { container } = render(<Avatar name="Sam" activeTurn />);
    expect(container.querySelector(".animate-turn-pulse")).not.toBeNull();
  });

  it("does not pulse when it is not the player's turn", () => {
    const { container } = render(<Avatar name="Sam" />);
    expect(container.querySelector(".animate-turn-pulse")).toBeNull();
  });
});
