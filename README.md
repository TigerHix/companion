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

**Requirements:** [Bun](https://bun.sh) + [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and/or [Codex](https://github.com/openai/codex) CLI.

### Try it instantly

```bash
bunx moku
```

Open [http://localhost:3456](http://localhost:3456).

### Install globally

```bash
bun install -g moku

# Register as a background service (launchd on macOS, systemd on Linux)
moku install

# Start the service
moku start
```

Open [http://localhost:3456](http://localhost:3456). The server runs in the background and survives reboots.

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
Browser (React)
  <-> ws://localhost:3456/ws/browser/:session
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

## Docs
- Protocol reverse engineering: [`WEBSOCKET_PROTOCOL_REVERSED.md`](WEBSOCKET_PROTOCOL_REVERSED.md)
- Contributor and architecture guide: [`CLAUDE.md`](CLAUDE.md)

## License
MIT
