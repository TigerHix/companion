// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockVerifyAuthToken = vi.fn().mockResolvedValue(true);
const mockGetPublicInfo = vi.fn().mockResolvedValue({
  name: "Moku",
  backendVersion: "0.69.0",
  authMode: "bearer_token",
  deploymentMode: "tailscale-hosted-frontend",
  frontendUrl: "https://moku.sh",
  canonicalBackendUrl: "https://backend.example.ts.net",
  allowedWebOrigins: ["https://moku.sh"],
  capabilities: {
    clientQrBootstrap: true,
    inAppEditor: true,
    hostedFrontendOnly: true,
  },
});

vi.mock("../api.js", () => ({
  api: {
    getPublicInfo: (...args: unknown[]) => mockGetPublicInfo(...args),
  },
  verifyAuthToken: (...args: unknown[]) => mockVerifyAuthToken(...args),
}));

interface MockStoreState {
  setConnection: ReturnType<typeof vi.fn>;
}

let mockState: MockStoreState;

function resetStore(overrides: Partial<MockStoreState> = {}) {
  mockState = {
    setConnection: vi.fn(),
    ...overrides,
  };
}

const mockNavigateHome = vi.fn();
const mockNavigateToConnect = vi.fn();

vi.mock("../store.js", () => ({
  useStore: Object.assign(
    (selector: (s: MockStoreState) => unknown) => selector(mockState),
    { getState: () => mockState },
  ),
}));

vi.mock("../utils/routing.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/routing.js")>();
  return {
    ...actual,
    navigateHome: (...args: unknown[]) => mockNavigateHome(...args),
    navigateToConnect: (...args: unknown[]) => mockNavigateToConnect(...args),
  };
});

import { LoginPage } from "./LoginPage.js";

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  resetStore();
});

describe("LoginPage", () => {
  it("renders the connect form with backend and token inputs", () => {
    render(<LoginPage />);

    expect(screen.getByText("Moku")).toBeInTheDocument();
    expect(screen.getByLabelText("Backend URL")).toBeInTheDocument();
    expect(screen.getByLabelText("Auth Token")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect" })).toBeDisabled();
  });

  it("prefills the backend URL from remembered local state", () => {
    localStorage.setItem("moku_last_server_url", "https://remembered.example.ts.net");

    render(<LoginPage />);

    expect(screen.getByDisplayValue("https://remembered.example.ts.net")).toBeInTheDocument();
  });

  it("verifies the backend and stores the connection on successful submit", async () => {
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Backend URL"), {
      target: { value: "https://backend.example.ts.net/" },
    });
    fireEvent.change(screen.getByLabelText("Auth Token"), {
      target: { value: "valid-token" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() => {
      expect(mockGetPublicInfo).toHaveBeenCalledWith("https://backend.example.ts.net");
      expect(mockVerifyAuthToken).toHaveBeenCalledWith(
        "https://backend.example.ts.net",
        "valid-token",
      );
      expect(mockState.setConnection).toHaveBeenCalledWith({
        serverUrl: "https://backend.example.ts.net",
        authToken: "valid-token",
      });
      expect(mockNavigateHome).toHaveBeenCalledWith(true);
    });
  });

  it("shows an error when token verification fails", async () => {
    mockVerifyAuthToken.mockResolvedValueOnce(false);
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Backend URL"), {
      target: { value: "https://backend.example.ts.net" },
    });
    fireEvent.change(screen.getByLabelText("Auth Token"), {
      target: { value: "bad-token" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Invalid token");
    });
    expect(mockState.setConnection).not.toHaveBeenCalled();
  });

  it("bootstraps from connect-route fragment params and strips the token from the URL", async () => {
    render(
      <LoginPage
        route={{
          page: "connect",
          server: "https://backend.example.ts.net",
          token: "bootstrap-token",
        }}
      />,
    );

    await waitFor(() => {
      expect(mockNavigateToConnect).toHaveBeenCalledWith(
        { server: "https://backend.example.ts.net" },
        true,
      );
      expect(mockVerifyAuthToken).toHaveBeenCalledWith(
        "https://backend.example.ts.net",
        "bootstrap-token",
      );
      expect(mockState.setConnection).toHaveBeenCalledWith({
        serverUrl: "https://backend.example.ts.net",
        authToken: "bootstrap-token",
      });
    });
  });

  it("shows a validation error for empty tokens", async () => {
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Backend URL"), {
      target: { value: "https://backend.example.ts.net" },
    });
    fireEvent.submit(screen.getByLabelText("Auth Token").closest("form")!);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Please enter a token");
    });
    expect(mockGetPublicInfo).not.toHaveBeenCalled();
  });

  it("toggles password visibility", () => {
    render(<LoginPage />);

    const input = screen.getByLabelText("Auth Token");
    expect(input).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByText("Show"));
    expect(input).toHaveAttribute("type", "text");

    fireEvent.click(screen.getByText("Hide"));
    expect(input).toHaveAttribute("type", "password");
  });
});

describe("LoginPage accessibility", () => {
  it("passes axe accessibility checks", async () => {
    const { axe } = await import("vitest-axe");
    const { container } = render(<LoginPage />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("passes axe accessibility checks with an error displayed", async () => {
    const { axe } = await import("vitest-axe");
    mockVerifyAuthToken.mockResolvedValueOnce(false);
    const { container } = render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Backend URL"), {
      target: { value: "https://backend.example.ts.net" },
    });
    fireEvent.change(screen.getByLabelText("Auth Token"), {
      target: { value: "bad-token" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
