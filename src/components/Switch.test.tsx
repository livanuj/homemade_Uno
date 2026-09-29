import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Switch } from "./Switch";

function ControlledSwitch({ initial = false }: { initial?: boolean }) {
  const [checked, setChecked] = useState(initial);
  return (
    <Switch aria-label="Sound" checked={checked} onCheckedChange={setChecked} />
  );
}

describe("Switch", () => {
  it("exposes role=switch with aria-checked reflecting state", () => {
    render(<ControlledSwitch initial={false} />);
    const sw = screen.getByRole("switch", { name: "Sound" });
    expect(sw).toHaveAttribute("aria-checked", "false");
  });

  it("toggles aria-checked when activated", async () => {
    render(<ControlledSwitch initial={false} />);
    const sw = screen.getByRole("switch", { name: "Sound" });
    await userEvent.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "true");
    await userEvent.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "false");
  });

  it("does not toggle when disabled", async () => {
    render(
      <Switch aria-label="Vibration" checked={false} disabled onCheckedChange={() => {}} />,
    );
    const sw = screen.getByRole("switch", { name: "Vibration" });
    expect(sw).toBeDisabled();
    await userEvent.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "false");
  });
});
