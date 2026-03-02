# Browser-Session Terminal Persistence Plan

Status: Ready

## Summary

This document defines the implementation plan for terminal persistence within a single browser session.

Target behavior:

1. A terminal opened in a session survives route changes, session switches, and full page reloads.
2. Reattaching restores the same shell process, not a new shell.
3. Reattaching redraws the prior terminal screen and retained scrollback before live output resumes.
4. Explicit terminal close still kills the PTY immediately.
5. The feature works for both host and container-backed terminals.

This plan is intentionally limited to the case where the Companion server process remains alive. Persistence across Companion restart is out of scope for this document.

This document is intended to be self-sufficient for a fresh Codex handoff. Another agent should be able to execute the work using this file plus repository inspection, without relying on prior chat history.

## Current State Snapshot

The following current-state facts matter for implementation:

- Terminal tabs are tracked in frontend Zustand state as a single global quick-terminal array, not per session.
- Quick terminal tab state is not persisted to `sessionStorage` or `localStorage`.
- `TerminalView` always spawns a new backend terminal on mount.
- `TerminalView` kills the backend terminal on unmount.
- The backend terminal manager keeps terminal state only in memory.
- The backend terminal manager kills an orphaned terminal 5 seconds after the last browser socket disconnects.
- The backend has no session-level terminal listing API.
- The backend can attach multiple browser sockets to the same terminal, but it has no replay mechanism for restoring prior output.
- The app keeps the dock mounted only for some tab transitions. Full page reload, switching to non-session pages, or certain session transitions still unmount terminal views.

Relevant files:

- `web/src/store.ts`
- `web/src/components/SessionTerminalDock.tsx`
- `web/src/components/TerminalView.tsx`
- `web/src/components/TopBar.tsx`
- `web/src/terminal-ws.ts`
- `web/server/terminal-manager.ts`
- `web/server/routes/system-routes.ts`
- `web/server/index.ts`
- `web/server/routes.ts`

## Goals

- Persist terminal tabs for the lifetime of the browser session using `sessionStorage`.
- Make terminal ownership explicit per app session and per terminal tab.
- Allow `TerminalView` to reattach to an existing live terminal instead of always spawning a new one.
- Restore the visible terminal state and retained scrollback after reload or remount.
- Keep terminal lifetime independent from React mount lifetime.
- Preserve explicit close semantics.
- Add test coverage for backend replay behavior, frontend persistence hydration, and attach-or-spawn behavior.

## Non-Goals

- Surviving Companion server restart.
- Using `tmux`, `screen`, `zellij`, or another external multiplexer.
- Cross-window or cross-browser synchronization of terminal tabs.
- Infinite scrollback retention.
- Redesigning the terminal UI beyond the changes needed to support persistence and replay.
- Replacing the existing xterm-based frontend terminal implementation.

## Product Decisions

### 1. Persistence boundary

- Persist terminal tab metadata in `sessionStorage`.
- Do not persist terminal output in browser storage.
- Do not persist terminal state in `localStorage`.
- Browser-session persistence means:
  - state survives reload in the same browser tab/window
  - state survives route changes inside the app
  - state survives switching away from and back to the app tab
  - state does not survive closing the browser session

### 2. Ownership model

- Each live terminal belongs to exactly one app session and one terminal tab.
- Terminal identity is:
  - `sessionId`
  - `tabId`
  - `terminalId`
- Backend terminal instances must store `sessionId` and `tabId`.
- Frontend tab state must store `terminalId` once the terminal is created.

### 3. Restore model

- Reattach must prefer an existing live terminal when a stored `terminalId` is present.
- If the stored terminal no longer exists on the server, the client must transparently spawn a replacement and update the persisted state.
- The server must expose a session-scoped terminal listing API so the frontend can reconcile `sessionStorage` state with actual live terminals before rendering or attaching.

### 4. Replay model

- Replay will use retained raw PTY output, not a screenshot or serialized xterm state.
- The terminal manager will keep a bounded in-memory replay buffer per live terminal.
- On attach, the server will replay the retained output stream to the new socket before switching that socket to live mode.
- Replaying the raw stream is the canonical mechanism for restoring:
  - current terminal screen
  - ANSI styling
  - retained scrollback within the configured buffer limit

### 5. Buffer limit and scrollback

- Replay history must be bounded to avoid unbounded memory growth.
- Add `COMPANION_TERMINAL_REPLAY_MAX_BYTES` with a default of `8388608` bytes.
- Configure xterm `scrollback` explicitly so restore behavior is predictable. Recommended initial value: `5000`.
- If output exceeds the replay buffer, the oldest retained output may be dropped. This is acceptable for this version as long as current screen state and recent scrollback replay correctly within the configured retention window.

### 6. Orphan cleanup policy

- A terminal must not be killed just because the browser socket disconnected during reload or route transition.
- Replace the current 5-second orphan timeout with a longer, configurable TTL.
- Add `COMPANION_TERMINAL_ORPHAN_TTL_MS` with a default of `1800000` ms.
- Explicit terminal close must still kill immediately.
- Session delete and session archive must kill all terminals owned by that session.
- Session kill should not automatically kill terminals in this implementation. Killing the CLI and using the workspace shell are distinct actions.

### 7. Error handling

- Stale attach attempts must fail clearly rather than silently no-op.
- If a terminal WebSocket is opened for a missing terminal, the server must send an error control message and close the socket.
- The client must treat this as a stale terminal and fall back to spawning a new one.

### 8. Backward compatibility

- Existing ephemeral quick-terminal state is low-value and can be discarded.
- No migration is required from the current global in-memory quick-terminal model.
- The first release of this feature may initialize the new per-session terminal persistence state from scratch.

## Target User Journeys

### Session Switch Journey

1. User opens a terminal in session A.
2. User runs commands in that shell.
3. User switches to session B.
4. User returns to session A.
5. The same terminal tab is still present.
6. The same shell process is attached.
7. Prior output and scrollback are visible.

### Route Change Journey

1. User opens a terminal in a session.
2. User switches between `chat`, `diff`, `editor`, and `processes`.
3. User returns to the terminal view.
4. The same shell process is still active.
5. Prior output is still present.

### Reload Journey

1. User opens a terminal in a session.
2. User runs several commands, including enough output to create scrollback.
3. User reloads the page.
4. The app restores session-scoped terminal tabs from `sessionStorage`.
5. The app reconciles those tabs against the server's live terminals for that session.
6. The terminal reattaches to the existing PTY.
7. The retained output is replayed into xterm.
8. New output resumes after replay without creating a new shell.

### Explicit Close Journey

1. User closes a terminal tab.
2. The frontend removes the tab from the store and `sessionStorage`.
3. The frontend calls the kill API for that `terminalId`.
4. The backend kills the PTY immediately.
5. Reopening that tab creates a new terminal with a new shell process.

### Stale Restore Journey

1. A tab is persisted in `sessionStorage`.
2. Its backend terminal has already been expired or killed.
3. User reloads the page.
4. The app attempts reconciliation.
5. No live terminal is found for the stored `tabId` or `terminalId`.
6. The UI spawns a replacement terminal and updates stored state.
7. The user sees a working terminal instead of a broken blank panel.

## Design Overview

## Frontend State Model

Replace the global quick-terminal model with a session-scoped model.

Recommended shape in `web/src/store.ts`:

```ts
interface PersistedTerminalTab {
  tabId: string;
  label: string;
  cwd: string;
  containerId?: string;
  terminalId: string | null;
}

interface SessionQuickTerminalState {
  open: boolean;
  activeTabId: string | null;
  tabs: PersistedTerminalTab[];
  nextHostIndex: number;
  nextDockerIndex: number;
}
```

Recommended store shape:

```ts
quickTerminalsBySession: Map<string, SessionQuickTerminalState>
```

Recommended storage key:

- `moku_terminal_session_v1`

Rules:

- Persist only serializable terminal-tab metadata.
- Scope tabs by `sessionId`.
- The store remains the source of truth for visible UI state.
- `sessionStorage` is the persistence layer, not the primary runtime state container.

Required store actions:

- `hydrateQuickTerminalsFromSessionStorage()`
- `setSessionQuickTerminalState(sessionId, state)`
- `openQuickTerminal(sessionId, opts)`
- `setQuickTerminalOpen(sessionId, open)`
- `setActiveQuickTerminalTabId(sessionId, tabId | null)`
- `setQuickTerminalTerminalId(sessionId, tabId, terminalId | null)`
- `closeQuickTerminalTab(sessionId, tabId)`
- `resetQuickTerminal(sessionId?)`
- `reconcileQuickTerminals(sessionId, serverTerminals)`
- `clearSessionQuickTerminals(sessionId)`

## Backend Terminal Model

Extend `TerminalInstance` in `web/server/terminal-manager.ts` to include:

```ts
interface TerminalReplayChunk {
  data: Uint8Array;
  bytes: number;
}

interface TerminalInstance {
  id: string;
  sessionId: string;
  tabId: string;
  cwd: string;
  containerId?: string;
  proc: ReturnType<typeof Bun.spawn>;
  terminal: BunTerminalHandle;
  browserSockets: Set<ServerWebSocket<SocketData>>;
  cols: number;
  rows: number;
  orphanTimer: ReturnType<typeof setTimeout> | null;
  replayChunks: TerminalReplayChunk[];
  replayBytes: number;
  exitCode: number | null;
  exited: boolean;
  createdAt: number;
  updatedAt: number;
}
```

Required manager methods:

- `spawn(sessionId, tabId, cwd, cols, rows, options?)`
- `get(terminalId)`
- `getBySession(sessionId)`
- `getBySessionTab(sessionId, tabId)`
- `kill(terminalId)`
- `killBySession(sessionId)`
- `killBySessionTab(sessionId, tabId)`
- `addBrowserSocket(ws)`
- `removeBrowserSocket(ws)`
- `handleBrowserMessage(ws, msg)`

Recommended metadata returned to the frontend:

```ts
interface TerminalSummary {
  terminalId: string;
  sessionId: string;
  tabId: string;
  cwd: string;
  containerId?: string;
  exited: boolean;
  exitCode: number | null;
  createdAt: number;
  updatedAt: number;
}
```

## Replay Attachment Protocol

The current client already treats binary WebSocket frames as terminal output. Keep that model.

Protocol behavior:

1. Browser opens `ws://.../ws/terminal/:terminalId`.
2. Server validates that the terminal exists.
3. If missing:
   - server sends `{ "type": "error", "message": "Terminal not found", "code": "terminal_not_found" }`
   - server closes the socket
4. If present:
   - server replays retained binary chunks in order
   - server flushes any output produced during replay
   - server then marks the socket as live
5. If the terminal has already exited:
   - replay still occurs
   - server then sends the usual `exit` control message

Implementation requirement:

- Avoid interleaving live output before replay is complete for a newly attached socket.
- Do not lose bytes produced while replay is being sent.

Recommended implementation:

- Introduce a per-socket attach state inside `TerminalManager`.
- While a socket is replaying:
  - buffer new live chunks for that socket only
  - replay retained chunks first
  - flush the per-socket pending chunks
  - then add the socket to the main live set

This is sufficient for the current feature and avoids a broader protocol rewrite.

## API Contract Changes

### 1. `POST /api/terminal/spawn`

Update request contract:

```json
{
  "sessionId": "session-1",
  "tabId": "host-123",
  "cwd": "/repo",
  "cols": 120,
  "rows": 40,
  "containerId": "optional"
}
```

Update response contract:

```json
{
  "terminalId": "term-1",
  "sessionId": "session-1",
  "tabId": "host-123",
  "cwd": "/repo",
  "containerId": "optional"
}
```

Rules:

- `sessionId`, `tabId`, and `cwd` are required.
- `tabId` is the stable frontend terminal-tab identity.
- The server should reject missing required fields with `400`.

### 2. `GET /api/sessions/:id/terminals`

Add a new route returning all live terminals for the session:

```json
{
  "terminals": [
    {
      "terminalId": "term-1",
      "sessionId": "session-1",
      "tabId": "host-123",
      "cwd": "/repo",
      "containerId": null,
      "exited": false,
      "exitCode": null,
      "createdAt": 1770000000000,
      "updatedAt": 1770000005000
    }
  ]
}
```

Rules:

- This is the canonical reconciliation API for terminal restore.
- It must return an empty array when the session has no live terminals.

### 3. `POST /api/terminal/kill`

Keep the route, but ensure it is used only for explicit close and explicit server-side cleanup paths.

### 4. Existing `GET /api/terminal`

- It may remain for debugging or compatibility.
- It must not be used as the restore mechanism for this feature.

## Frontend Restore Flow

The restore flow should be deterministic and session-scoped.

### On app bootstrap

1. Hydrate `quickTerminalsBySession` from `sessionStorage`.
2. Do not auto-spawn terminals during hydration.

### On entering a session view

1. Load the current session's persisted terminal state from the store.
2. Call `GET /api/sessions/:id/terminals`.
3. Reconcile persisted tabs by `tabId`:
   - if a live server terminal exists for that `tabId`, adopt its `terminalId`
   - if not, set `terminalId` to `null`
4. Keep the tab itself unless the user explicitly closed it earlier.
5. Render the terminal dock using the reconciled state.

### On rendering a `TerminalView`

1. If the tab has a `terminalId`, attempt attach first.
2. If attach succeeds, replay restores the prior state.
3. If attach fails with `terminal_not_found`, clear the stale `terminalId`, spawn a replacement, and persist the new `terminalId`.
4. If the tab has no `terminalId`, spawn a new terminal and persist the returned `terminalId`.

### On unmount

1. Disconnect the WebSocket.
2. Do not call the kill API.
3. Leave the stored `terminalId` intact.

### On explicit tab close

1. Remove the tab from the store.
2. Persist the updated session state to `sessionStorage`.
3. If the tab has a `terminalId`, call `POST /api/terminal/kill`.

## Component-Level Changes

### `web/src/components/TerminalView.tsx`

Required changes:

- Accept `sessionId` and `tabId` or a full tab descriptor.
- Support attach-or-spawn behavior.
- Stop calling kill on cleanup.
- Keep explicit close behavior outside the generic unmount cleanup path.
- Set explicit xterm `scrollback`.
- Handle stale attach fallback cleanly.

### `web/src/components/SessionTerminalDock.tsx`

Required changes:

- Read and write session-scoped terminal state using `sessionId`.
- Pass `sessionId`, `tabId`, `cwd`, `containerId`, and `terminalId` into `TerminalView`.
- Ensure empty-state CTA creates a tab in the correct session scope.
- Ensure closing one session's tab does not affect another session.

### `web/src/components/TopBar.tsx`

Required changes:

- Use session-scoped quick-terminal actions.
- Opening the terminal tab from the top bar must reuse or create a terminal inside the current session only.
- Reset behavior when `currentSessionId` becomes `null` must not wipe unrelated persisted terminal session state unnecessarily.

### `web/src/App.tsx`

Required changes:

- Hydrate persisted terminal state during app startup.
- Reconcile terminals when entering a session view.
- Keep current session routing behavior intact.

### `web/src/terminal-ws.ts`

Required changes:

- Surface terminal-not-found errors so `TerminalView` can respawn.
- Continue passing binary frames directly to xterm.
- Continue handling `exit` messages after replay.

## Backend Integration Points

### Session teardown cleanup

Integrate terminal cleanup into existing session teardown flows in `web/server/routes.ts`:

- `DELETE /api/sessions/:id`
  - kill all terminals for the session
- `POST /api/sessions/:id/archive`
  - kill all terminals for the session

Do not kill session terminals on:

- `POST /api/sessions/:id/kill`

Reason:

- this route kills the CLI session process, not the workspace shell
- terminal persistence should remain useful even if the CLI is stopped

### WebSocket behavior

Update `web/server/index.ts` and `web/server/terminal-manager.ts` so terminal attach failure is explicit and replay-enabled.

Required behavior:

- successful attach replays output then continues live
- missing terminal sends a control error then closes
- orphan timer cancellation still happens when a browser reattaches

## Milestones

### M1. Backend Ownership and Replay Foundation

- [ ] Extend `TerminalInstance` with `sessionId`, `tabId`, replay metadata, exit state, and timestamps.
- [ ] Add replay buffer retention logic bounded by `COMPANION_TERMINAL_REPLAY_MAX_BYTES`.
- [ ] Add attach state that replays retained chunks before switching a socket live.
- [ ] Replace the 5-second orphan timer with `COMPANION_TERMINAL_ORPHAN_TTL_MS`.
- [ ] Add manager methods for list-by-session and kill-by-session.
- [ ] Add structured logging for spawn, attach, replay, detach, expire, and kill events.

Exit criteria:

- A terminal can be listed by session.
- A socket that reattaches to an existing terminal receives replayed output before live output.
- Detaching all browsers does not kill the terminal immediately.
- The terminal expires after the configured orphan TTL.

### M2. Backend API and Session Cleanup Integration

- [ ] Update `POST /api/terminal/spawn` to require `sessionId` and `tabId`.
- [ ] Add `GET /api/sessions/:id/terminals`.
- [ ] Integrate `killBySession(id)` into session delete and archive flows.
- [ ] Keep explicit `POST /api/terminal/kill`.
- [ ] Return clear `400` errors for missing spawn fields.

Exit criteria:

- The frontend can query all live terminals for a session.
- Session delete and archive clean up their terminals.
- Session kill does not kill terminals.

### M3. Frontend Store Refactor and Persistence

- [ ] Replace global quick-terminal state with `quickTerminalsBySession`.
- [ ] Persist session-scoped terminal state to `sessionStorage`.
- [ ] Add hydration on app startup.
- [ ] Add reconciliation action that merges persisted tabs with live backend terminals by `tabId`.
- [ ] Remove or isolate stale standalone-terminal state if it conflicts with the new quick-terminal model.

Exit criteria:

- Session A and session B can each keep independent terminal tabs.
- Reload restores terminal tabs from `sessionStorage`.
- Reconciliation updates stale `terminalId` values without creating duplicate tabs.

### M4. Attach-or-Spawn Frontend Flow

- [ ] Update `TerminalView` to attempt attach first when `terminalId` exists.
- [ ] Update `TerminalView` to spawn only when needed.
- [ ] Remove kill-on-unmount behavior.
- [ ] Keep explicit close behavior on tab close.
- [ ] Add xterm `scrollback` configuration.
- [ ] Surface and handle `terminal_not_found` fallback.

Exit criteria:

- Reloading a page with a live terminal reuses the same shell process.
- Unmounting a terminal view does not kill the terminal.
- Closing a terminal tab still kills the backend PTY.

### M5. App Integration and UX Validation

- [ ] Update `SessionTerminalDock` and `TopBar` to use session-scoped terminal actions.
- [ ] Reconcile terminals when entering a session route.
- [ ] Ensure host and container-backed terminals both use the same persistence flow.
- [ ] Ensure returning from `chat`, `diff`, `editor`, `processes`, and non-session routes works as expected.

Exit criteria:

- Terminal persistence works across all main app navigation paths.
- Container terminals restore the same way as host terminals.

### M6. Tests and Final Verification

- [ ] Add backend unit tests for replay buffer retention and session terminal listing.
- [ ] Add backend route tests for `GET /api/sessions/:id/terminals`, updated spawn contract, and session cleanup behavior.
- [ ] Add frontend store tests for session-scoped persistence and reconciliation.
- [ ] Add `TerminalView.test.tsx` with:
  - render coverage
  - axe accessibility scan
  - attach-vs-spawn behavior
  - stale-attach fallback behavior
- [ ] Update `SessionTerminalDock.test.tsx` for session-scoped behavior.
- [ ] Update `TopBar.test.tsx` for session-scoped terminal open behavior.
- [ ] Run typecheck and tests.

Exit criteria:

- Modified frontend components meet the repository testing requirements.
- All new backend behavior is covered by automated tests.
- `cd web && bun run typecheck` passes.
- `cd web && bun run test` passes, or any unrelated pre-existing failures are explicitly documented before merge.

## Test Plan

## Backend Tests

Add a new test file for `web/server/terminal-manager.ts`.

Required cases:

- stores replay chunks and trims oldest output when max bytes is exceeded
- lists terminals by session
- kills all terminals for a session
- leaves session B terminals untouched when killing session A terminals
- reattaching to a live terminal replays buffered output before live output
- missing terminal attach emits an explicit error path
- orphan TTL cleanup kills detached terminals after the configured delay
- explicit kill bypasses the orphan timer

Update `web/server/routes/system-routes.test.ts`.

Required cases:

- `POST /api/terminal/spawn` requires `sessionId`, `tabId`, and `cwd`
- `GET /api/sessions/:id/terminals` returns session-scoped terminal metadata
- `DELETE /api/sessions/:id` kills session terminals
- `POST /api/sessions/:id/archive` kills session terminals
- `POST /api/sessions/:id/kill` does not kill session terminals

## Frontend Tests

Update `web/src/store.test.ts`.

Required cases:

- persists `quickTerminalsBySession` to `sessionStorage`
- hydrates `quickTerminalsBySession` from `sessionStorage`
- stores terminal tabs per session instead of globally
- reconciles persisted tabs against server terminal summaries by `tabId`
- closing a tab removes only that session's tab

Add `web/src/components/TerminalView.test.tsx`.

Required cases:

- renders without accessibility violations
- attaches when `terminalId` exists
- spawns when `terminalId` is absent
- respawns when attach fails with `terminal_not_found`
- disconnects on unmount without calling kill
- calls kill only on explicit close path if that logic lives through the component boundary

Update `web/src/components/SessionTerminalDock.test.tsx`.

Required cases:

- reads terminal tabs from the current `sessionId`
- closing a tab affects only that session's state
- opening a terminal from the dock creates a tab in the correct session scope

Update `web/src/components/TopBar.test.tsx`.

Required cases:

- terminal nav action opens or reuses a terminal in the current session only
- switching `currentSessionId` does not leak terminal tabs across sessions

## Verification Checklist

- [ ] `cd /home/tiger/companion/web && bun run typecheck`
- [ ] `cd /home/tiger/companion/web && bun run test`
- [ ] Manual verify host terminal:
  - open a terminal
  - run `echo $$`
  - run enough output to create scrollback
  - reload the page
  - confirm prior output is restored
  - confirm `echo $$` still reports the same shell PID
- [ ] Manual verify container terminal with the same steps above
- [ ] Manual verify session switching:
  - open a terminal in session A
  - open a different terminal in session B
  - confirm each session restores only its own tabs
- [ ] Manual verify explicit close:
  - close a terminal tab
  - reopen a new terminal
  - confirm the new shell PID differs
- [ ] Manual verify stale restore:
  - kill or expire a terminal server-side
  - reload the page
  - confirm the UI recreates the terminal instead of leaving a broken tab
- [ ] Manual verify orphan TTL:
  - detach a terminal
  - wait past `COMPANION_TERMINAL_ORPHAN_TTL_MS`
  - confirm the terminal is cleaned up

## Definition of Done

The feature is complete only when every item below is true:

- [ ] Quick terminal state is stored per session, not globally.
- [ ] Terminal tabs persist in `sessionStorage` for the lifetime of the browser session.
- [ ] `TerminalView` no longer kills terminals on generic unmount.
- [ ] Reattaching to a live terminal reuses the same shell process.
- [ ] Reattaching redraws the retained screen and scrollback using replayed PTY output.
- [ ] Explicit tab close kills the PTY immediately.
- [ ] Session delete and archive kill all terminals for that session.
- [ ] Session kill does not kill terminals.
- [ ] Missing or stale terminals are recovered by respawning and updating stored `terminalId`.
- [ ] Host terminals and container-backed terminals follow the same persistence and restore flow.
- [ ] Backend tests cover replay, listing, cleanup, and spawn contract changes.
- [ ] Frontend tests cover persistence hydration, session scoping, and attach-or-spawn behavior.
- [ ] `cd /home/tiger/companion/web && bun run typecheck` passes.
- [ ] `cd /home/tiger/companion/web && bun run test` passes, or unrelated pre-existing failures are documented with evidence.

## Implementation Notes for the Agent

- Prefer implementing backend replay first, then API reconciliation, then frontend persistence, then `TerminalView` attach-or-spawn.
- Do not rely on the existing `terminalId` field in the root store as the long-term model. It is single-instance state and not sufficient for multi-tab persistence.
- Be careful not to reintroduce global terminal state in `TopBar`, `SessionTerminalDock`, or helper selectors.
- When modifying frontend components, keep or add tests per repository policy. `TerminalView` currently lacks a test file and will need one.
- The stale standalone terminal page and single-terminal store fields should be evaluated during implementation. If they remain unused, either isolate them from the quick-terminal flow or remove them only if doing so is clearly safe.
- Keep terminal replay server-side and in memory for this version. Do not expand scope into server restart durability.

## Follow-Ups After This Plan

These are intentionally deferred and not part of the implementation described above:

- persistence across Companion restart
- replay durability across server restart
- multiplexer-backed terminal sessions
- cross-window terminal coordination
- richer terminal restore UX such as "restoring terminal..." progress affordances
