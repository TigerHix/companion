import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

export const DEFAULT_OPENROUTER_MODEL = "openrouter/free";

export interface MokuSettings {
  openrouterApiKey: string;
  openrouterModel: string;
  editorTabEnabled: boolean;
  aiValidationEnabled: boolean;
  aiValidationAutoApprove: boolean;
  aiValidationAutoDeny: boolean;
  updatedAt: number;
}

const DEFAULT_PATH = join(homedir(), ".moku", "settings.json");

let loaded = false;
let filePath = DEFAULT_PATH;
let settings: MokuSettings = {
  openrouterApiKey: "",
  openrouterModel: DEFAULT_OPENROUTER_MODEL,
  editorTabEnabled: false,
  aiValidationEnabled: false,
  aiValidationAutoApprove: true,
  aiValidationAutoDeny: true,
  updatedAt: 0,
};

function normalize(raw: Partial<MokuSettings> | null | undefined): MokuSettings {
  return {
    openrouterApiKey: typeof raw?.openrouterApiKey === "string" ? raw.openrouterApiKey : "",
    openrouterModel:
      typeof raw?.openrouterModel === "string" && raw.openrouterModel.trim()
        ? raw.openrouterModel
        : DEFAULT_OPENROUTER_MODEL,
    editorTabEnabled: typeof raw?.editorTabEnabled === "boolean" ? raw.editorTabEnabled : false,
    aiValidationEnabled: typeof raw?.aiValidationEnabled === "boolean" ? raw.aiValidationEnabled : false,
    aiValidationAutoApprove: typeof raw?.aiValidationAutoApprove === "boolean" ? raw.aiValidationAutoApprove : true,
    aiValidationAutoDeny: typeof raw?.aiValidationAutoDeny === "boolean" ? raw.aiValidationAutoDeny : true,
    updatedAt: typeof raw?.updatedAt === "number" ? raw.updatedAt : 0,
  };
}

function ensureLoaded(): void {
  if (loaded) return;
  try {
    if (existsSync(filePath)) {
      const raw = readFileSync(filePath, "utf-8");
      settings = normalize(JSON.parse(raw) as Partial<MokuSettings>);
    }
  } catch {
    settings = normalize(null);
  }
  loaded = true;
}

function persist(): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(settings, null, 2), "utf-8");
}

export function getSettings(): MokuSettings {
  ensureLoaded();
  return { ...settings };
}

export function updateSettings(
  patch: Partial<Pick<MokuSettings, "openrouterApiKey" | "openrouterModel" | "editorTabEnabled" | "aiValidationEnabled" | "aiValidationAutoApprove" | "aiValidationAutoDeny">>,
): MokuSettings {
  ensureLoaded();
  settings = normalize({
    openrouterApiKey: patch.openrouterApiKey ?? settings.openrouterApiKey,
    openrouterModel: patch.openrouterModel ?? settings.openrouterModel,
    editorTabEnabled: patch.editorTabEnabled ?? settings.editorTabEnabled,
    aiValidationEnabled: patch.aiValidationEnabled ?? settings.aiValidationEnabled,
    aiValidationAutoApprove: patch.aiValidationAutoApprove ?? settings.aiValidationAutoApprove,
    aiValidationAutoDeny: patch.aiValidationAutoDeny ?? settings.aiValidationAutoDeny,
    updatedAt: Date.now(),
  });
  persist();
  return { ...settings };
}

export function _resetForTest(customPath?: string): void {
  loaded = false;
  filePath = customPath || DEFAULT_PATH;
  settings = normalize(null);
}
