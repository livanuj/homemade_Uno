import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TurnTag } from "./TurnTag";

describe("TurnTag", () => {
  it("renders its label as a turn-colored tag", () => {
    render(<TurnTag>Playing</TurnTag>);
    const tag = screen.getByText("Playing");
    expect(tag).toHaveClass("bg-turn");
    expect(tag).toHaveClass("text-suit-yellow-on");
  });
});
