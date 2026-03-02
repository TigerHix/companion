---
name: companion-upstream-sync
description: Sync the `moku` / `companion` fork with `upstream/main` using the repo's backend-upstream, frontend-owned policy. Use when fetching upstream, realigning `web/server/` to upstream, merging or cherry-picking upstream commits, resolving `web/src/` conflicts, validating the result, moving `main` to the final integrated history, or cleaning up helper worktrees and backup stashes after an upstream sync.
---

# Companion Upstream Sync

## Overview

Use a clean helper worktree to integrate upstream safely when the main repo is dirty or frontend divergence is non-trivial. Keep backend scope upstream-owned, keep product divergence in `web/src/`, ask for review only on non-trivial frontend/product choices, and move `main` only after the helper branch validates.

Always read `UPSTREAM.md` at the repo root first. Treat it as the repo policy source of truth.

## Workflow

### 1. Inspect Before Changing Anything

Run:

```bash
git fetch upstream main
git log --oneline --decorate HEAD..upstream/main
git diff --stat HEAD..upstream/main
git diff --name-status HEAD..upstream/main
```

Classify upstream changes:

- backend/shared server changes: usually take directly
- frontend/product changes: review carefully
- docs exposing hidden features: do not merge unless the user wants them

### 2. Prefer A Clean Helper Worktree

If the current worktree is dirty, create a helper worktree from current `HEAD`:

```bash
git worktree add -b chore/merge-upstream-YYYY-MM-DD /tmp/companion-upstream-merge HEAD
cd /tmp/companion-upstream-merge
```

Do merge/conflict work there instead of in the dirty primary worktree.

### 3. Realign Backend First

Realign backend scope before the broad merge:

```bash
git diff --stat upstream/main...HEAD -- web/server web/bin web/package.json
git checkout upstream/main -- web/server web/bin web/package.json
git commit -m "chore(upstream): realign backend to upstream"
```

Default rule:

- `web/server/`, `web/bin/`, and backend startup/package wiring follow upstream
- restore upstream backend features even if the fork previously removed them
- do not keep backend branding forks unless truly required
- any remaining backend patch must be tiny and marked `// moku: ...`

### 4. Merge Upstream Broadly

Start the upstream merge without committing immediately:

```bash
git merge --no-ff --no-commit upstream/main
```

Resolve conflicts by area:

- backend file: start from upstream
- frontend file: resolve manually with product intent in mind
- docs/README exposing hidden features: drop them unless the user explicitly wants them

### 5. Keep Hidden Features Hidden In The Frontend

For this repo, the repeated safe pattern is:

- keep backend support for upstream features
- remove or hide frontend entry points if moku does not expose them

Typical examples:

- saved prompts
- Linear frontend pages/modals/routes
- AI validation frontend surfaces, if the user says they should remain hidden

Do not delete backend code for those features just because the frontend hides them.

### 6. Integrate Local UI Work Onto The Merge Branch

If there is local frontend work that should survive:

1. commit it separately first if possible
2. cherry-pick that ordinary commit onto the helper merge branch
3. resolve only the overlapping frontend files there

Prefer this over hand-copying files between worktrees.

Do not cherry-pick merge commits unless you explicitly want that history shape.

### 7. Validate In Layers

Minimum checks:

```bash
cd web
bun run typecheck
bun run build
```

Then run targeted tests for changed frontend areas.

Treat full-suite failures carefully:

- sandboxed `git` subprocess failures in tests are often environment issues
- network interface queries may fail in restricted environments
- frontend regressions in changed files should be fixed before finalizing

### 8. Move Main Only After The Helper Branch Is Good

After the helper branch is validated:

1. return to the real repo on `main`
2. ensure the real worktree is clean
3. move `main` to the validated helper result
4. confirm `git status -sb` is clean before pushing

If `main` is an ancestor of the helper branch, fast-forward:

```bash
git merge --ff-only <validated-commit-or-branch>
```

## Ask The User Only About Product Choices

Ask the user about:

- whether hidden frontend features should stay hidden
- whether upstream docs/README changes that expose hidden features should be merged
- whether a non-trivial frontend/product change should land

Do not ask the user to re-approve ordinary backend realignment.

## Pitfalls

- Do not perform the main merge in a dirty worktree unless you are explicitly choosing that tradeoff.
- Do not preserve backend deletions just because the fork had them before.
- Do not let docs re-expose hidden frontend features by accident.
- Do not trust concurrent `git status` / `git log` reads immediately after switching branches, merging, or committing. Re-run them after the write completes.
- Do not forget that `git stash --include-untracked` also captures untracked files like `.agent/`.

If you must stash a dirty worktree to clear `main`, create a backup stash and restore only what you need later:

```bash
git stash push --include-untracked -m "backup before integrating main"
git show 'stash@{0}^3:.agent/skills/frontend-design/SKILL.md' > .agent/skills/frontend-design/SKILL.md
```

## Cleanup

After `main` is updated and clean:

```bash
git worktree remove --force /tmp/companion-upstream-merge
git branch -d chore/merge-upstream-YYYY-MM-DD
```

Keep any backup stash until the user confirms nothing else needs to be restored.
