import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  getSettings,
  updateSettings,
  _resetForTest,
  DEFAULT_ANTHROPIC_MODEL,
} from "./settings-manager.js";

let tempDir: string;
let settingsPath: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "settings-manager-test-"));
  settingsPath = join(tempDir, "settings.json");
  _resetForTest(settingsPath);
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  _resetForTest();
});

describe("settings-manager", () => {
  it("returns defaults when file is missing", () => {
    expect(getSettings()).toEqual({
      anthropicApiKey: "",
      anthropicModel: DEFAULT_ANTHROPIC_MODEL,
      editorTabEnabled: false,
      aiValidationEnabled: false,
      aiValidationAutoApprove: true,
      aiValidationAutoDeny: true,
      updatedAt: 0,
    });
  });

  it("updates and persists settings", () => {
    const updated = updateSettings({ anthropicApiKey: "or-key" });
    expect(updated.anthropicApiKey).toBe("or-key");
    expect(updated.anthropicModel).toBe(DEFAULT_ANTHROPIC_MODEL);
    expect(updated.updatedAt).toBeGreaterThan(0);

    const saved = JSON.parse(readFileSync(settingsPath, "utf-8"));
    expect(saved.anthropicApiKey).toBe("or-key");
    expect(saved.anthropicModel).toBe(DEFAULT_ANTHROPIC_MODEL);
  });

  it("loads existing settings from disk", () => {
    writeFileSync(
      settingsPath,
      JSON.stringify({
        anthropicApiKey: "existing",
        anthropicModel: "openai/gpt-4o-mini",
        updatedAt: 123,
      }),
      "utf-8",
    );

    _resetForTest(settingsPath);

    expect(getSettings()).toEqual({
      anthropicApiKey: "existing",
      anthropicModel: "openai/gpt-4o-mini",
      editorTabEnabled: false,
      aiValidationEnabled: false,
      aiValidationAutoApprove: true,
      aiValidationAutoDeny: true,
      updatedAt: 123,
    });
  });

  it("falls back to defaults for invalid JSON", () => {
    writeFileSync(settingsPath, "not-json", "utf-8");
    _resetForTest(settingsPath);

    expect(getSettings().anthropicModel).toBe(DEFAULT_ANTHROPIC_MODEL);
  });

  it("updates only model while preserving existing key", () => {
    updateSettings({ anthropicApiKey: "or-key" });
    const updated = updateSettings({ anthropicModel: "openai/gpt-4o-mini" });

    expect(updated.anthropicApiKey).toBe("or-key");
    expect(updated.anthropicModel).toBe("openai/gpt-4o-mini");
  });

  it("uses default model when empty model is provided", () => {
    const updated = updateSettings({ anthropicModel: "" });
    expect(updated.anthropicModel).toBe(DEFAULT_ANTHROPIC_MODEL);
  });

  it("normalizes malformed file shape to defaults", () => {
    writeFileSync(
      settingsPath,
      JSON.stringify({
        anthropicApiKey: 123,
        anthropicModel: null,
        updatedAt: "x",
      }),
      "utf-8",
    );
    _resetForTest(settingsPath);

    expect(getSettings()).toEqual({
      anthropicApiKey: "",
      anthropicModel: DEFAULT_ANTHROPIC_MODEL,
      editorTabEnabled: false,
      aiValidationEnabled: false,
      aiValidationAutoApprove: true,
      aiValidationAutoDeny: true,
      updatedAt: 0,
    });
  });

  it("ignores undefined patch values and preserves existing keys", () => {
    updateSettings({ anthropicApiKey: "or-key" });
    const updated = updateSettings({
      anthropicApiKey: undefined,
      anthropicModel: "openai/gpt-4o-mini",
    });

    expect(updated.anthropicApiKey).toBe("or-key");
    expect(updated.anthropicModel).toBe("openai/gpt-4o-mini");
  });

  it("updates editorTabEnabled", () => {
    const updated = updateSettings({ editorTabEnabled: true });
    expect(updated.editorTabEnabled).toBe(true);
  });
});
