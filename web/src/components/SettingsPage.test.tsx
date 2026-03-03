// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

interface MockStoreState {
  darkMode: boolean;
  notificationSound: boolean;
  notificationDesktop: boolean;
  diffBase: string;
  connection: { version: 1; serverUrl: string; authToken: string } | null;
  setDarkMode: ReturnType<typeof vi.fn>;
  toggleNotificationSound: ReturnType<typeof vi.fn>;
  setNotificationDesktop: ReturnType<typeof vi.fn>;
  setDiffBase: ReturnType<typeof vi.fn>;
  setConnection: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
  currentSessionId: string | null;
}

let mockState: MockStoreState;

function createMockState(overrides: Partial<MockStoreState> = {}): MockStoreState {
  return {
    darkMode: false,
    notificationSound: true,
    notificationDesktop: false,
    diffBase: "last-commit",
    connection: {
      version: 1,
      serverUrl: "https://backend.example.ts.net",
      authToken: "abc123testtoken",
    },
    setDarkMode: vi.fn(),
    toggleNotificationSound: vi.fn(),
    setNotificationDesktop: vi.fn(),
    setDiffBase: vi.fn(),
    setConnection: vi.fn(),
    logout: vi.fn(),
    currentSessionId: null,
    ...overrides,
  };
}

const mockApi = {
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  getAuthToken: vi.fn(),
  regenerateAuthToken: vi.fn(),
  getPublicInfo: vi.fn(),
  verifyAuthToken: vi.fn(),
};

vi.mock("../api.js", () => ({
  api: {
    getSettings: (...args: unknown[]) => mockApi.getSettings(...args),
    updateSettings: (...args: unknown[]) => mockApi.updateSettings(...args),
    getAuthToken: (...args: unknown[]) => mockApi.getAuthToken(...args),
    regenerateAuthToken: (...args: unknown[]) => mockApi.regenerateAuthToken(...args),
    getPublicInfo: (...args: unknown[]) => mockApi.getPublicInfo(...args),
  },
  verifyAuthToken: (...args: unknown[]) => mockApi.verifyAuthToken(...args),
}));

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn(async () => "data:image/png;base64,CONNECT_QR"),
  },
}));

const mockNavigateToConnect = vi.fn();
vi.mock("../utils/routing.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/routing.js")>();
  return {
    ...actual,
    navigateToConnect: (...args: unknown[]) => mockNavigateToConnect(...args),
  };
});

vi.mock("../store.js", () => {
  const useStoreFn = (selector: (state: MockStoreState) => unknown) => selector(mockState);
  useStoreFn.getState = () => mockState;
  return { useStore: useStoreFn };
});

import { SettingsPage } from "./SettingsPage.js";

beforeEach(() => {
  vi.clearAllMocks();
  mockState = createMockState();
  window.location.hash = "#/settings";
  mockApi.getSettings.mockResolvedValue({
    anthropicApiKeyConfigured: true,
    anthropicModel: "claude-sonnet-4.6",
  });
  mockApi.updateSettings.mockResolvedValue({
    anthropicApiKeyConfigured: true,
    anthropicModel: "claude-sonnet-4.6",
  });
  mockApi.getAuthToken.mockResolvedValue({ token: "abc123testtoken" });
  mockApi.regenerateAuthToken.mockResolvedValue({ token: "newtoken456" });
  mockApi.getPublicInfo.mockResolvedValue({
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
  mockApi.verifyAuthToken.mockResolvedValue(true);
});

describe("SettingsPage", () => {
  // Verifies that settings load on mount and that both the "configured" status
  // text and the model value appear in the form.
  it("loads settings on mount and shows configured status", async () => {
    render(<SettingsPage />);

    expect(mockApi.getSettings).toHaveBeenCalledTimes(1);
    await screen.findByText("Anthropic key configured");
    expect(screen.getByDisplayValue("claude-sonnet-4.6")).toBeInTheDocument();
  });

  // When a key is already configured, the input shows masked dots (••••) to
  // visually indicate a key is present. The dots clear on focus so the user
  // can type a replacement key.
  it("shows masked dots in API key field when key is configured", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    const input = screen.getByLabelText("API Key") as HTMLInputElement;
    expect(input.value).toBe("••••••••••••••••");

    fireEvent.focus(input);
    expect(input.value).toBe("");
  });

  it("shows not configured status", async () => {
    mockApi.getSettings.mockResolvedValueOnce({
      anthropicApiKeyConfigured: false,
      anthropicModel: "claude-sonnet-4.6",
    });

    render(<SettingsPage />);

    await screen.findByText("Anthropic key not configured");
  });

  it("shows the auto-renaming helper copy under the API key input", async () => {
    render(<SettingsPage />);

    expect(await screen.findByText("Auto-renaming is disabled until this key is configured.")).toBeInTheDocument();
  });

  // Verifies that form values are trimmed before sending to the API,
  // and that the success message appears after save.
  it("saves settings with trimmed values", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    fireEvent.change(screen.getByLabelText("API Key"), {
      target: { value: "  or-key  " },
    });
    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "  openai/gpt-4o-mini  " },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockApi.updateSettings).toHaveBeenCalledWith({
        anthropicApiKey: "or-key",
        anthropicModel: "openai/gpt-4o-mini",
      });
    });

    expect(await screen.findByText("Settings saved.")).toBeInTheDocument();
  });

  it("sends empty model when blank (server applies default)", async () => {
    render(<SettingsPage />);
    await screen.findByLabelText("Model");
    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "   " },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockApi.updateSettings).toHaveBeenCalledWith({
        anthropicModel: "",
      });
    });
  });

  it("does not send key when left empty", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "openai/gpt-4o-mini" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockApi.updateSettings).toHaveBeenCalledWith({
        anthropicModel: "openai/gpt-4o-mini",
      });
    });
  });

  it("saves the default model when the form is submitted unchanged", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockApi.updateSettings).toHaveBeenCalledWith({
        anthropicModel: "claude-sonnet-4.6",
      });
    });
  });

  it("shows error if initial load fails", async () => {
    mockApi.getSettings.mockRejectedValueOnce(new Error("load failed"));

    render(<SettingsPage />);

    expect(await screen.findByText("load failed")).toBeInTheDocument();
  });

  it("shows error if save fails", async () => {
    mockApi.updateSettings.mockRejectedValueOnce(new Error("save failed"));

    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    fireEvent.change(screen.getByLabelText("API Key"), {
      target: { value: "or-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("save failed")).toBeInTheDocument();
  });

  it("shows saving state while request is in flight", async () => {
    let resolveSave: ((value: {
      anthropicApiKeyConfigured: boolean;
      anthropicModel: string;
    }) => void) | undefined;
    mockApi.updateSettings.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSave = resolve as typeof resolveSave;
      }),
    );

    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    fireEvent.change(screen.getByLabelText("API Key"), {
      target: { value: "or-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();

    resolveSave?.({
      anthropicApiKeyConfigured: true,
      anthropicModel: "claude-sonnet-4.6",
    });

    await screen.findByText("Settings saved.");
  });

  it("toggles sound notifications from settings", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    fireEvent.click(screen.getByRole("switch", { name: /Sound/i }));
    expect(mockState.toggleNotificationSound).toHaveBeenCalledTimes(1);
  });

  // Theme is now controlled via Tabs (Light/Dark). Clicking the "Dark" tab
  // should call setDarkMode(true).
  it("switches theme via tabs", async () => {
    mockState = createMockState({ darkMode: false });
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    fireEvent.click(screen.getByRole("tab", { name: "Dark" }));
    expect(mockState.setDarkMode).toHaveBeenCalledWith(true);
  });

  // moku: Environments and Agents link cards were removed from SettingsPage —
  // they are accessible from the sidebar instead.

  it("requests desktop permission before enabling desktop alerts", async () => {
    const requestPermission = vi.fn().mockResolvedValue("granted");
    vi.stubGlobal("Notification", {
      permission: "default",
      requestPermission,
    });

    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");
    fireEvent.click(screen.getByRole("switch", { name: /Desktop Alerts/i }));

    await waitFor(() => {
      expect(requestPermission).toHaveBeenCalledTimes(1);
      expect(mockState.setNotificationDesktop).toHaveBeenCalledWith(true);
    });
    vi.unstubAllGlobals();
  });

  // Verifies each settings section is rendered as a Card with its title.
  it("renders all settings cards", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    expect(screen.getByText("Authentication")).toBeInTheDocument();
    expect(screen.getByText("Appearance")).toBeInTheDocument();
    expect(screen.getByText("General")).toBeInTheDocument();
    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(screen.getByText("Anthropic")).toBeInTheDocument();
  });

  // ─── Authentication section tests ──────────────────────────────────

  it("loads the current backend URL and token details", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    expect(mockApi.getAuthToken).toHaveBeenCalledTimes(1);
    expect(mockApi.getPublicInfo).toHaveBeenCalledTimes(1);
    expect(screen.getByDisplayValue("https://backend.example.ts.net")).toBeInTheDocument();
    expect(screen.queryByText("abc123testtoken")).not.toBeInTheDocument();
  });

  it("reveals the token when Show is clicked", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    await waitFor(() => {
      expect(screen.getByText("\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle("Show token"));
    expect(screen.getByText("abc123testtoken")).toBeInTheDocument();
  });

  it("copies a hosted connect link and generates a client-side QR code", async () => {
    const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: clipboardWriteText,
      },
    });

    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(
        "https://moku.sh/#/connect?server=https%3A%2F%2Fbackend.example.ts.net&token=abc123testtoken",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Show QR Code" }));

    await waitFor(() => {
      expect(screen.getByAltText("QR code for hosted frontend connect link")).toBeInTheDocument();
    });
  });

  it("regenerates the token after user confirms", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }));

    await waitFor(() => {
      expect(mockApi.regenerateAuthToken).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText("newtoken456")).toBeInTheDocument();
    expect(mockState.setConnection).toHaveBeenCalledWith({
      serverUrl: "https://backend.example.ts.net",
      authToken: "newtoken456",
    });

    (window.confirm as ReturnType<typeof vi.spyOn>).mockRestore();
  });

  it("does not regenerate when user cancels confirmation", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(mockApi.regenerateAuthToken).not.toHaveBeenCalled();
    });

    confirmSpy.mockRestore();
  });

  it("reconnects to a new backend URL using the current token", async () => {
    mockApi.getPublicInfo.mockResolvedValueOnce({
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
    mockApi.getPublicInfo.mockResolvedValueOnce({
      name: "Moku",
      backendVersion: "0.69.0",
      authMode: "bearer_token",
      deploymentMode: "tailscale-hosted-frontend",
      frontendUrl: "https://moku.sh",
      canonicalBackendUrl: "https://new-backend.example.ts.net",
      allowedWebOrigins: ["https://moku.sh"],
      capabilities: {
        clientQrBootstrap: true,
        inAppEditor: true,
        hostedFrontendOnly: true,
      },
    });
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    fireEvent.change(screen.getByLabelText("Backend URL"), {
      target: { value: "https://new-backend.example.ts.net" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save backend" }));

    await waitFor(() => {
      expect(mockApi.getPublicInfo).toHaveBeenCalledWith("https://new-backend.example.ts.net");
      expect(mockApi.verifyAuthToken).toHaveBeenCalledWith(
        "https://new-backend.example.ts.net",
        "abc123testtoken",
      );
      expect(mockState.setConnection).toHaveBeenCalledWith({
        serverUrl: "https://new-backend.example.ts.net",
        authToken: "abc123testtoken",
      });
    });
  });

  it("disconnects and routes back to connect", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));

    expect(mockState.logout).toHaveBeenCalledWith({ forgetServerUrl: true });
    expect(mockNavigateToConnect).toHaveBeenCalledWith(undefined, true);
  });
});
