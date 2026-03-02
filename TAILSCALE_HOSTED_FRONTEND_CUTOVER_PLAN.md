# Tailscale Hosted Frontend Cutover Plan

Status: Locked

## Summary

This document defines the complete cutover from the current same-origin deployment model to a production model where:

1. The frontend is deployed as a static site.
2. The backend runs on a user-owned machine inside a Tailscale tailnet.
3. The frontend stores a backend `serverUrl` and auth token locally.
4. The supported production journey is "hosted frontend -> Tailscale backend".

This is a clean-cutover plan, not a prototype plan. It intentionally removes or retires legacy same-origin behavior that does not fit the target product.

This document is intended to be self-sufficient for a fresh Codex handoff. Another Codex should be able to execute the work using this document plus repository inspection, without relying on prior chat history.

## Current State Snapshot

The following current-state facts are important context for implementation:

- Frontend REST calls currently assume same-origin `/api` in `web/src/api.ts`.
- Frontend browser WebSocket URLs currently derive from `location.host` in `web/src/ws.ts`.
- Frontend terminal WebSocket URLs currently derive from `window.location.host` in `web/src/terminal-ws.ts`.
- Agent webhook URLs currently derive from `window.location.origin` in `web/src/components/AgentsPage.tsx`.
- The current login flow is token-only and still includes localhost auto-auth behavior in `web/src/components/LoginPage.tsx`.
- The current backend auth/routes layer still includes localhost auto-auth, backend-generated QR behavior, and dynamic-manifest-related cookie behavior in `web/server/routes.ts` and `web/server/index.ts`.
- The current PWA setup consists of:
  - static manifest in `web/public/manifest.json`
  - frontend service worker registration in `web/src/sw-register.ts`
  - Vite PWA plugin config in `web/vite.config.ts`
  - backend dynamic manifest override in `web/server/index.ts`
- The in-app editor that matters for this cutover is `web/src/components/SessionEditorPane.tsx`.
- The external `code-server` route in `web/server/routes.ts` appears to be dead code and is not part of the supported product after cutover.
- The fork already hides some local-only features. This cutover should formalize that instead of leaving hidden-but-supported ambiguity.

## Goals

- Support one clear production topology: hosted static frontend plus Tailscale-only backend.
- Keep the entire chat/session/permissions/editor/terminal flow working against a remote backend.
- Provide a complete onboarding flow with manual entry and QR bootstrap.
- Remove browser-visible `localhost` and same-origin assumptions from production behavior.
- Keep local development workable without reintroducing same-origin production coupling.
- End with a product that is internally coherent, documented, and testable.

## Non-Goals

- Supporting public-internet backend access outside Tailscale.
- Supporting arbitrary reverse proxies as a first-class product path.
- Supporting both old same-origin production hosting and the new hosted-frontend topology indefinitely.
- Reviving the unused external `code-server` editor path.
- Expanding to multi-server or multi-profile management in this cutover.

## Product Decisions

These decisions should be treated as the default target unless explicitly changed.

### 1. Supported production topology

- The frontend is hosted at `https://moku.sh`.
- The backend is exposed only inside the user's tailnet.
- The browser talks directly to the backend over the backend's Tailscale HTTPS origin, not through the frontend host.
- The backend is published via managed `tailscale serve`.
- Moku owns the node's Tailscale Serve root HTTPS endpoint for this workflow.
- The backend should be reachable at a stable Tailscale URL such as `https://backend-name.tailnet-name.ts.net`.

### 2. Transport requirement

- Production backend access must use `https://` and `wss://`.
- Plain `http://` and `ws://` are acceptable only for local development.
- The only supported production setup is Tailscale HTTPS via managed `tailscale serve`.

### 3. Connection model

- The frontend stores a single active backend connection.
- The stored connection contains at minimum:
  - `serverUrl`
  - `authToken`
  - `version`
- The frontend does not assume same-origin API or WebSocket access anywhere in production mode.
- The frontend supports disconnecting and forgetting the saved server.
- Multi-server profile management is out of scope for this cutover.

### 4. Onboarding model

- Manual entry is supported.
- QR bootstrap is supported.
- The QR opens the hosted frontend, not the backend.
- The QR payload must carry both backend URL and token.

### 5. URL bootstrap format

- Bootstrap data should live in the URL fragment, not the query string.
- Recommended format:
  - `https://moku.sh/#/connect?server=https%3A%2F%2Fbackend-name.tailnet-name.ts.net&token=...`
- Reason:
  - Fragment data is not sent to the static host in HTTP requests.
  - This reduces token leakage to CDN and static-host logs.

### 6. PWA/install behavior

- The current dynamic manifest token-bridging flow is not compatible with the split deployment.
- The hosted frontend at `moku.sh` remains installable as a PWA on desktop.
- The PWA uses a static manifest and a frontend-only service worker.
- Dynamic manifest generation and token-bridging behavior are removed.
- The installed app uses the same saved `serverUrl` and token model as the regular browser app.
- The product should still work as a normal browser app on desktop and mobile.

### 7. Legacy local-only behavior

- `localhost`-based browser links are not allowed in hosted mode.
- Features that fundamentally depend on browser-local loopback must either:
  - be remoteized to the backend's Tailscale origin, or
  - be removed/hidden in hosted mode.

### 8. Dead code

- The unused external `code-server` editor path should be removed during the cutover unless we discover active usage.

## Target User Journeys

## Backend Operator Journey

1. The user runs the backend on a Tailscale machine.
2. The backend determines its public backend origin through managed `tailscale serve`.
3. The backend prints:
   - backend URL
   - auth token
   - hosted frontend connect URL
   - terminal QR code for that connect URL
4. The backend reconciles the node's `tailscale serve` configuration to publish Moku at the root HTTPS endpoint.
5. The backend accepts requests only from configured web origins and only with valid auth.

## Desktop User Journey

1. User opens the hosted frontend.
2. The app shows a Connect page, not the legacy token-only login page.
3. User enters:
   - backend URL
   - auth token
4. The frontend verifies connectivity and token validity.
5. The frontend stores the connection locally and loads the app.
6. All subsequent REST and WebSocket traffic goes to the configured backend origin.

## Mobile User Journey

1. User scans the backend's printed QR code with the device camera.
2. The device opens the hosted frontend connect URL.
3. The frontend reads the fragment payload.
4. The frontend verifies and stores the connection.
5. The frontend strips the token from the URL fragment after success.
6. The user lands in the authenticated app.

## Reconnect and Rotation Journey

1. If a token becomes invalid, the app returns to the Connect page.
2. The previously stored `serverUrl` remains prefilled unless the user explicitly disconnects.
3. If the backend token is regenerated, the user can reconnect with the new token.
4. If the backend origin changes, the user can edit the saved `serverUrl` in Settings.

## Architecture

## Frontend Runtime Model

Introduce a dedicated runtime connection model rather than scattering logic across `api.ts`, `ws.ts`, and component code.

Recommended storage shape:

```json
{
  "version": 1,
  "serverUrl": "https://backend-name.tailnet-name.ts.net",
  "authToken": "..."
}
```

Recommended storage key:

- `moku_connection`

Recommended behavior:

- Canonicalize `serverUrl` on save:
  - trim whitespace
  - remove trailing slash
  - preserve explicit port if present
- Derive API base as `${serverUrl}/api`
- Derive browser WS base from `serverUrl`
- Derive terminal WS base from `serverUrl`
- Treat the connection object as the single source of truth for browser-to-backend transport

## Backend Runtime Model

The backend should distinguish:

- local bind address used by Bun
- externally reachable backend origin used by browsers
- hosted frontend origin used for CORS, QR links, and onboarding

Recommended configuration model:

- `MOKU_FRONTEND_URL`
  - defaults to `https://moku.sh`
- managed Tailscale Serve publishing
  - on startup, Moku verifies Tailscale availability
  - Moku configures `tailscale serve` to publish `http://127.0.0.1:3456`
  - Moku reads the node's Tailscale DNS name and derives the canonical backend URL
  - if setup or discovery fails, Moku continues serving locally but clearly reports that hosted mode is unavailable until Tailscale Serve is working

Implication:

- this workflow assumes Moku owns the node's root Tailscale Serve HTTPS endpoint
- coexisting with other root-level Serve apps on the same node is out of scope

## Frontend Routing and Bootstrap

The app currently uses hash routing. Extend it with an explicit connect route.

Recommended route additions:

- `#/connect`

Recommended bootstrap behavior:

- parse `server` and `token` from the hash-route query portion
- verify them before storing
- strip them immediately after successful verification
- never leave the token in the visible URL after login completes

## Backend-to-Frontend Feature Contract

Introduce a small public info endpoint for compatibility and UX.

Recommended endpoint:

- `GET /api/public/info`

Recommended response fields:

- app/backend name
- backend version
- supported auth mode
- supported deployment mode
- canonical backend URL
- feature flags/capabilities for UI gating

This endpoint is useful for:

- validating that a user-entered server is actually a Moku backend
- future compatibility warnings
- gating features cleanly rather than by frontend guesswork

## Required Code Changes

## Frontend Transport Refactor

Current blockers:

- `web/src/api.ts` uses relative `/api`
- `web/src/ws.ts` builds browser WebSocket URLs from `location.host`
- `web/src/terminal-ws.ts` builds terminal WebSocket URLs from `window.location.host`
- `web/src/components/AgentsPage.tsx` builds webhook URLs from `window.location.origin`

Required change:

- centralize all browser-visible backend URL construction in one connection utility

Recommended new modules:

- `web/src/connection.ts`
  - load/save connection
  - canonicalize URL
  - derive API base
  - derive WS base
  - clear connection
- optional `web/src/connection.test.ts`

Refactor targets:

- `web/src/api.ts`
- `web/src/ws.ts`
- `web/src/terminal-ws.ts`
- `web/src/components/AgentsPage.tsx`

## Auth and Connect UI

The existing `LoginPage` is token-only and still tries localhost auto-auth.

Required change:

- replace the token-only login page with a full Connect page

Connect page requirements:

- field for backend URL
- field for token
- connect button
- loading/error states
- bootstrap from fragment payload
- preserve backend URL on auth failure
- clear both values on explicit disconnect

Settings requirements:

- show current backend URL
- allow editing/replacing backend URL
- allow disconnect
- show token management controls when authenticated
- generate a QR code client-side for "connect another device"
- copy a full hosted frontend bootstrap link

Files likely affected:

- `web/src/components/LoginPage.tsx`
- `web/src/components/LoginPage.test.tsx`
- `web/src/components/SettingsPage.tsx`
- `web/src/components/SettingsPage.test.tsx`
- `web/src/App.tsx`
- `web/src/store.ts`
- `web/src/utils/routing.ts`

## Backend Auth and Public Endpoints

Current backend behavior includes:

- localhost auto-auth
- backend-generated QR codes that point to the backend origin
- cookie side effects used for dynamic manifest/PWA bridging

Required change:

- remove same-origin/PWA-specific auth assumptions from the production path

Recommended endpoint set after cutover:

- `POST /api/auth/verify`
  - verify token only
  - no cookie side effects required
- `GET /api/auth/token`
  - protected
- `POST /api/auth/regenerate`
  - protected
- `GET /api/public/info`
  - unauthenticated

Recommended removals:

- `GET /api/auth/auto`
- `GET /api/auth/qr`

Files likely affected:

- `web/server/routes.ts`
- `web/server/index.ts`
- `web/server/auth-manager.ts`
- relevant tests in `web/server/routes.test.ts`

## CORS and WebSocket Origin Policy

Current CORS behavior is broad and implicit. That is not enough for a complete cutover.

Required behavior:

- explicitly allow the hosted frontend origin
- allow `Authorization` and `Content-Type`
- reject unknown browser origins for WebSocket upgrades

Recommended configuration:

- `MOKU_ALLOWED_WEB_ORIGINS`
  - comma-separated origin allowlist
  - defaults to `MOKU_FRONTEND_URL` if unset

Backend enforcement points:

- HTTP CORS middleware in `web/server/index.ts`
- browser WebSocket upgrade handling in `web/server/index.ts`

## Startup Output and Terminal QR

The backend should provide a first-class onboarding output when it starts.

Required startup output:

- backend URL
- hosted frontend URL (`https://moku.sh`)
- auth token
- connect URL
- terminal QR

Implementation notes:

- the repo already depends on `qrcode`
- terminal rendering is supported by that package
- use a small terminal QR mode for readability
- Moku should verify and reconcile `tailscale serve` before printing the final connect block

Recommended startup output example:

```text
Frontend:    https://moku.sh
Backend:     https://backend-name.tailnet-name.ts.net
Auth token:  ...
Connect URL: https://moku.sh/#/connect?server=...&token=...

[terminal QR here]
```

Files likely affected:

- `web/server/index.ts`

## Feature Cleanup and Gating

## Remote-Safe Features That Should Work After Cutover

- session list
- session create/relaunch/archive/delete
- chat
- streaming
- tool visibility
- permission banners
- session tasks
- terminal
- in-app editor (`SessionEditorPane`)
- diff views
- environments
- agents
- token management

## Features Requiring Explicit Remote Handling

- agent webhook URLs
  - must use backend origin, not frontend origin
- any browser-visible deep links to backend-hosted tools
  - must use backend Tailscale origin
- any browser-visible `localhost` links
  - must be remoteized or hidden

## Features To Remove or Keep Unsupported

- external `code-server` editor route
- localhost auto-auth
- backend-generated QR endpoint
- dynamic manifest token bridge
- any UI still exposing loopback-only links

Because this repo already hides some local-only features in the fork, the cutover should codify that rather than leave partially reachable dead paths behind.

## Static Hosting and PWA

## Static Hosting

The frontend can already be served statically because it uses hash routing.

No production app-page rewrites are required for:

- `#/session/:id`
- `#/settings`
- `#/agents`
- `#/connect`

## PWA

The current setup assumes the backend serves `/manifest.json` dynamically so it can inject `?token=` into `start_url`.

That approach should be removed for the cutover.

Recommended cutover behavior:

- keep a static manifest for installability
- keep the service worker for frontend asset caching only
- remove dynamic manifest generation from the backend
- remove auth cookies that only exist to support the dynamic manifest path
- do not cache backend API or WebSocket traffic in the service worker

## Local Development

The cutover should not break day-to-day development.

Recommended development behavior:

- keep the Vite proxy for local development
- allow a dev-only default backend origin when no stored connection exists
- keep `http://localhost` workflows only in dev
- do not let dev fallback leak into production logic

This means:

- development can remain convenient
- production code remains explicitly connection-based

## Implementation Plan

## Phase 1: Finalize Runtime Connection Model

1. Add a dedicated frontend connection module.
2. Move token storage out of "token-only auth state" and into a full connection object.
3. Add helpers to derive:
   - API base URL
   - browser WebSocket URL
   - terminal WebSocket URL
4. Add tests for canonicalization and URL derivation.

Deliverable:

- no browser transport code depends directly on `window.location.origin` or `location.host` for backend calls

## Phase 2: Replace Login With Connect Flow

1. Add `#/connect` route support.
2. Replace `LoginPage` with a Connect page.
3. Support manual server URL plus token entry.
4. Support bootstrap from fragment payload.
5. Strip sensitive fragment params after success.
6. Add logout/disconnect behavior that clears the stored connection.

Deliverable:

- first-time setup works without same-origin assumptions

## Phase 3: Refactor All Browser Transport

1. Update `web/src/api.ts` to use the derived API base.
2. Update `web/src/ws.ts` to use the configured backend WS origin.
3. Update `web/src/terminal-ws.ts` to use the configured backend WS origin.
4. Update any browser-visible backend URLs such as agent webhook URLs.
5. Update tests that currently assert relative `/api` and same-origin `ws://localhost`.

Deliverable:

- no production browser path relies on same-origin `/api` or `/ws`

## Phase 4: Harden Backend for Hosted Frontend Access

1. Add explicit frontend-origin config with `https://moku.sh` as the default.
2. Restrict CORS to allowed web origins.
3. Enforce WebSocket origin allowlists.
4. Add `GET /api/public/info`.
5. Simplify `POST /api/auth/verify` to token verification only.
6. Remove localhost auto-auth from the production path.

Deliverable:

- hosted frontend can authenticate and connect cleanly to the backend

## Phase 5: Add Operator Onboarding Output

1. Verify Tailscale availability and login state.
2. Reconcile `tailscale serve` so Moku owns the node's root HTTPS endpoint.
3. Determine the canonical public backend URL from Tailscale state.
4. Build the connect link against `https://moku.sh`.
5. Print manual instructions.
6. Print terminal QR.
7. Add a client-side QR generator to Settings for connecting additional devices.

Deliverable:

- backend startup provides a self-contained onboarding path

## Phase 6: Remove Legacy Same-Origin and Dead Paths

1. Remove backend-generated QR endpoint.
2. Remove dynamic manifest/token-bridge logic.
3. Remove `code-server` route and related tests if confirmed unused.
4. Remove or gate any remaining browser-visible `localhost` links.
5. Update README and deployment docs.

Deliverable:

- the shipped product reflects the new architecture rather than carrying conflicting legacy behavior

## Phase 7: Validation and Rollout

1. Run frontend unit tests.
2. Run backend unit tests.
3. Add or update tests for:
   - connection storage
   - connect flow
   - URL bootstrap stripping
   - remote API base generation
   - remote WebSocket URL generation
   - webhook URL generation
   - backend public info endpoint
   - CORS allowlist behavior
   - WebSocket origin checks
4. Perform manual end-to-end tests on:
   - desktop browser with manual connect
   - mobile browser via QR
   - token regeneration
   - reconnect after backend restart
   - terminal
   - in-app editor
   - agents and webhook copy flow
5. Deploy the static frontend.
6. Cut over backend startup instructions and docs.

Deliverable:

- release-ready hosted-frontend product

## Acceptance Criteria

The cutover is complete only when all of the following are true:

- A first-time user can connect from the hosted frontend using only backend URL and token.
- A mobile user can scan a printed QR and land in the authenticated app.
- No production browser request goes to the frontend origin for `/api` or `/ws`.
- No browser-visible production links point to `localhost`.
- Terminal works against the configured remote backend.
- The in-app editor works against the configured remote backend.
- Agent webhook URLs copy the backend origin, not the frontend origin.
- CORS and WebSocket origin rules are explicit and tested.
- Dynamic manifest/cookie/PWA token bridging is removed.
- `moku.sh` remains installable as a desktop PWA with a static manifest and frontend-only service worker.
- The backend prints a clear, complete operator onboarding block on startup.
- The backend automatically publishes itself through managed `tailscale serve`.
- The README and deployment docs describe only the supported production topology.

## Definition of Done

Another Codex or human reviewer should be able to declare this work done only if every item below is true.

### Code and Architecture

- All production browser transport code derives backend origins from the saved connection model rather than page origin.
- The Connect flow replaces the legacy token-only login flow for hosted deployment behavior.
- The frontend stores exactly one active backend connection and supports forget/disconnect.
- The backend exposes a public info endpoint that is sufficient for frontend verification and capability detection.
- The backend reconciles managed `tailscale serve` on startup and derives a canonical HTTPS backend URL.
- The backend no longer depends on the old dynamic manifest/auth-cookie bridge.
- The old external `code-server` route is removed.

### Removed or Replaced Behavior

- `GET /api/auth/auto` is removed from the supported production path.
- `GET /api/auth/qr` is removed.
- Dynamic manifest token bridging is removed.
- Browser-visible hosted-mode links no longer use `localhost`.
- Agent webhook URLs use the backend origin, not the frontend origin.

### Tests and Verification

- `cd web && bun run typecheck` passes.
- `cd web && bun run test` passes.
- New or updated tests cover the connection model, Connect flow, remote transport URL generation, and backend origin enforcement.
- README and deployment docs are updated to match the locked decisions in this plan.

### Manual Product Validation

- Manual desktop setup through `https://moku.sh` works with backend URL plus token.
- Manual mobile QR setup through `https://moku.sh` works and strips the token from the fragment after bootstrap.
- Desktop PWA installation from `https://moku.sh` works and the installed app can reconnect using the saved connection model.
- Terminal, in-app editor, and agent webhook copy flow all work against the configured remote backend.

## Verifier Runbook

The following runbook is intended for a fresh Codex or reviewer validating the finished implementation.

### Automated Checks

From repo root:

```bash
cd web && bun run typecheck
cd web && bun run test
```

### Static Audit Checks

The following checks should be reviewed after implementation. They are meant to catch regressions in runtime code, not tests or docs.

Frontend transport audit:

```bash
rg -n 'window.location.origin|window.location.host|location.host|BASE = "/api"' \
  web/src/api.ts web/src/ws.ts web/src/terminal-ws.ts web/src/components/AgentsPage.tsx
```

Expected result:

- no same-origin backend URL construction remains in those runtime files

Backend legacy-auth and manifest audit:

```bash
rg -n '/auth/auto|/auth/qr|companion_auth|manifest.start_url|code-server' \
  web/server/index.ts web/server/routes.ts
```

Expected result:

- no runtime support remains for localhost auto-auth
- no backend-generated QR endpoint remains
- no dynamic manifest auth-cookie bridge remains
- no external `code-server` route remains

Hosted-mode localhost audit:

```bash
rg -n 'localhost:' web/src web/server
```

Expected review outcome:

- any remaining `localhost` references are limited to development-only, server-internal, or test-safe contexts
- no browser-visible hosted-mode links rely on `localhost`

### Manual Verification Checklist

1. Start the backend on a Tailscale machine with Tailscale running and logged in.
2. Confirm startup output includes:
   - canonical backend URL
   - auth token
   - `https://moku.sh` connect URL
   - terminal QR
3. Confirm the backend is reachable over `https://<node>.<tailnet>.ts.net`.
4. Open `https://moku.sh` in a desktop browser with no saved connection state.
5. Confirm the app lands on Connect rather than entering the authenticated app immediately.
6. Enter backend URL plus token and confirm successful connection.
7. Reload the page and confirm the saved connection is reused.
8. Use forget/disconnect and confirm the app returns to Connect.
9. Open the QR bootstrap URL on a mobile browser and confirm:
   - connect succeeds
   - token is removed from the fragment after success
10. Install the desktop PWA from `https://moku.sh` and confirm it launches successfully.
11. In the installed PWA, confirm the saved connection still works.
12. Create or open a session and verify:
   - chat works
   - WebSocket streaming works
   - terminal works
   - in-app editor works
   - agent webhook copy uses the backend origin
13. Regenerate the token and confirm the old token is rejected and reconnect works with the new token.

## File-Level Work List

Likely frontend files:

- `web/src/api.ts`
- `web/src/ws.ts`
- `web/src/terminal-ws.ts`
- `web/src/store.ts`
- `web/src/App.tsx`
- `web/src/utils/routing.ts`
- `web/src/components/LoginPage.tsx`
- `web/src/components/SettingsPage.tsx`
- `web/src/components/AgentsPage.tsx`
- relevant frontend tests

Likely backend files:

- `web/server/index.ts`
- `web/server/routes.ts`
- `web/server/auth-manager.ts`
- possibly a new public-info helper/module
- relevant backend tests

Likely documentation files:

- `README.md`
- deployment/setup docs if added during the cutover

## Migration Notes

Recommended storage migration:

1. Attempt to read the new `moku_connection` object.
2. If missing, read the legacy token key.
3. If only a legacy token exists:
   - in development, allow a same-origin fallback for convenience
   - in production, route the user to Connect and require a server URL
4. Once the new connection is saved successfully, stop reading the legacy token key.

Recommended deployment migration:

1. Ship backend support for explicit frontend/backend origins.
2. Ship managed `tailscale serve` setup and backend URL discovery.
3. Ship frontend connect flow and remote transport support.
4. Deploy hosted frontend at `moku.sh`.
5. Switch onboarding and docs to the hosted frontend URL.
6. Remove legacy same-origin production behavior.

## Risks

- Token leakage if bootstrap links use query strings instead of fragments.
- Partial refactors if any browser transport path still reads `window.location.origin`.
- Broken mobile onboarding if the URL is not stripped after bootstrap.
- Security gaps if CORS is updated but WebSocket origin checks are not.
- Product confusion if legacy same-origin/PWA UI remains visible after cutover.
- Hidden fork-only behavior differences if local-only features are still partially reachable.

## Locked Decisions

The following decisions are locked for implementation:

1. The canonical hosted frontend URL is `https://moku.sh`.
2. Production backend publishing is supported only through managed `tailscale serve`.
3. Moku owns the node's root Tailscale Serve HTTPS endpoint for this workflow.
4. Tailscale backend URL discovery is part of the supported "just works" path.
5. `moku.sh` remains installable as a desktop PWA.
6. The dynamic manifest/token-bridge flow is removed.
7. The frontend supports one saved backend connection plus forget/disconnect.
8. Multi-server profile management is out of scope for this cutover.

## Non-Negotiable Guardrails

These guardrails are part of the plan and should be treated as hard constraints during implementation and review:

1. Do not reintroduce same-origin production assumptions for browser-to-backend traffic.
2. Do not use URL query parameters for token bootstrap in the hosted deployment. Use the URL fragment only.
3. Do not leave tokens in the visible URL after bootstrap succeeds.
4. Do not keep browser-visible `localhost` links in hosted mode.
5. Do not keep localhost auto-auth in the supported production path.
6. Do not keep backend-generated QR login URLs that point directly to the backend origin.
7. Do not keep dynamic manifest token-bridging or auth-cookie behavior that exists only for the old same-origin PWA workaround.
8. Do not keep the external `code-server` route or rebuild product behavior around it.
9. Do not broaden the scope to multi-server profile management in this cutover.
10. Do not support non-Tailscale production publishing paths in this cutover.

## Future Considerations

- Whether to support coexistence with other Serve apps on the same node.
- Whether to support multiple saved backend profiles.
- Whether to redesign mobile-installed PWA edge cases beyond the standard saved-connection model.
