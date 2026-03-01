// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

interface MockStoreState {
  darkMode: boolean;
  notificationSound: boolean;
  notificationDesktop: boolean;
  diffBase: string;
  setDarkMode: ReturnType<typeof vi.fn>;
  toggleNotificationSound: ReturnType<typeof vi.fn>;
  setNotificationDesktop: ReturnType<typeof vi.fn>;
  setDiffBase: ReturnType<typeof vi.fn>;
  setEditorTabEnabled: ReturnType<typeof vi.fn>;
  currentSessionId: string | null;
}

let mockState: MockStoreState;

function createMockState(overrides: Partial<MockStoreState> = {}): MockStoreState {
  return {
    darkMode: false,
    notificationSound: true,
    notificationDesktop: false,
    diffBase: "last-commit",
    setDarkMode: vi.fn(),
    toggleNotificationSound: vi.fn(),
    setNotificationDesktop: vi.fn(),
    setDiffBase: vi.fn(),
    setEditorTabEnabled: vi.fn(),
    currentSessionId: null,
    ...overrides,
  };
}

const mockApi = {
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  getAuthToken: vi.fn(),
  regenerateAuthToken: vi.fn(),
  getAuthQr: vi.fn(),
};

vi.mock("../api.js", () => ({
  api: {
    getSettings: (...args: unknown[]) => mockApi.getSettings(...args),
    updateSettings: (...args: unknown[]) => mockApi.updateSettings(...args),
    getAuthToken: (...args: unknown[]) => mockApi.getAuthToken(...args),
    regenerateAuthToken: (...args: unknown[]) => mockApi.regenerateAuthToken(...args),
    getAuthQr: (...args: unknown[]) => mockApi.getAuthQr(...args),
  },
}));

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
    editorTabEnabled: false,
  });
  mockApi.updateSettings.mockResolvedValue({
    anthropicApiKeyConfigured: true,
    anthropicModel: "claude-sonnet-4.6",
    editorTabEnabled: false,
  });
  mockApi.getAuthToken.mockResolvedValue({ token: "abc123testtoken" });
  mockApi.regenerateAuthToken.mockResolvedValue({ token: "newtoken456" });
  mockApi.getAuthQr.mockResolvedValue({
    qrCodes: [
      { label: "LAN", url: "http://192.168.1.10:3456", qrDataUrl: "data:image/png;base64,LAN_QR" },
      { label: "Tailscale", url: "http://100.118.112.23:3456", qrDataUrl: "data:image/png;base64,TS_QR" },
    ],
  });
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
      editorTabEnabled: false,
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
        editorTabEnabled: false,
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
        editorTabEnabled: false,
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
        editorTabEnabled: false,
      });
    });
  });

  // Editor tab toggle is in the General card; toggling it updates local state,
  // which is then included in the Anthropic form's save payload.
  it("saves editor tab toggle in settings payload", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    fireEvent.click(screen.getByRole("switch", { name: /Enable Editor tab \(CodeMirror\)/i }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockApi.updateSettings).toHaveBeenCalledWith({
        anthropicModel: "claude-sonnet-4.6",
        editorTabEnabled: true,
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
      editorTabEnabled: boolean;
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
      editorTabEnabled: false,
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

  // Clicking the "Environments" link card navigates to the environments page.
  it("navigates to environments page from settings", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    fireEvent.click(screen.getByText("Environments"));
    expect(window.location.hash).toBe("#/environments");
  });

  // Clicking the "Agents" link card navigates to the agents page.
  it("navigates to agents page from settings", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    fireEvent.click(screen.getByText("Agents"));
    expect(window.location.hash).toBe("#/agents");
  });

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
    expect(screen.getByText("Environments")).toBeInTheDocument();
    expect(screen.getByText("Agents")).toBeInTheDocument();
  });

  // ─── Authentication section tests ──────────────────────────────────

  // The auth card fetches the token on mount and displays it masked.
  it("fetches and displays the auth token masked by default", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    expect(mockApi.getAuthToken).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByText("\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022")).toBeInTheDocument();
    });
    expect(screen.queryByText("abc123testtoken")).not.toBeInTheDocument();
  });

  // Clicking "Show" reveals the actual token value.
  it("reveals the token when Show is clicked", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    await waitFor(() => {
      expect(screen.getByText("\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle("Show token"));
    expect(screen.getByText("abc123testtoken")).toBeInTheDocument();
  });

  // Clicking "Show QR Code" loads and displays QR with address tabs.
  it("shows QR code with address tabs when button is clicked", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    fireEvent.click(screen.getByRole("button", { name: "Show QR Code" }));

    await waitFor(() => {
      expect(mockApi.getAuthQr).toHaveBeenCalledTimes(1);
    });

    const img = await screen.findByAltText("QR code for LAN login");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "data:image/png;base64,LAN_QR");

    expect(screen.getByRole("button", { name: "LAN" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tailscale" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tailscale" }));
    const tsImg = screen.getByAltText("QR code for Tailscale login");
    expect(tsImg).toHaveAttribute("src", "data:image/png;base64,TS_QR");
    expect(screen.getByText("http://100.118.112.23:3456")).toBeInTheDocument();
  });

  // Regenerating the token calls the API and reveals the new token.
  it("regenerates the token after user confirms", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }));

    await waitFor(() => {
      expect(mockApi.regenerateAuthToken).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText("newtoken456")).toBeInTheDocument();

    (window.confirm as ReturnType<typeof vi.spyOn>).mockRestore();
  });

  // Cancelling the confirmation dialog skips regeneration entirely.
  it("does not regenerate when user cancels confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }));

    expect(mockApi.regenerateAuthToken).not.toHaveBeenCalled();

    (window.confirm as ReturnType<typeof vi.spyOn>).mockRestore();
  });
});
