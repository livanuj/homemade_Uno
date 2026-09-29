import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "./Input";

describe("Input", () => {
  it("associates the visible label with the input", () => {
    render(<Input label="Your name" />);
    // getByLabelText resolves via the <label htmlFor> → input id wiring.
    expect(screen.getByLabelText("Your name")).toBeInTheDocument();
  });

  it("wires the error state: danger border, aria-invalid, and an alert message", () => {
    const message = "No room uses the code ABCD. Check the code and try again.";
    render(<Input label="Room code" error={message} />);

    const input = screen.getByLabelText("Room code");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.className).toContain("border-danger");

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(message);
    // The input points at the error message for assistive tech.
    expect(input).toHaveAttribute("aria-describedby", alert.id);
  });

  it("has no alert and is not invalid when error is absent", () => {
    render(<Input label="Your name" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Your name")).not.toHaveAttribute(
      "aria-invalid",
    );
  });
});
