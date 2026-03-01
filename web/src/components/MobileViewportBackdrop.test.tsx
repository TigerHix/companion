// @vitest-environment jsdom
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MobileViewportBackdrop } from "./MobileViewportBackdrop.js";

const INNER_HEIGHT = 844;
const mockVV = {
  height: 844,
  offsetTop: 0,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

beforeAll(() => {
  Object.defineProperty(window, "ontouchstart", { value: null, writable: true });
  Object.defineProperty(window, "innerWidth", { value: 390, writable: true });
  Object.defineProperty(window, "innerHeight", { value: INNER_HEIGHT, writable: true });
  Object.defineProperty(window, "visualViewport", { value: mockVV, writable: true });
});

beforeEach(() => {
  mockVV.height = INNER_HEIGHT;
  mockVV.offsetTop = 0;
});

describe("MobileViewportBackdrop", () => {
  it("renders nothing when the keyboard is closed", () => {
    // When the visual viewport matches the layout viewport, there is no covered area to paint.
    const { container } = render(<MobileViewportBackdrop />);
    expect(container.innerHTML).toBe("");
  });

  it("renders a backdrop sized to the covered keyboard inset", () => {
    // Documents the iOS workaround: fill the viewport area Safari leaves exposed above the keyboard.
    mockVV.height = 520;
    const { container } = render(<MobileViewportBackdrop />);
    const backdrop = container.firstElementChild as HTMLDivElement | null;

    expect(backdrop).not.toBeNull();
    expect(backdrop).toHaveAttribute("aria-hidden", "true");
    expect(backdrop?.style.height).toBe("324px");
    expect(backdrop?.className).toContain("bg-background");
  });

  it("accounts for visual viewport offset when Safari shifts the viewport", () => {
    // Safari can move the visual viewport upward while the keyboard is open, so offsetTop matters.
    mockVV.height = 560;
    mockVV.offsetTop = 24;
    const { container } = render(<MobileViewportBackdrop />);
    const backdrop = container.firstElementChild as HTMLDivElement | null;

    expect(backdrop?.style.height).toBe("260px");
  });

  it("does not render on desktop-width viewports", () => {
    // The workaround is mobile-only; wide layouts should not receive an extra viewport layer.
    mockVV.height = 520;
    Object.defineProperty(window, "innerWidth", { value: 1280, writable: true });
    const { container } = render(<MobileViewportBackdrop />);

    expect(container.innerHTML).toBe("");

    Object.defineProperty(window, "innerWidth", { value: 390, writable: true });
  });

  it("passes axe accessibility scan", async () => {
    const { axe } = await import("vitest-axe");
    mockVV.height = 520;
    const { container } = render(<MobileViewportBackdrop />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
