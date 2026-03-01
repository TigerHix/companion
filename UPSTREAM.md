# Upstream Merge Guide

This repo (`moku`) is a private fork of [The Companion](https://github.com/The-Vibe-Company/companion) (`upstream`).

## Operating Model

- `web/server/` is upstream-owned.
- `web/bin/`, `web/package.json`, and backend startup/CLI packaging should stay close to upstream too.
- `web/src/` is where moku-specific product and UI divergence belongs.
- If we do not want to expose an upstream backend capability, hide or remove it in the frontend instead of deleting backend code.
- If a backend patch is truly required, keep it minimal, localized, and annotate it with `// moku: explain why this patch exists`.

## Setup

```bash
git remote add upstream https://github.com/The-Vibe-Company/companion.git
git remote -v
```

Expected remotes:

```bash
origin    https://github.com/TigerHix/companion
upstream  https://github.com/The-Vibe-Company/companion
```

## Source Of Truth

Use these rules when merging upstream:

- `web/server/`: take upstream by default.
- `web/bin/`: take upstream by default.
- `web/package.json`: take upstream backend/package changes by default.
- `web/src/`: do not blindly merge; review with product intent in mind.
- Backend branding, feature flags, env vars, cookies, paths, service names, and route wiring should follow upstream unless a minimal `// moku: ...` patch is required.

## Backend Ownership

The backend should be restored to upstream as completely as possible.

This includes upstream:

- backend behavior
- backend features
- backend routes
- backend naming and branding
- backend env var naming
- backend storage, service, cookie, and path naming

Do not preserve backend deletions or renames just because the fork previously made them. If upstream has backend code for a feature, the default is to keep it.

Examples:

- Keep Linear backend modules and routes if upstream has them.
- Keep prompt-related backend modules and routes if upstream has them.
- Keep update-checker and related backend wiring if upstream has them.
- Keep upstream backend CLI/package naming if upstream uses `companion` or `the-companion`.

## Frontend Ownership

`web/src/` is where moku divergence should live.

Use the frontend to:

- hide backend features we do not want to expose
- remove navigation or entry points for upstream capabilities we do not want in the product
- rename or restyle product-facing UI for moku
- ignore backend fields or APIs that exist upstream but are not part of the moku frontend

Do not delete backend code just because the current frontend does not use it.

## Minimal Backend Patch Rule

Only keep a local backend patch when all of the following are true:

- it is necessary for moku to function
- it cannot reasonably be moved to the frontend
- it is small and localized
- it is annotated with `// moku: explain why this patch exists`

If a backend change does not meet that bar, remove it and follow upstream instead.

## Default Merge Policy

When reviewing upstream commits, classify them like this:

- Backend bug fix in shared server code: take it.
- Backend refactor in shared server code: take it.
- Backend change touching a feature we do not expose in the UI: usually still take it; hide the feature in the frontend if needed.
- Frontend UI/page/component change: review carefully.
- Non-trivial frontend or product behavior change: ask the user before merging.
- New integration, analytics, publishing, or release automation that affects the frontend/product surface: ask the user before merging unless it is purely backend plumbing we intend to keep upstream-owned.

## Realigning The Backend

The goal is not to preserve an old backend fork. The goal is to make backend scope match upstream, then keep the remaining patch surface extremely small.

Recommended workflow:

```bash
git checkout main
git pull origin main
git fetch upstream main
git checkout -b chore/realign-backend-with-upstream
```

Inspect divergence first:

```bash
git diff --stat upstream/main...HEAD -- web/server web/bin web/package.json
git diff --name-status upstream/main...HEAD -- web/server web/bin web/package.json
git log --oneline HEAD..upstream/main -- web/server web/bin web/package.json
```

Then prefer restoring upstream wholesale:

```bash
git checkout upstream/main -- web/server web/bin web/package.json
```

After restoring upstream, reapply only truly required local backend patches, and mark each one with `// moku: ...`.

## Realignment Review

Before opening a PR, verify that backend scope is very close to upstream:

```bash
git diff --stat upstream/main...HEAD -- web/server web/bin web/package.json
git diff --name-status upstream/main...HEAD -- web/server web/bin web/package.json
```

The ideal result is:

- nearly all backend differences gone
- any remaining differences are minimal
- every remaining backend patch is intentional and marked `// moku: ...`

If the backend diff still contains broad behavior changes, feature removals, or branding rewrites, the realignment is not finished.

## Merge Workflow For Future Upstream Syncs

Always merge on a dedicated branch:

```bash
git checkout main
git pull origin main
git fetch upstream main
git checkout -b chore/merge-upstream-YYYY-MM-DD
```

Inspect upstream first:

```bash
git log --oneline --decorate HEAD..upstream/main
git diff --stat HEAD..upstream/main
git diff --name-status HEAD..upstream/main
```

Choose the smallest safe method:

- `git cherry-pick <sha>` when only a few upstream commits are wanted
- `git merge --no-ff upstream/main` when a broad sync is appropriate
- `git merge --no-ff --no-commit upstream/main` when you want to inspect conflict resolution before committing

## Conflict Resolution Rules

Resolve by area, not by whichever side is easier.

### Backend Conflicts

Default rule:

- if the file is in `web/server/`, `web/bin/`, or backend packaging/startup wiring, start from upstream

Keep local behavior only when it is:

- a necessary, minimal backend patch
- clearly documented with `// moku: ...`
- not feasible to implement in the frontend instead

If upstream reintroduces a backend feature we do not expose, keep the backend and handle the exposure in the frontend.

### Frontend Conflicts

Default rule:

- do not blindly take upstream

For `web/src/`, review carefully because this is where moku intentionally diverges in:

- layout and navigation
- component primitives
- modal/dialog behavior
- page structure
- feature exposure and affordances
- branding and product copy

If an upstream frontend change affects product behavior or reintroduces UI we may not want, ask the user before merging it.

### Useful Commands

```bash
git checkout --ours -- path/to/file
git checkout --theirs -- path/to/file
```

Use them intentionally:

- shared backend file: usually start from upstream
- backend feature reintroduced upstream: usually keep it and hide it in the frontend if needed
- heavily diverged frontend file: usually resolve manually

## Ask Before Merging Product Changes

Ask the user before taking non-trivial upstream changes that add or materially change:

- pages
- navigation
- user-facing workflows
- integrations exposed in the UI
- analytics or telemetry visible at the product level
- publishing or release automation with product/process impact
- architectural changes with user-visible tradeoffs

Backend changes are generally accepted directly. Frontend changes require more careful product review.

## Quick Decision Summary

- Backend shared code: follow upstream.
- Backend branding/features/routes: follow upstream.
- Frontend divergence: keep it in `web/src/`.
- Unwanted backend capability: hide or remove access in the frontend.
- Backend local patch: keep it rare, minimal, and mark it with `// moku: ...`.
- If an upstream frontend/product change is non-trivial: ask the user.
