import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "../store.js";
import { api, verifyAuthToken } from "../api.js";
import { canonicalizeServerUrl, getRememberedServerUrl } from "../connection.js";
import { navigateHome, navigateToConnect, type Route } from "../utils/routing.js";
import { Button } from "@/components/ui/button";

interface Props {
  route?: Extract<Route, { page: "connect" }> | null;
}

export function LoginPage({ route = null }: Props) {
  const [serverUrl, setServerUrl] = useState(() => route?.server || getRememberedServerUrl() || "");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setConnection = useStore((s) => s.setConnection);
  const bootstrapKeyRef = useRef<string | null>(null);

  const connect = useCallback(
    async (serverInput: string, tokenInput: string) => {
      const trimmedToken = tokenInput.trim();
      if (!trimmedToken) {
        throw new Error("Please enter a token");
      }

      const normalizedServerUrl = canonicalizeServerUrl(serverInput);
      const info = await api.getPublicInfo(normalizedServerUrl);
      if (info.authMode !== "bearer_token" || info.deploymentMode !== "tailscale-hosted-frontend") {
        throw new Error("This backend is not compatible with the hosted frontend");
      }

      const canonicalServerUrl = info.canonicalBackendUrl || normalizedServerUrl;
      const valid = await verifyAuthToken(canonicalServerUrl, trimmedToken);
      if (!valid) {
        throw new Error("Invalid token");
      }

      setConnection({
        serverUrl: canonicalServerUrl,
        authToken: trimmedToken,
      });
      navigateHome(true);
    },
    [setConnection],
  );

  useEffect(() => {
    if (route?.server) {
      setServerUrl(route.server);
    } else {
      setServerUrl((current) => current || getRememberedServerUrl() || "");
    }

    if (!route?.token) return;

    const bootstrapKey = `${route.server || ""}\n${route.token}`;
    if (bootstrapKeyRef.current === bootstrapKey) return;
    bootstrapKeyRef.current = bootstrapKey;
    setToken(route.token);
    navigateToConnect(route.server ? { server: route.server } : undefined, true);
    setLoading(true);
    setError(null);
    void connect(route.server || "", route.token)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Unable to connect");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [connect, route?.server, route?.token]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      try {
        await connect(serverUrl, token);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Unable to connect");
      } finally {
        setLoading(false);
      }
    },
    [connect, serverUrl, token],
  );

  const [showToken, setShowToken] = useState(false);

  return (
    <div className="h-[100dvh] flex items-center justify-center bg-background text-foreground font-sans antialiased">
      <div className="w-full max-w-md px-6">
        <div className="text-center mb-8">
          <h1 className="text-xl font-semibold text-foreground mb-2">Moku</h1>
          <p className="text-sm text-muted-foreground">Connect to your Tailscale backend</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="backend-url" className="block text-xs text-muted-foreground mb-1.5">
              Backend URL
            </label>
            <input
              id="backend-url"
              type="url"
              value={serverUrl}
              onChange={(e) => {
                setServerUrl(e.target.value);
                setError(null);
              }}
              placeholder="https://backend-name.tailnet-name.ts.net"
              className="w-full px-3 py-2 text-sm bg-accent border border-border rounded-md text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="auth-token" className="block text-xs text-muted-foreground mb-1.5">
              Auth Token
            </label>
            <div className="relative">
              <input
                id="auth-token"
                type={showToken ? "text" : "password"}
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  setError(null);
                }}
                placeholder="Paste your token here"
                className="w-full px-3 py-2 pr-16 text-sm bg-accent border border-border rounded-md text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono"
                autoComplete="off"
                disabled={loading}
              />
              <Button
                type="button"
                onClick={() => setShowToken(!showToken)}
                variant="ghost"
                size="xs"
                className="absolute right-2 top-1/2 h-auto -translate-y-1/2 px-1.5 py-0.5 text-xs text-muted-foreground"
                tabIndex={-1}
              >
                {showToken ? "Hide" : "Show"}
              </Button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-destructive" role="alert">{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading || !serverUrl.trim() || !token.trim()}
            className="w-full text-sm bg-primary text-white hover:opacity-90"
          >
            {loading ? "Connecting..." : "Connect"}
          </Button>
        </form>

        <p className="mt-6 text-xs text-muted-foreground text-center leading-relaxed">
          Scan the QR code from Settings on another device, or paste the connect link
          printed in the backend startup output.
        </p>
      </div>
    </div>
  );
}
