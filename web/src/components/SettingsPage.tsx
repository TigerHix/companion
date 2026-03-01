import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "../api.js";
import { useStore } from "../store.js";

import { navigateToSession, navigateHome } from "../utils/routing.js";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

interface SettingsPageProps {
  embedded?: boolean;
}

const CATEGORIES = [
  { id: "general", label: "General" },
  { id: "authentication", label: "Authentication" },
  { id: "notifications", label: "Notifications" },
  { id: "anthropic", label: "Anthropic" },
  { id: "ai-validation", label: "AI Validation" },
  { id: "environments", label: "Environments" },
  { id: "agents", label: "Agents" },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

export function SettingsPage({ embedded = false }: SettingsPageProps) {
  const [anthropicApiKey, setAnthropicApiKey] = useState("");
  const [anthropicModel, setAnthropicModel] = useState("claude-sonnet-4.6");
  const [editorTabEnabled, setEditorTabEnabled] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const darkMode = useStore((s) => s.darkMode);
  const toggleDarkMode = useStore((s) => s.toggleDarkMode);
  const diffBase = useStore((s) => s.diffBase);
  const setDiffBase = useStore((s) => s.setDiffBase);
  const notificationSound = useStore((s) => s.notificationSound);
  const toggleNotificationSound = useStore((s) => s.toggleNotificationSound);
  const notificationDesktop = useStore((s) => s.notificationDesktop);
  const setNotificationDesktop = useStore((s) => s.setNotificationDesktop);
  const setStoreEditorTabEnabled = useStore((s) => s.setEditorTabEnabled);
  const notificationApiAvailable = typeof Notification !== "undefined";
  const [aiValidationEnabled, setAiValidationEnabled] = useState(false);
  const [aiValidationAutoApprove, setAiValidationAutoApprove] = useState(true);
  const [aiValidationAutoDeny, setAiValidationAutoDeny] = useState(true);
  const [activeSection, setActiveSection] = useState<CategoryId>("general");
  const [apiKeyFocused, setApiKeyFocused] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; error?: string } | null>(null);

  // Auth section state
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [tokenRevealed, setTokenRevealed] = useState(false);
  const [qrCodes, setQrCodes] = useState<{ label: string; url: string; qrDataUrl: string }[] | null>(null);
  const [selectedQrIndex, setSelectedQrIndex] = useState(0);
  const [qrLoading, setQrLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // IntersectionObserver to track which section is in view
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible section
        let topEntry: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (!topEntry || entry.boundingClientRect.top < topEntry.boundingClientRect.top) {
              topEntry = entry;
            }
          }
        }
        if (topEntry?.target?.id) {
          setActiveSection(topEntry.target.id as CategoryId);
        }
      },
      {
        root: container,
        rootMargin: "-10% 0px -70% 0px",
        threshold: 0,
      },
    );

    for (const cat of CATEGORIES) {
      const el = sectionRefs.current[cat.id];
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [loading]); // re-attach after loading completes and sections render

  const scrollToSection = useCallback((id: CategoryId) => {
    setActiveSection(id);
    const el = sectionRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  useEffect(() => {
    api
      .getSettings()
      .then((s) => {
        setConfigured(s.anthropicApiKeyConfigured);
        setAnthropicModel(s.anthropicModel || "claude-sonnet-4.6");
        setEditorTabEnabled(s.editorTabEnabled);
        setStoreEditorTabEnabled(s.editorTabEnabled);
        if (typeof s.aiValidationEnabled === "boolean") setAiValidationEnabled(s.aiValidationEnabled);
        if (typeof s.aiValidationAutoApprove === "boolean") setAiValidationAutoApprove(s.aiValidationAutoApprove);
        if (typeof s.aiValidationAutoDeny === "boolean") setAiValidationAutoDeny(s.aiValidationAutoDeny);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));

    // Fetch auth token in parallel (non-blocking)
    api.getAuthToken().then((res) => setAuthToken(res.token)).catch(() => {});
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const nextKey = anthropicApiKey.trim();
      const payload: { anthropicApiKey?: string; anthropicModel: string; editorTabEnabled: boolean } = {
        anthropicModel: anthropicModel.trim() || "claude-sonnet-4.6",
        editorTabEnabled,
      };
      if (nextKey) {
        payload.anthropicApiKey = nextKey;
      }

      const res = await api.updateSettings(payload);
      setConfigured(res.anthropicApiKeyConfigured);
      setEditorTabEnabled(res.editorTabEnabled);
      setStoreEditorTabEnabled(res.editorTabEnabled);
      setAnthropicApiKey("");
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleAiValidation(field: "aiValidationEnabled" | "aiValidationAutoApprove" | "aiValidationAutoDeny") {
    const current = field === "aiValidationEnabled" ? aiValidationEnabled
      : field === "aiValidationAutoApprove" ? aiValidationAutoApprove
      : aiValidationAutoDeny;
    const newValue = !current;
    // Optimistic UI update
    if (field === "aiValidationEnabled") setAiValidationEnabled(newValue);
    else if (field === "aiValidationAutoApprove") setAiValidationAutoApprove(newValue);
    else setAiValidationAutoDeny(newValue);

    try {
      await api.updateSettings({ [field]: newValue });
    } catch {
      // Revert on failure
      if (field === "aiValidationEnabled") setAiValidationEnabled(current);
      else if (field === "aiValidationAutoApprove") setAiValidationAutoApprove(current);
      else setAiValidationAutoDeny(current);
    }
  }

  const setSectionRef = useCallback((id: string) => (el: HTMLElement | null) => {
    sectionRefs.current[id] = el;
  }, []);

  const settingRowClass =
    "w-full flex items-center justify-between gap-3 px-3 py-3 min-h-[44px] rounded-lg text-sm bg-accent text-foreground";

  return (
    <div className={`${embedded ? "h-full" : "h-[100dvh]"} bg-background text-foreground font-sans antialiased flex flex-col`}>
      {/* Header */}
      <div className="shrink-0 max-w-5xl w-full mx-auto px-4 sm:px-8 pt-6 sm:pt-10">
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Settings</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Configure API access, notifications, appearance, and workspace defaults.
            </p>
          </div>
          {!embedded && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                const sessionId = useStore.getState().currentSessionId;
                if (sessionId) {
                  navigateToSession(sessionId);
                } else {
                  navigateHome();
                }
              }}
              className="min-h-[44px] px-3 py-2.5 text-sm"
            >
              Back
            </Button>
          )}
        </div>
      </div>

      {/* Mobile horizontal nav */}
      <div className="sm:hidden shrink-0 border-b border-border">
        <nav
          className="flex gap-1 px-4 py-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Settings categories"
        >
          {CATEGORIES.map((cat) => (
            <Button
              key={cat.id}
              type="button"
              onClick={() => scrollToSection(cat.id)}
              variant="ghost"
              size="sm"
              className={`shrink-0 px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activeSection === cat.id
                  ? "text-primary bg-primary/8"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              {cat.label}
            </Button>
          ))}
        </nav>
      </div>

      {/* Body: desktop sidebar + content */}
      <div className="flex-1 min-h-0 flex max-w-5xl w-full mx-auto">
        {/* Desktop sidebar nav */}
        <nav
          className="hidden sm:flex flex-col gap-0.5 w-44 shrink-0 pt-2 pr-6 pl-8 sticky top-0 self-start"
          aria-label="Settings categories"
        >
          {CATEGORIES.map((cat) => (
            <Button
              key={cat.id}
              type="button"
              onClick={() => scrollToSection(cat.id)}
              variant="ghost"
              size="sm"
              className={`text-left px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activeSection === cat.id
                  ? "text-primary bg-primary/8"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              {cat.label}
            </Button>
          ))}
        </nav>

        {/* Scrollable content */}
        <div ref={contentRef} className="flex-1 min-w-0 overflow-y-auto px-4 sm:px-8 sm:pl-0 pb-28 md:pb-0">
          <div className="space-y-10 py-4 sm:py-2">
            {/* General */}
            <section id="general" ref={setSectionRef("general")}>
              <h2 className="text-sm font-semibold text-foreground mb-4">General</h2>
              <div className="space-y-3">
                <Button
                  type="button"
                  onClick={toggleDarkMode}
                  variant="ghost"
                  size="sm"
                  className="h-auto w-full justify-between px-3 py-3 min-h-[44px] rounded-lg text-sm bg-accent text-foreground hover:bg-accent"
                >
                  <span>Theme</span>
                  <span className="text-xs text-muted-foreground">{darkMode ? "Dark" : "Light"}</span>
                </Button>

                <div className={settingRowClass}>
                  <span>Enable Editor tab (CodeMirror)</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{editorTabEnabled ? "On" : "Off"}</span>
                    <Switch
                      checked={editorTabEnabled}
                      onCheckedChange={setEditorTabEnabled}
                      aria-label="Enable Editor tab (CodeMirror)"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground px-1">
                  Shows a simple in-app file editor in the session tabs.
                </p>

                <Button
                  type="button"
                  onClick={() => setDiffBase(diffBase === "last-commit" ? "default-branch" : "last-commit")}
                  variant="ghost"
                  size="sm"
                  className="h-auto w-full justify-between px-3 py-3 min-h-[44px] rounded-lg text-sm bg-accent text-foreground hover:bg-accent"
                >
                  <span>Diff compare against</span>
                  <span className="text-xs text-muted-foreground">
                    {diffBase === "last-commit" ? "Last commit (HEAD)" : "Default branch"}
                  </span>
                </Button>
                <p className="text-xs text-muted-foreground px-1">
                  Last commit shows only uncommitted changes. Default branch shows all changes since diverging from main.
                </p>
              </div>
            </section>

            {/* Authentication */}
            <section id="authentication" ref={setSectionRef("authentication")}>
              <h2 className="text-sm font-semibold text-foreground mb-4">Authentication</h2>
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Use the auth token or QR code to connect additional devices (e.g. mobile over Tailscale).
                </p>

                {/* Token display */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Auth Token</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2.5 min-h-[44px] text-sm bg-background rounded-lg text-foreground font-mono select-all break-all flex items-center">
                      {authToken
                        ? tokenRevealed
                          ? authToken
                          : "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                        : <span className="text-muted-foreground">Loading...</span>}
                    </div>
                    <Button
                      type="button"
                      onClick={() => setTokenRevealed((v) => !v)}
                      variant="ghost"
                      size="sm"
                      className="min-h-[44px] bg-accent text-foreground hover:bg-accent"
                      title={tokenRevealed ? "Hide token" : "Show token"}
                    >
                      {tokenRevealed ? "Hide" : "Show"}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        if (authToken) {
                          navigator.clipboard.writeText(authToken).then(() => {
                            setTokenCopied(true);
                            setTimeout(() => setTokenCopied(false), 1500);
                          });
                        }
                      }}
                      disabled={!authToken}
                      variant="ghost"
                      size="sm"
                      className="min-h-[44px] bg-accent text-foreground hover:bg-accent"
                      title="Copy token to clipboard"
                    >
                      {tokenCopied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </div>

                {/* QR code with address tabs */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Mobile Login QR</label>
                  {qrCodes && qrCodes.length > 0 ? (
                    <div className="space-y-3">
                      {/* Address tabs — pick which network to use */}
                      {qrCodes.length > 1 && (
                        <div className="flex gap-1">
                          {qrCodes.map((qr, i) => (
                            <Button
                              key={qr.label}
                              type="button"
                              onClick={() => setSelectedQrIndex(i)}
                              variant={i === selectedQrIndex ? "default" : "ghost"}
                              size="xs"
                              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                                i === selectedQrIndex
                                  ? "bg-primary text-white"
                                  : "bg-accent text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {qr.label}
                            </Button>
                          ))}
                        </div>
                      )}
                      <div className="inline-block rounded-lg bg-white p-2">
                        <img
                          src={qrCodes[selectedQrIndex].qrDataUrl}
                          alt={`QR code for ${qrCodes[selectedQrIndex].label} login`}
                          className="w-48 h-48"
                        />
                      </div>
                      <div className="px-3 py-2 rounded-lg bg-background text-sm font-mono text-foreground break-all select-all">
                        {qrCodes[selectedQrIndex].url}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Scan with your phone&apos;s camera app — it will open the URL and auto-authenticate.
                      </p>
                    </div>
                  ) : qrCodes && qrCodes.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No remote addresses detected (LAN or Tailscale). Connect to a network to generate a QR code.
                    </p>
                  ) : (
                    <Button
                      type="button"
                      onClick={async () => {
                        setQrLoading(true);
                        try {
                          const data = await api.getAuthQr();
                          setQrCodes(data.qrCodes);
                        } catch {
                          // QR generation failed silently — user can retry
                        } finally {
                          setQrLoading(false);
                        }
                      }}
                      disabled={qrLoading}
                      variant="ghost"
                      size="sm"
                      className={`px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
                        qrLoading
                          ? "bg-accent text-muted-foreground cursor-not-allowed"
                          : "bg-accent hover:bg-accent text-foreground cursor-pointer"
                      }`}
                    >
                      {qrLoading ? "Generating..." : "Show QR Code"}
                    </Button>
                  )}
                </div>

                {/* Regenerate token */}
                <div className="pt-2">
                  <Button
                    type="button"
                    onClick={async () => {
                      if (!confirm("Regenerate auth token? All existing sessions on other devices will be signed out.")) return;
                      setRegenerating(true);
                      try {
                        const res = await api.regenerateAuthToken();
                        setAuthToken(res.token);
                        setTokenRevealed(true);
                        setQrCodes(null); // invalidate old QR
                      } catch {
                        // Regeneration failed
                      } finally {
                        setRegenerating(false);
                      }
                    }}
                    disabled={regenerating}
                    variant="ghost"
                    size="sm"
                    className={`px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
                      regenerating
                        ? "bg-accent text-muted-foreground cursor-not-allowed"
                        : "bg-destructive/10 hover:bg-destructive/20 text-destructive cursor-pointer"
                    }`}
                  >
                    {regenerating ? "Regenerating..." : "Regenerate Token"}
                  </Button>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Creates a new token. All other signed-in devices will need to re-authenticate.
                  </p>
                </div>
              </div>
            </section>

            {/* Notifications */}
            <section id="notifications" ref={setSectionRef("notifications")}>
              <h2 className="text-sm font-semibold text-foreground mb-4">Notifications</h2>
              <div className="space-y-3">
                <div className={settingRowClass}>
                  <span>Sound</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{notificationSound ? "On" : "Off"}</span>
                    <Switch
                      checked={notificationSound}
                      onCheckedChange={toggleNotificationSound}
                      aria-label="Sound"
                    />
                  </div>
                </div>
                {notificationApiAvailable && (
                  <div className={settingRowClass}>
                    <span>Desktop Alerts</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{notificationDesktop ? "On" : "Off"}</span>
                      <Switch
                        checked={notificationDesktop}
                        onCheckedChange={async (checked) => {
                          if (checked) {
                            if (Notification.permission !== "granted") {
                              const result = await Notification.requestPermission();
                              if (result !== "granted") return;
                            }
                            setNotificationDesktop(true);
                          } else {
                            setNotificationDesktop(false);
                          }
                        }}
                        aria-label="Desktop Alerts"
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Anthropic */}
            <section id="anthropic" ref={setSectionRef("anthropic")}>
              <h2 className="text-sm font-semibold text-foreground mb-4">Anthropic</h2>
              <form onSubmit={onSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" htmlFor="anthropic-key">
                    Anthropic API Key
                  </label>
                  <input
                    id="anthropic-key"
                    type="password"
                    value={configured && !apiKeyFocused && !anthropicApiKey ? "••••••••••••••••" : anthropicApiKey}
                    onChange={(e) => {
                      setAnthropicApiKey(e.target.value);
                      setVerifyResult(null);
                    }}
                    onFocus={() => setApiKeyFocused(true)}
                    onBlur={() => setApiKeyFocused(false)}
                    placeholder={configured ? "Enter a new key to replace" : "sk-ant-..."}
                    className="w-full px-3 py-2.5 min-h-[44px] text-sm bg-background rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 transition-shadow"
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Auto-renaming is disabled until this key is configured.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" htmlFor="anthropic-model">
                    Anthropic Model
                  </label>
                  <input
                    id="anthropic-model"
                    type="text"
                    value={anthropicModel}
                    onChange={(e) => setAnthropicModel(e.target.value)}
                    placeholder="claude-sonnet-4.6"
                    className="w-full px-3 py-2.5 min-h-[44px] text-sm bg-background rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 transition-shadow"
                  />
                </div>

                {error && (
                  <div className="px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                    {error}
                  </div>
                )}

                {saved && (
                  <div className="px-3 py-2 rounded-lg bg-success/10 border border-success/20 text-xs text-success">
                    Settings saved.
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {loading ? "Loading..." : configured ? "Anthropic key configured" : "Anthropic key not configured"}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={verifying || !anthropicApiKey.trim()}
                      size="sm"
                      onClick={async () => {
                        setVerifying(true);
                        setVerifyResult(null);
                        try {
                          const result = await api.verifyAnthropicKey(anthropicApiKey.trim());
                          setVerifyResult(result);
                          setTimeout(() => setVerifyResult(null), 5000);
                        } catch (err: unknown) {
                          setVerifyResult({ valid: false, error: err instanceof Error ? err.message : String(err) });
                          setTimeout(() => setVerifyResult(null), 5000);
                        } finally {
                          setVerifying(false);
                        }
                      }}
                      className="px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium"
                    >
                      {verifying ? "Verifying..." : "Verify"}
                    </Button>
                    <Button
                      type="submit"
                      disabled={saving || loading}
                      size="sm"
                      className={`px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
                        saving || loading
                          ? "bg-accent text-muted-foreground cursor-not-allowed"
                          : "bg-primary hover:bg-primary/90 text-white cursor-pointer"
                      }`}
                    >
                      {saving ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>

                {verifyResult && (
                  <div className={`px-3 py-2 rounded-lg text-xs ${
                    verifyResult.valid
                      ? "bg-success/10 border border-success/20 text-success"
                      : "bg-destructive/10 border border-destructive/20 text-destructive"
                  }`}>
                    {verifyResult.valid ? "API key is valid." : `Invalid API key${verifyResult.error ? `: ${verifyResult.error}` : "."}`}
                  </div>
                )}
              </form>
            </section>

            {/* AI Validation */}
            <section id="ai-validation" ref={setSectionRef("ai-validation")}>
              <h2 className="text-sm font-semibold text-foreground mb-4">AI Validation</h2>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  When enabled, an AI model evaluates tool calls before they execute.
                  Safe operations are auto-approved, dangerous ones are blocked,
                  and uncertain cases are shown to you with a recommendation.
                  Requires an Anthropic API key. These settings serve as defaults
                  for new sessions. Each session can override AI validation
                  independently via the shield icon in the session header.
                </p>

                <div
                  className={`${settingRowClass} ${
                    !configured ? "text-muted-foreground opacity-60" : ""
                  }`}
                >
                  <span className="text-sm">AI Validation Mode</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${aiValidationEnabled && configured ? "text-success" : "text-muted-foreground"}`}>
                      {aiValidationEnabled && configured ? "On" : "Off"}
                    </span>
                    <Switch
                      checked={aiValidationEnabled && configured}
                      onCheckedChange={() => toggleAiValidation("aiValidationEnabled")}
                      disabled={!configured}
                      aria-label="AI Validation Mode"
                    />
                  </div>
                </div>
                {!configured && (
                  <p className="text-xs text-warning">Configure an Anthropic API key above to enable AI validation.</p>
                )}

                {aiValidationEnabled && configured && (
                  <>
                    <div className={settingRowClass}>
                      <div>
                        <span className="text-sm">Auto-approve safe tools</span>
                        <p className="text-xs text-muted-foreground mt-0.5">Automatically allow read-only tools and benign commands</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${aiValidationAutoApprove ? "text-success" : "text-muted-foreground"}`}>
                          {aiValidationAutoApprove ? "On" : "Off"}
                        </span>
                        <Switch
                          checked={aiValidationAutoApprove}
                          onCheckedChange={() => toggleAiValidation("aiValidationAutoApprove")}
                          aria-label="Auto-approve safe tools"
                        />
                      </div>
                    </div>

                    <div className={settingRowClass}>
                      <div>
                        <span className="text-sm">Auto-deny dangerous tools</span>
                        <p className="text-xs text-muted-foreground mt-0.5">Automatically block destructive commands like rm -rf</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${aiValidationAutoDeny ? "text-success" : "text-muted-foreground"}`}>
                          {aiValidationAutoDeny ? "On" : "Off"}
                        </span>
                        <Switch
                          checked={aiValidationAutoDeny}
                          onCheckedChange={() => toggleAiValidation("aiValidationAutoDeny")}
                          aria-label="Auto-deny dangerous tools"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* Environments */}
            <section id="environments" ref={setSectionRef("environments")}>
              <h2 className="text-sm font-semibold text-foreground mb-4">Environments</h2>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Manage reusable environment profiles used when creating sessions.
                </p>
                <Button
                  type="button"
                  onClick={() => {
                    window.location.hash = "#/environments";
                  }}
                  size="sm"
                  className="min-h-[44px] px-3 py-2 text-sm font-medium"
                >
                  Open Environments Page
                </Button>
              </div>
            </section>

            <section id="agents" ref={setSectionRef("agents")}>
              <h2 className="text-sm font-semibold text-foreground mb-4">Agents</h2>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  View and manage agent runs and their sessions.
                </p>
                <Button
                  type="button"
                  onClick={() => {
                    window.location.hash = "#/agents";
                  }}
                  size="sm"
                  className="min-h-[44px] px-3 py-2 text-sm font-medium"
                >
                  Open Agents Page
                </Button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
