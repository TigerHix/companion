# Upstream Merge Guide

This repo ("moku") is a private fork of [The Companion](https://github.com/StanGirard/companion) (upstream). This guide tells agents how to pull, evaluate, and merge upstream commits.

## Setup

```bash
# Add upstream remote (one-time)
git remote add upstream https://github.com/StanGirard/companion.git

# Verify
git remote -v
# origin    https://github.com/TigerHix/companion (fetch/push)
# upstream  https://github.com/StanGirard/companion (fetch/push)
```

## Merge Workflow

```bash
git fetch upstream main
git log --oneline HEAD..upstream/main   # review incoming commits
git merge upstream/main                 # or: git cherry-pick <sha>
```

After merging, you **must** re-apply the moku divergences described below. The merge will likely produce conflicts in files that were modified or deleted in our fork — resolve them according to the rules in this document.

## What Was Removed (Phases 1–2)

These features were **deleted entirely** from moku. If upstream introduces commits touching any of these, **drop them or resolve conflicts by keeping deletion**.

### Linear Integration (fully removed)
- `web/server/linear-project-manager.ts` (+ test)
- `web/server/linear-cache.ts` (+ test)
- `web/server/session-linear-issues.ts` (+ test)
- `web/server/routes/linear-routes.ts` (+ test)
- `web/src/components/LinearSettingsPage.tsx` (+ test)
- `web/src/components/home/LinearSection.tsx` (+ test)
- `web/src/components/home/CreateIssueModal.tsx` (+ test)
- `web/src/components/LinearLogo.tsx`
- `web/src/components/IntegrationsPage.tsx` (+ test)
- `web/src/utils/linear-branch.ts` (+ test)
- All `linearApiKey`, `linearAutoTransition*` settings fields in `settings-manager.ts`
- `LinearIssueSection` in `TaskPanel.tsx`, `"linear-issue"` in `task-panel-sections.ts`
- Integrations page and route (`#/integrations`, `#/integrations/linear`)
- "Integrations" sidebar nav item
- All Linear-related state in `store.ts` (`linkedLinearIssues`, `setLinkedLinearIssue`)
- All Linear API methods in `api.ts`

### PostHog Analytics (fully removed)
- `web/src/analytics.ts` (+ test)
- `initAnalytics()` call in `main.tsx`
- `capturePageView`, `captureException`, `trackApiSuccess/Failure` — all removed
- `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST` env vars (from CI and `vite-env.d.ts`)
- Telemetry section in `SettingsPage.tsx`

### Update Checker / Auto-Update (fully removed)
- `web/server/update-checker.ts` (+ test)
- `web/src/components/UpdateBanner.tsx` (+ test)
- `web/src/components/UpdateOverlay.tsx` (+ test)
- Update-related state in `store.ts` (`updateInfo`, `updateDismissedVersion`, `updateOverlayActive`)
- `/api/update-check` and `/api/update` endpoints in `system-routes.ts`
- "Updates" section in `SettingsPage.tsx`

### Landing Page (fully removed)
- `landing/` directory (entire)
- `scripts/landing-start.sh`

### Publishing Infrastructure (fully removed)
- `.github/workflows/publish.yml` (npm publish)
- `.github/workflows/docker.yml` (Docker Hub push)
- `.release-please-manifest.json`, `release-please-config.json`
- `CHANGELOG.md` (root)

## What Was Renamed (Phase 3 — Branding)

All branding was renamed from "The Companion" to "Moku". If upstream commits introduce **new** strings using the old names, they must be renamed during merge.

| Old | New |
|---|---|
| `the-companion` | `moku` |
| `The Companion` | `Moku` |
| `Companion` (standalone product ref) | `Moku` |
| `COMPANION_*` env vars | `MOKU_*` |
| `~/.companion/` | `~/.moku/` |
| `vibe-sessions` | `moku-sessions` |
| `CompanionEnv`, `CompanionSettings` | `MokuEnv`, `MokuSettings` |
| `companion_auth`, `companion_auth_token` | `moku_auth`, `moku_auth_token` |
| `companion:last-seq:` | `moku:last-seq:` |
| `sh.thecompanion.app` | `app.moku.dev` |
| `the-companion.service` | `moku.service` |
| `companion-` (container/volume prefix) | `moku-` |
| `/companion-host-*` (Docker mounts) | `/moku-host-*` |
| `Dockerfile.the-companion` | `Dockerfile.moku` |
| `docker.io/stangirard` | `docker.io/moku` |
| `The Vibe Company` | `Moku` |

**Exception:** `cc-*` CSS class prefixes are **not** branding — they stand for "claude code" and must NOT be renamed.

## Decision Rules for Incoming Upstream Commits

### Auto-accept (apply directly after renaming)
- Bug fixes to existing shared functionality (WebSocket bridge, session store, container manager, CLI launcher, etc.)
- Performance improvements
- Dependency updates
- Test improvements for non-removed features

### Ask the user first
- **New UI components or pages** — moku may not want all upstream affordances
- **New integrations** (e.g., a new third-party service like Linear was) — likely unwanted
- **New analytics or telemetry** — unwanted, confirm before merging
- **Changes to publishing/release infrastructure** — not applicable to moku
- **New environment variables** — need to decide naming (`MOKU_*` prefix)
- **Significant architectural changes** — worth discussing impact

### Auto-reject (drop during merge)
- Anything touching removed files/features listed above
- npm publish, Docker Hub push, release-please changes
- PostHog/analytics additions
- Linear integration additions
- Update checker / auto-update additions
- Landing page changes

## Post-Merge Checklist

After every upstream merge:

1. **Resolve conflicts** using the rules above (keep deletions, rename branding)
2. **Search for old branding** that may have been introduced:
   ```bash
   grep -r "the-companion\|The Companion\|COMPANION_\|\.companion/" web/ --include='*.ts' --include='*.tsx' --include='*.json' --include='*.html'
   ```
3. **Run typecheck:** `cd web && bun run typecheck`
4. **Run tests:** `cd web && bun run test`
5. **Spot-check UI** if the merge involved frontend changes
