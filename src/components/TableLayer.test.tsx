import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TableLayer, TableStageContext } from "./TableLayer";

describe("TableLayer", () => {
  it("renders its children in place when there is no landscape stage", () => {
    const { container } = render(
      <div data-testid="host">
        <TableLayer>
          <span>pill</span>
        </TableLayer>
      </div>,
    );
    expect(screen.getByTestId("host")).toContainElement(
      screen.getByText("pill"),
    );
    expect(container.textContent).toBe("pill");
  });

  it("portals its children into the landscape stage when one is provided", () => {
    const stage = document.createElement("div");
    document.body.appendChild(stage);
    render(
      <TableStageContext.Provider value={stage}>
        <div data-testid="host">
          <TableLayer>
            <span>pill</span>
          </TableLayer>
        </div>
      </TableStageContext.Provider>,
    );
    expect(stage).toContainElement(screen.getByText("pill"));
    expect(screen.getByTestId("host")).toBeEmptyDOMElement();
    stage.remove();
  });
});
