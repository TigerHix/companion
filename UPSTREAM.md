# Upstream Merge Guide

This repo ("moku") is a private fork of [The Companion](https://github.com/The-Vibe-Company/companion) (upstream). This guide tells agents how to pull, evaluate, and merge upstream commits.

## Setup

```bash
# Add upstream remote (one-time)
git remote add upstream https://github.com/The-Vibe-Company/companion.git

# Verify
git remote -v
# origin    https://github.com/TigerHix/companion (fetch/push)
# upstream  https://github.com/The-Vibe-Company/companion (fetch/push)
```

## Principles

- Treat upstream merges as integration work, not as a blind `git merge upstream/main`.
- Always merge on a dedicated branch created from the current moku default branch.
- Review incoming commits and changed paths before touching the worktree.
- Prefer the smallest safe integration strategy:
  - cherry-pick when only a few upstream commits are wanted
  - merge when the incoming batch is broad and mostly compatible
- Re-apply moku divergences deliberately after conflict resolution. Do not assume upstream can overwrite current moku conventions.

## Recommended Merge Workflow

### 1. Start from a clean integration branch

```bash
git checkout main
git pull origin main
git fetch upstream main
git checkout -b chore/merge-upstream-YYYY-MM-DD
```

### 2. Inspect what actually changed upstream

```bash
git log --oneline --decorate HEAD..upstream/main
git diff --stat HEAD..upstream/main
git diff --name-status HEAD..upstream/main
```

Use these to sort upstream changes into buckets:
- safe to take directly
- needs branding/env/path renames
- conflicts with removed moku features and must be dropped
- needs product review before merging

### 3. Choose the integration method

#### Option A: Cherry-pick specific commits

Use this when only a few upstream commits are relevant.

```bash
git cherry-pick <sha1> <sha2> ...
```

#### Option B: Merge upstream/main

Use this when the incoming changes are broad and mostly compatible.

```bash
git merge --no-ff upstream/main
```

If you want to inspect conflict resolution before finalizing the merge commit:

```bash
git merge --no-ff --no-commit upstream/main
```

After merging, you **must** re-apply the moku divergences described below. The merge will likely produce conflicts in files that were modified or deleted in our fork. Resolve them according to the rules in this document.

## Conflict Resolution Workflow

### 1. Resolve by category, not file-by-file guesswork

For every conflict, decide which of these cases it falls into:
- upstream changed a feature moku removed entirely: keep the moku deletion
- upstream changed a shared feature moku still uses: merge both sides carefully
- upstream introduced old branding or old env/path names: keep the functionality, rename it to moku conventions
- upstream changed a file where moku now has a local primitive/token system: port the behavior onto the moku abstraction instead of restoring upstream raw UI patterns

### 2. Use `ours` / `theirs` intentionally

These are useful, but only after you classify the conflict:

```bash
# Keep current moku version
git checkout --ours -- path/to/file

# Take upstream version as the starting point
git checkout --theirs -- path/to/file
```

Common cases:
- removed feature files: usually `--ours` if the file should stay deleted or moku-specific
- shared backend bugfix in a lightly diverged file: often start from `--theirs`, then reapply local renames and product-specific deltas
- heavily diverged UI files: usually resolve manually rather than taking either side wholesale

### 3. Audit the result before committing

Before finalizing the merge, check:

```bash
git diff --check
git status --short
git diff --stat ORIG_HEAD..HEAD
```

If you used `--no-commit`, inspect the pending merge result with:

```bash
git diff --stat --cached
git diff --cached
```

## Upstream Review Checklist

Before accepting upstream commits, explicitly review these categories because they commonly require fork-specific handling:

- branding and product naming
- auth/session persistence paths
- environment variable names
- analytics or telemetry
- publishing/release automation
- third-party integrations
- settings page additions
- frontend component primitives, tokens, and modal/button patterns
- WebSocket/session protocol changes that must remain compatible with both Claude Code and Codex

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

### Saved Prompts (fully removed)
- `web/server/prompt-manager.ts` (+ test)
- `web/server/routes/prompt-routes.ts`
- `web/src/components/PromptsPage.tsx` (+ test)
- `web/src/components/MentionMenu.tsx` (+ test)
- `web/src/utils/use-mention-menu.ts` (+ test)
- Saved prompt API methods in `web/src/api.ts`
- Prompts page route (`#/prompts`)
- "Prompts" sidebar nav item
- Prompt insertion and prompt-saving affordances in `web/src/components/Composer.tsx`
- Prompt insertion affordances in `web/src/components/HomePage.tsx`

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
3. **Search for removed features** that may have been accidentally restored:
   ```bash
   rg -n "Linear|PostHog|update-check|UpdateBanner|IntegrationsPage|landing/" .
   ```
4. **Search for upstream UI patterns that bypass moku primitives/tokens**:
   ```bash
   rg -n "<button|type=\"checkbox\"|createPortal|bg-(red|green|blue|amber|purple)|text-(red|green|blue|amber|purple)" web/src
   ```
5. **Reconcile dependency changes**:
   ```bash
   cd web && bun install
   ```
6. **Run typecheck:** `cd web && bun run typecheck`
7. **Run tests:** `cd web && bun run test`
8. **Spot-check UI** if the merge involved frontend changes
9. **Document any intentionally deferred upstream follow-ups** in the relevant plan or PR description

## Practical Advice For Moku

These are the most common mistakes during upstream integration:

- Do not restore upstream UI code verbatim if moku already migrated that area to shared primitives (`web/src/components/ui/*`) or semantic tokens in `web/src/index.css`.
- Do not overwrite Codex compatibility work with Claude-only assumptions. Moku features must remain explicit about Claude-vs-Codex behavior.
- Do not assume upstream config defaults match moku. Ports, auth, storage paths, and branding often diverge.
- Do not treat the lockfile as noise. If upstream changes dependencies, run `bun install` and verify the resulting lockfile intentionally.
- Do not land an upstream merge without writing down any dropped commits, deliberate deviations, or test-baseline exceptions.
