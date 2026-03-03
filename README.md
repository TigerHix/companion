<p align="center">
  <img src="screenshot.png" alt="Moku" width="100%" />
</p>

<h1 align="center">Moku</h1>
<p align="center"><strong>Web UI for Claude Code and Codex sessions.</strong></p>
<p align="center">Run multiple agents, inspect every tool call, and gate risky actions with explicit approvals.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/moku"><img src="https://img.shields.io/npm/v/moku.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/moku"><img src="https://img.shields.io/npm/dm/moku.svg" alt="npm downloads" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT License" /></a>
</p>

## Quick start

**Requirements:** [Bun](https://bun.sh), [Tailscale](https://tailscale.com/), and [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and/or [Codex](https://github.com/openai/codex) CLI.

### Try it instantly

```bash
bunx moku
```

Moku starts the backend locally, reconciles `tailscale serve`, and prints:

- Hosted frontend URL
- Backend Tailscale URL
- Auth token
- Connect URL
- A terminal QR code for that connect URL

Open the printed connect URL, or open [https://moku.sh](https://moku.sh) and enter the backend URL plus auth token.

### Install globally

```bash
bun install -g moku

# Register as a background service (launchd on macOS, systemd on Linux)
moku install

# Start the service
moku start
```

The server runs in the background and survives reboots. Use the printed connect URL or [https://moku.sh](https://moku.sh) to connect.

## Deploy the frontend on Vercel

This repo now includes a root-level [`vercel.json`](vercel.json) that builds the Vite app from `web/` and publishes `web/dist` as a static site.

Recommended Vercel setup:

```bash
vercel
```

Or import the repo in the Vercel dashboard and keep the default root directory at the repository root. The checked-in config will:

- run `bun install`
- run `bun run build`
- publish `web/dist`

After you have a stable frontend URL, point the backend at it:

```bash
MOKU_FRONTEND_URL="https://your-app.vercel.app" bunx moku
```

For a background service, set the same environment variable in the service environment before starting Moku.

Important:

- `MOKU_FRONTEND_URL` should be the exact production origin you want Moku to print in the connect URL.
- Browser origins are exact-match checked. If you want to allow multiple Vercel domains, set `MOKU_ALLOWED_WEB_ORIGINS` to a comma-separated list of exact origins.
- Vercel preview URLs are not automatically allowed unless you add them to `MOKU_ALLOWED_WEB_ORIGINS`.
- If you keep using `https://moku.sh`, you do not need to set either variable.

## CLI commands

| Command | Description |
|---|---|
| `moku` | Start server in foreground (default) |
| `moku serve` | Start server in foreground (explicit) |
| `moku install` | Register as a background service (launchd/systemd) |
| `moku start` | Start the background service |
| `moku stop` | Stop the background service |
| `moku restart` | Restart the background service |
| `moku uninstall` | Remove the background service |
| `moku status` | Show service status |
| `moku logs` | Tail service log files |

**Options:** `--port <n>` overrides the default port (3456).

## Why this is useful
- **Parallel sessions**: work on multiple tasks without juggling terminals.
- **Full visibility**: see streaming output, tool calls, and tool results in one timeline.
- **Permission control**: approve/deny sensitive operations from the UI.
- **Session recovery**: restore work after process/server restarts.
- **Dual-engine support**: designed for both Claude Code and Codex-backed flows.

## Screenshots
| Chat + tool timeline | Permission flow |
|---|---|
| <img src="screenshot.png" alt="Main workspace" width="100%" /> | <img src="web/docs/screenshots/notification-section.png" alt="Permission and notifications" width="100%" /> |

## Architecture (simple)
```text
Browser / PWA (https://moku.sh)
  <-> https://<machine>.<tailnet>.ts.net/api
  <-> wss://<machine>.<tailnet>.ts.net/ws/browser/:session
Moku server (Bun + Hono)
  <-> ws://localhost:3456/ws/cli/:session
Claude Code / Codex CLI
```

The bridge uses the CLI `--sdk-url` websocket path and NDJSON events.

## Authentication

The server auto-generates an auth token on first start, stored at `~/.moku/auth.json`. You can also manage tokens manually:

```bash
# Show the current token (or auto-generate one)
cd web && bun run generate-token

# Force-regenerate a new token
cd web && bun run generate-token --force
```

Or set a token via environment variable (takes priority over the file):

```bash
MOKU_AUTH_TOKEN="my-secret-token" bunx moku
```

The token is used by the hosted frontend connect flow. `GET /api/public/info` stays unauthenticated so the frontend can discover backend capabilities before login; all other API routes require the bearer token.

## Development
```bash
make dev
```

Manual:
```bash
cd web
bun install
bun run dev
```

Checks:
```bash
cd web
bun run typecheck
bun run test
```

For local frontend development, use the Vite app on [http://localhost:5174](http://localhost:5174). It connects to the backend on port `3456` using the same saved backend URL + token model as the hosted frontend.

## Docs
- Protocol reverse engineering: [`WEBSOCKET_PROTOCOL_REVERSED.md`](WEBSOCKET_PROTOCOL_REVERSED.md)
- Contributor and architecture guide: [`CLAUDE.md`](CLAUDE.md)

## License
MIT
