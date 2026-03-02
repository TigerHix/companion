import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useStore } from "../store.js";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { QrCode } from "lucide-react";

/** Labeled input field with consistent spacing. */
function SettingField({
  label,
  description,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  description?: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div>
        <label className="text-sm font-medium" htmlFor={htmlFor}>
          {label}
        </label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Row with label/description on the left and a control on the right. */
function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

export function SettingsPage() {
  const [anthropicApiKey, setAnthropicApiKey] = useState("");
  const [anthropicModel, setAnthropicModel] = useState("");
  const [editorTabEnabled, setEditorTabEnabled] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const darkMode = useStore((s) => s.darkMode);
  const setDarkMode = useStore((s) => s.setDarkMode);
  const diffBase = useStore((s) => s.diffBase);
  const setDiffBase = useStore((s) => s.setDiffBase);
  const notificationSound = useStore((s) => s.notificationSound);
  const toggleNotificationSound = useStore((s) => s.toggleNotificationSound);
  const notificationDesktop = useStore((s) => s.notificationDesktop);
  const setNotificationDesktop = useStore((s) => s.setNotificationDesktop);
  const setStoreEditorTabEnabled = useStore((s) => s.setEditorTabEnabled);
  const notificationApiAvailable = typeof Notification !== "undefined";
  const [apiKeyFocused, setApiKeyFocused] = useState(false);

  // Auth section state
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [tokenRevealed, setTokenRevealed] = useState(false);
  const [qrCodes, setQrCodes] = useState<{ label: string; url: string; qrDataUrl: string }[] | null>(null);
  const [selectedQrIndex, setSelectedQrIndex] = useState(0);
  const [qrLoading, setQrLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);

  useEffect(() => {
    api
      .getSettings()
      .then((s) => {
        setConfigured(s.anthropicApiKeyConfigured);
        setAnthropicModel(s.anthropicModel || "");
        setEditorTabEnabled(s.editorTabEnabled);
        setStoreEditorTabEnabled(s.editorTabEnabled);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));

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
        anthropicModel: anthropicModel.trim(),
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

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Settings</h1>
      </div>

        {/* Authentication */}
        <Card>
          <CardHeader>
            <CardTitle>Authentication</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Use the auth token or QR code to connect additional devices (e.g. mobile over Tailscale).
            </p>

            {/* Token display */}
            <SettingField label="Auth Token">
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2.5 text-sm rounded-lg border bg-muted/50 font-mono select-all break-all flex items-center min-h-9">
                  {authToken
                    ? tokenRevealed
                      ? authToken
                      : "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                    : <span className="text-muted-foreground">Loading...</span>}
                </div>
                <Button
                  type="button"
                  onClick={() => setTokenRevealed((v) => !v)}
                  variant="outline"
                  size="sm"
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
                  variant="outline"
                  size="sm"
                  title="Copy token to clipboard"
                >
                  {tokenCopied ? "Copied" : "Copy"}
                </Button>
              </div>
            </SettingField>

            {/* QR code */}
            <SettingField label="Mobile Login QR">
              {qrCodes && qrCodes.length > 0 ? (
                <div className="space-y-3">
                  {qrCodes.length > 1 && (
                    <div className="flex gap-1">
                      {qrCodes.map((qr, i) => (
                        <Button
                          key={qr.label}
                          type="button"
                          onClick={() => setSelectedQrIndex(i)}
                          variant={i === selectedQrIndex ? "default" : "outline"}
                          size="xs"
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
                  <div className="px-3 py-2 rounded-lg border bg-muted/50 text-sm font-mono break-all select-all">
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
                  variant="outline"
                  size="sm"
                >
                  {qrLoading ? (
                    <>
                      <Spinner className="size-4" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <QrCode className="size-4" />
                      Show QR Code
                    </>
                  )}
                </Button>
              )}
            </SettingField>

            {/* Regenerate token */}
            <SettingRow
              label="Regenerate Token"
              description="Creates a new token. All other signed-in devices will need to re-authenticate."
            >
              <Button
                type="button"
                onClick={async () => {
                  if (!confirm("Regenerate auth token? All existing sessions on other devices will be signed out.")) return;
                  setRegenerating(true);
                  try {
                    const res = await api.regenerateAuthToken();
                    setAuthToken(res.token);
                    setTokenRevealed(true);
                    setQrCodes(null);
                  } catch {
                    // Regeneration failed
                  } finally {
                    setRegenerating(false);
                  }
                }}
                disabled={regenerating}
                variant="destructive"
                size="sm"
              >
                {regenerating ? <Spinner className="size-4" /> : "Regenerate"}
              </Button>
            </SettingRow>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm font-medium">Theme</p>
            <Tabs
              value={darkMode ? "dark" : "light"}
              onValueChange={(value) => {
                if (value === "light" || value === "dark") {
                  setDarkMode(value === "dark");
                }
              }}
            >
              <TabsList>
                <TabsTrigger value="light">Light</TabsTrigger>
                <TabsTrigger value="dark">Dark</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {/* General */}
        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* moku: not used in moku
            <SettingRow
              label="Editor tab (CodeMirror)"
              description="Shows a simple in-app file editor in the session tabs."
            >
              <Switch
                checked={editorTabEnabled}
                onCheckedChange={setEditorTabEnabled}
                aria-label="Enable Editor tab (CodeMirror)"
              />
            </SettingRow>
            */}

            <SettingField label="Diff compare against" description="Last commit shows only uncommitted changes. Default branch shows all changes since diverging from main.">
              <Tabs
                value={diffBase}
                onValueChange={(value) => {
                  if (value === "last-commit" || value === "default-branch") {
                    setDiffBase(value);
                  }
                }}
              >
                <TabsList>
                  <TabsTrigger value="last-commit">Last commit</TabsTrigger>
                  <TabsTrigger value="default-branch">Default branch</TabsTrigger>
                </TabsList>
              </Tabs>
            </SettingField>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SettingRow label="Sound">
              <Switch
                checked={notificationSound}
                onCheckedChange={toggleNotificationSound}
                aria-label="Sound"
              />
            </SettingRow>
            {notificationApiAvailable && (
              <SettingRow label="Desktop Alerts">
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
              </SettingRow>
            )}
          </CardContent>
        </Card>

        {/* Anthropic */}
        <Card>
          <CardHeader>
            <CardTitle>Anthropic</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSave} className="space-y-4">
              <SettingField
                label="API Key"
                htmlFor="anthropic-key"
                hint="Auto-renaming is disabled until this key is configured."
              >
                <Input
                  id="anthropic-key"
                  type="password"
                  value={configured && !apiKeyFocused && !anthropicApiKey ? "••••••••••••••••" : anthropicApiKey}
                  onChange={(e) => setAnthropicApiKey(e.target.value)}
                  onFocus={() => setApiKeyFocused(true)}
                  onBlur={() => setApiKeyFocused(false)}
                  placeholder={configured ? "Enter a new key to replace" : "sk-ant-..."}
                />
              </SettingField>

              <SettingField label="Model" htmlFor="anthropic-model">
                <Input
                  id="anthropic-model"
                  type="text"
                  value={anthropicModel}
                  onChange={(e) => setAnthropicModel(e.target.value)}
                  placeholder="claude-sonnet-4-20250514"
                />
              </SettingField>

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
                <Button type="submit" disabled={saving || loading} size="sm">
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
    </div>
  );
}
