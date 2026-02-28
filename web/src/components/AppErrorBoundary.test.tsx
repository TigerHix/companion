// @vitest-environment jsdom
import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { AppErrorBoundary } from "./AppErrorBoundary.js";

function Crasher(): ReactElement {
  throw new Error("render failed");
}

describe("AppErrorBoundary", () => {
  it("shows fallback UI when a child throws during render", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <AppErrorBoundary>
        <Crasher />
      </AppErrorBoundary>,
    );

    expect(screen.getByText("A runtime error occurred")).toBeTruthy();
    consoleErrorSpy.mockRestore();
  });
});
