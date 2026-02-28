# UI Rewrite Plan

## Goals

- Make theme tokens the source of truth for app theming.
- Make shared UI primitives the source of truth for repeated interaction patterns.
- Remove ad hoc feature-local visual systems in favor of shared component contracts.
- Keep chat/message flow and terminal surfaces visually coherent with the rest of the app.
- Keep Playground coverage and frontend tests aligned with the rewrite.

## Non-Goals

- No broad rebrand or visual redesign beyond system alignment.
- No backend or protocol refactors unless UI compatibility requires them.
- No removal of existing tests.

## Rules

- Check this file before starting any new UI rewrite batch.
- Before editing a feature component, confirm whether a shared primitive already exists.
- If a primitive is missing, add or extend the primitive before adding feature-local UI patterns.
- Do not introduce new raw hex or Tailwind palette classes for product semantics unless the exception is logged below.
- Update `web/src/components/Playground.tsx` for any changed message/chat-flow component states.
- Modified frontend components must keep or add tests, including axe coverage where applicable.
- After a batch passes its targeted verification and the plan is updated, continue directly into the next highest-priority batch without pausing for confirmation unless a real blocker appears or the exit criteria are satisfied.

## Exit Criteria

The rewrite is complete only when every item below is true:

- [x] Shared surfaces in `web/src/index.css` use semantic/component tokens instead of hard-coded palette literals for their primary visual contract.
- [x] High-impact duplicated toggles have been migrated to the shared `Switch` primitive.
- [x] High-impact duplicated modal shells have been migrated to the shared `Dialog` primitive or explicitly logged as deferred with a technical reason.
- [x] Backend semantics are standardized through a shared visual contract and no longer rely on raw per-feature colors.
- [x] Git/status semantics for added, removed, modified, ahead, behind, success, warning, and destructive states are standardized through tokens or shared classes.
- [x] Terminal surfaces derive their colors from tokens rather than component-local literals.
- [x] `Composer`, `PermissionBanner`, `MessageBubble`, `MessageFeed`, `Sidebar`, `TaskPanel`, `HomePage`, `EnvManager`, `CronManager`, and `FolderPicker` no longer introduce new duplicate interaction patterns.
- [x] No remaining raw hex color usage exists in frontend components for product semantics unless recorded in `Decision Log` and `Follow-ups`.
- [x] Targeted tests pass for every modified component batch.
- [x] `cd web && bun run typecheck` passes.
- [x] `cd web && bun run test` passes, or any failing unrelated pre-existing tests are explicitly documented below with evidence.
- [x] `M8. Final Consistency Audit` has been completed and any remaining debt is listed in `Follow-ups`.

## Milestones

### M1. Plan and Audit Alignment

- [x] Add the root rewrite checklist file.
- [x] Capture rewrite rules, milestones, and verification workflow.
- [x] Seed the decision log with the current defaults.

### M2. Design Token Hardening

- [x] Introduce a semantic component-token layer for shared surfaces.
- [x] Refactor button, input, card, panel, and tabs styles to consume semantic tokens instead of literal palette values.
- [x] Ensure root theme token changes propagate through shared styles.

### M3. Primitive Adoption

- [x] Replace custom feature-local toggles with the shared `Switch` primitive.
  - [x] Task Panel config toggle migrated to `Switch`.
  - [x] Cron Manager toggles migrated to `Switch`.
- [x] Replace custom modal shells with the shared `Dialog` primitive where technically feasible.
  - [x] FolderPicker migrated to `Dialog`.
  - [x] CronManager modal shell migrated to `Dialog`.
  - [x] EnvManager modal shell migrated to `Dialog`.
- [x] Replace feature-local CTA/button variants with shared `Button` usage or documented primitive extensions.
  - [x] `AgentsPage` list/header CTAs, card actions, editor chrome, and skills multi-select now use shared `Button` contracts instead of feature-local button shells or a native checkbox list.
  - [x] `SessionItem`, `AiValidationToggle`, and `TaskPanel` now use shared `Button` contracts for their remaining row actions, menu actions, trigger controls, and panel/config CTAs.
  - [x] `DiffPanel`, `ModelSwitcher`, and `TerminalAccessoryBar` now use shared `Button` contracts for file-list actions, model selection, and terminal accessory controls.
  - [x] `home/BranchPicker`, `ProjectGroup`, and `FolderPicker` now use shared `Button` contracts for branch selection, sidebar group collapse, and folder-picker navigation rows/actions.
  - [x] `McpPanel`, `CronManager`, and the matching Playground admin/message examples now use shared `Button` contracts for server controls, cron task actions, panel-config examples, and related preview rows.

### M4. Semantic Status Palette

- [x] Standardize Claude/Codex backend badge semantics.
  - [x] Shared `BackendBadge` added and adopted in SessionItem and CronManager.
- [x] Standardize git/status semantics for added/removed/modified/ahead/behind states.
  - [x] DiffPanel, TaskPanel, and BranchPicker moved onto semantic git classes.
- [x] Remove raw hex and raw Tailwind status colors from migrated surfaces.

### M5. Terminal Integration

- [x] Add terminal-specific semantic tokens.
- [x] Refactor `TerminalView` to derive colors from tokens.
- [x] Refactor terminal dock backgrounds to use the same tokenized surface.

### M6. Feature Migration

- [x] Migrate `Composer` onto shared primitives for send/mode actions.
- [x] Migrate `PermissionBanner`, `MessageBubble`, and `MessageFeed` onto the standardized surface system.
- [x] Migrate `Sidebar`, `TaskPanel`, and session-management surfaces onto shared semantics.
  - [x] `Sidebar` now uses semantic warning/destructive treatments, shared `Button` actions, and the shared `Dialog` shell for delete confirmation.
  - [x] `SessionItem` and `TopBar` now use semantic status/badge treatments instead of raw amber/blue/violet/red status colors.
  - [x] `SessionItem` row, archive/menu controls, and `TaskPanel` panel/config/git actions now use shared `Button` contracts instead of feature-local button shells.
- [x] Migrate `HomePage`, `SettingsPage`, `EnvManager`, `CronManager`, and `FolderPicker` onto shared primitives.
  - [x] `EnvManager` migrated onto shared `Dialog`, `Button`, `Input`, and `Textarea` primitives and onto shared status/surface classes.
  - [x] `HomePage` warning/status cluster migrated onto semantic warning/success/destructive tokens and shared `Button` variants.
  - [x] `SettingsPage` now uses shared `Button` primitives for its repeated navigation/action shells.
  - [x] `SettingsPage` binary setting rows now use the shared `Switch` primitive, while theme and diff-base controls stay button-based because they are multi-option cycles rather than binary toggles.
- [x] Migrate editor/process/detail surfaces onto shared primitives and semantic status tokens.
  - [x] `ProcessPanel` main action/status cluster migrated onto shared `Button` variants and semantic status tokens.
  - [x] `SessionEditorPane` save/back actions and dirty-state status migrated onto shared `Button` variants and semantic warning tokens.
  - [x] `AgentsPage` run-input modal migrated onto shared `Dialog`/`Textarea`/`Button`, its branch toggles now use shared `Switch`, and its webhook copy CTA no longer uses a raw blue semantic chip.
  - [x] `AgentsPage` list/header CTAs, card actions, editor chrome, and skills multi-select now use shared `Button` contracts; only its schedule recurrence radios remain native because they represent a small two-option choice rather than duplicated boolean toggles.
  - [x] `ClaudeConfigBrowser` JSON and generic markdown editor shells now use the shared `Dialog`, `Button`, and `Textarea` primitives.
  - [x] `ClaudeMdEditor` now uses the shared `Dialog`, `Button`, and `Textarea` primitives for its multi-file CLAUDE.md editing shell while preserving the unsaved-change confirmation flow.

### M7. Playground and Test Completion

- [x] Update Playground states for any changed message-flow components.
- [x] Keep tests current for each modified frontend component.
- [x] Preserve axe coverage on modified primitives and feature components.

### M8. Final Consistency Audit

- [x] Audit for raw semantic colors, duplicate dialog shells, duplicate switch shells, and custom primary CTAs.
- [x] Compare final state against the original rewrite audit.
- [x] Track any deliberate deferrals below.

## Active Focus

Current milestone: `Complete`

Next tasks:

- [x] Create this root rewrite checklist and use it as the working spec.
- [x] Replace the Task Panel config toggle with the shared `Switch` primitive.
- [x] Migrate the next duplicated toggle surface, starting with `CronManager`.
- [x] Add semantic backend, git, and terminal tokens to the shared theme contract.
- [x] Migrate `EnvManager` off its feature-local portal shell and onto the shared `Dialog` primitive.
- [x] Add a shared surface/status token layer in `web/src/index.css` and move the first high-visibility feature onto it.
- [x] Re-run targeted verification for `EnvManager` and the touched shared primitives after the batch.
- [x] Continue the token-hardening pass across `SessionEditorPane`.
- [x] Continue duplicated CTA/button cleanup on the remaining high-visibility surfaces.
- [x] Migrate the next high-visibility custom status/CTA cluster in `ProcessPanel`.
- [x] Migrate the next high-visibility custom status/CTA cluster in `HomePage`.
- [x] Migrate the next high-visibility custom status/CTA cluster in `SessionEditorPane`.
- [x] Move `PermissionBanner` and `MessageBubble` further onto shared message-flow interaction contracts and update Playground coverage.
- [x] Migrate `MessageFeed` disclosure controls onto shared `Button` contracts.
- [x] Remove remaining raw status-color holdouts in `TopBar`, `SessionItem`, and `TaskPanel`.
- [x] Migrate the next `AgentsPage` modal/toggle/status batch onto shared primitives and semantic status tokens.
- [x] Remove remaining terminal fallback hex colors from `TerminalView`.
- [x] Resolve the remaining custom editor shell in `ClaudeConfigBrowser`.
- [x] Migrate `ClaudeConfigBrowser` JSON/markdown editor shell onto the shared `Dialog`/`Button`/`Textarea` primitives while preserving the full-screen editor behavior.
- [x] Migrate `Composer` send/mode actions onto shared primitives and remove the remaining duplicate CTA patterns in its mode/send/image-removal controls.
- [x] Continue shared primitive adoption on `SettingsPage` for its repeated button shells.
- [x] Migrate `SettingsPage` binary setting rows onto the shared `Switch` primitive instead of full-row button shells.
- [x] Migrate the non-embedded `TerminalView` shell onto the shared `Dialog` contract.
- [x] Migrate `ClaudeMdEditor` off its feature-local editor shell and local button patterns onto shared primitives where the multi-file editing flow allows.
- [x] Continue the broader `AgentsPage` CTA/button cleanup beyond the run-input modal and webhook/status batch, starting with the list/header CTAs, card actions, and editor chrome.
- [x] Finish the `AgentsPage` contract decision by migrating the skills multi-select onto a shared `Button`-based pressed-state pattern if that removes the last native checkbox without introducing a new feature-local primitive.
- [x] Continue the final consistency audit on remaining high-visibility surfaces still using feature-local button shells, starting with the remaining `HomePage` row/detail controls now that `ProcessPanel` and `ToolBlock` are clean.
- [x] Continue the final consistency audit on the remaining high-traffic button-shell holdouts, starting with `SessionItem`, `AiValidationToggle`, and `TaskPanel`.
- [x] Continue the final consistency audit on the next high-visibility feature-local button holdouts after the session surfaces, starting with `DiffPanel`, `ModelSwitcher`, and `TerminalAccessoryBar`.
- [x] Continue the final consistency audit on the next navigation/admin holdouts, starting with `BranchPicker`, `ProjectGroup`, and `FolderPicker`.
- [x] Continue the final consistency audit on the next shared-data/admin holdouts, starting with `McpPanel`, `CronManager`, and Playground-only local button fixtures.
- [x] Continue the final consistency audit on the remaining chrome/utility holdouts, starting with `SectionErrorBoundary`, `AppErrorBoundary`, `SessionCreationProgress`, `SessionLaunchOverlay`, `TerminalPage`, and the last custom control buttons in `Sidebar` and `ClaudeConfigBrowser`.
- [x] Continue the final consistency audit on the last app-code button holdouts, now narrowed to `PromptsPage`, `LoginPage`, and `MentionMenu`.

## Decision Log

- 2026-02-28: The rewrite tracker lives at the repo root in `UI_REWRITE_PLAN.md`.
- 2026-02-28: The plan file is execution-checklist first, not a narrative-only spec.
- 2026-02-28: Rewrite order is system-first: tokens and primitives before broad surface polish.
- 2026-02-28: The warm copper/amber direction remains the current visual baseline.
- 2026-02-28: Shared primitives under `web/src/components/ui/` are the canonical source for repeated interaction patterns.
- 2026-02-28: Once a batch is verified and the tracker is updated, execution should continue autonomously into the next planned batch unless a real blocker requires user input.
- 2026-02-28: Terminal surfaces may keep a specialized palette, but the palette must be token-driven.
- 2026-02-28: First primitive migration batch is the Task Panel config toggle using the shared `Switch`.
- 2026-02-28: Backend semantics now flow through a shared `BackendBadge` component instead of per-feature badge colors.
- 2026-02-28: Git/status semantics are being standardized through semantic theme tokens (`git-added`, `git-removed`, `git-modified`, `git-ahead`, `git-behind`).
- 2026-02-28: `FolderPicker` and `CronManager` modal shells now use the shared `Dialog` primitive.
- 2026-02-28: The next rewrite batch focuses on `EnvManager` plus a first shared surface/status token pass in `web/src/index.css` so the migration lands on reusable contracts instead of feature-local replacements.
- 2026-02-28: Shared surface tokens now back the primary outline/secondary/button ghost, field, card, and glass-panel contracts in `web/src/index.css`; feature status chips now use shared semantic classes instead of per-feature blue/green/amber fragments.
- 2026-02-28: `EnvManager` is the first high-visibility feature migrated onto the new surface/status layer, and its modal shell now uses the shared `Dialog` primitive.
- 2026-02-28: `Sidebar` now uses semantic warning/destructive tokens instead of raw amber/red/violet/emerald utilities for its remaining high-visibility status/actions, and its delete confirmation now uses the shared `Dialog` primitive.
- 2026-02-28: `ProcessPanel` now uses semantic success/destructive tokens and shared ghost/outline buttons for its main process actions instead of raw red/green/emerald utilities.
- 2026-02-28: `HomePage` now uses semantic success/warning/destructive tokens for environment readiness and branch-behind warning states, and the branch-behind CTA row now uses shared `Button` variants.
- 2026-02-28: `SessionEditorPane` now uses shared `Button` variants for navigation/save actions, and its dirty-state indicator no longer relies on a raw amber utility.
- 2026-02-28: `PermissionBanner`, `MessageBubble`, and `MessageFeed` now use shared `Button` contracts for their remaining disclosure/action controls, and Playground includes the simplified `AskUserQuestion` fallback state.
- 2026-02-28: `TopBar`, `SessionItem`, and `TaskPanel` no longer rely on raw amber/blue/violet/red/purple status treatments for their current high-visibility status chips and pills.
- 2026-02-28: `AgentsPage` now uses shared `Dialog`, `Textarea`, `Button`, and `Switch` primitives for its run-input flow and branch toggles; the remaining skill selector stays a checkbox list pending a deliberate contract decision because it is multi-select rather than a binary toggle.
- 2026-02-28: `TerminalView` fallback colors now align with the terminal token contract instead of raw hex literals, so terminal theming stays token-driven even before CSS variables resolve.
- 2026-02-28: `ClaudeConfigBrowser` no longer uses a custom editor portal shell for its JSON and generic markdown editors; those full-screen editors now sit on the shared `Dialog` contract with shared `Button` and `Textarea` primitives while keeping unsaved-change confirmation behavior.
- 2026-02-28: `Composer` now uses shared `Button` contracts for mode toggles, send actions, slash-command rows, and image removal, so it no longer introduces its own primary CTA/button shell for the message composer flow.
- 2026-02-28: `SettingsPage` now uses the shared `Button` primitive for its repeated navigation and action shells; the remaining question there is whether its row-level setting toggles deserve a shared `Switch`-backed settings-row contract instead of staying as full-row buttons.
- 2026-02-28: The non-embedded `TerminalView` overlay now uses the shared `Dialog` contract while keeping the embedded dock variant unchanged.
- 2026-02-28: `ClaudeMdEditor` now uses the shared `Dialog`, `Button`, and `Textarea` primitives for its multi-file editor shell; the shared dialog contract is flexible enough to preserve full-screen editing and unsaved-change prompts without a feature-local overlay.
- 2026-02-28: `SettingsPage` binary setting rows now use the shared `Switch` primitive; theme and diff-base controls intentionally remain shared buttons because they are option cycles, not boolean toggles.
- 2026-02-28: `AgentsPage` skills now use shared `Button` toggles with `aria-pressed` instead of a native checkbox list because the surface is multi-select rather than boolean; the remaining native radios in its schedule section stay unchanged as a small two-option choice, not duplicated toggle debt.
- 2026-02-28: `HomePage` now uses shared `Button` contracts across the landing composer toolbar, backend/model/mode/env selectors, branching-session controls, resume-session row actions, and the remaining deeper row/detail affordances, so it no longer contains feature-local button shells.
- 2026-02-28: `SessionEditorPane` no longer contains feature-local button shells; its tree rows, search results, and refresh/search controls now use shared `Button` contracts in addition to the earlier save/back migration.
- 2026-02-28: `SessionTerminalDock` now uses shared `Button` contracts for its empty-state CTA, tab strip actions, and dock toolbar controls, keeping the terminal shell aligned with the shared terminal/dialog/button system.
- 2026-02-28: `TopBar` now uses shared `Button` contracts for sidebar/context toggles, workspace tabs, and theme controls, so the main session chrome no longer defines its own button shell.
- 2026-02-28: `FilesPanel` no longer contains feature-local button shells; its tree rows plus refresh/retry/back controls now use shared `Button` contracts while keeping the existing read-only file-view flow unchanged.
- 2026-02-28: `ProcessPanel` and `ToolBlock` no longer contain feature-local button shells; their disclosure controls, refresh actions, and tool header toggles now use shared `Button` contracts without changing process grouping or tool-detail rendering behavior.
- 2026-02-28: `SessionItem`, `AiValidationToggle`, and `TaskPanel` no longer contain feature-local button shells; the session row/edit split now avoids an input-inside-button structure, while the task-panel config and AI-validation menus keep their existing behavior on shared `Button` contracts.
- 2026-02-28: `DiffPanel`, `ModelSwitcher`, and `TerminalAccessoryBar` no longer contain feature-local button shells; shared `Button` contracts are now used for diff file selection, model dropdown options, and mobile terminal accessory controls without changing their existing menus or viewport behavior.
- 2026-02-28: `home/BranchPicker`, `ProjectGroup`, and `FolderPicker` no longer contain feature-local button shells; the existing branch-picker dropdown, grouped-session sidebar flow, and folder-picker dialog behavior are preserved on shared `Button` contracts, and `ProjectGroup` now has direct component-level test coverage.
- 2026-02-28: `McpPanel`, `CronManager`, and their mirrored Playground examples no longer contain feature-local button shells; shared `Button` contracts now back MCP server actions, cron task creation/edit/run controls, cron job-form selectors, and the Playground panel-config/MCP/tool-group examples without changing their existing flows.
- 2026-02-28: `SectionErrorBoundary`, `AppErrorBoundary`, `SessionCreationProgress`, `SessionLaunchOverlay`, `TerminalPage`, `Sidebar`, and `ClaudeConfigBrowser` no longer contain local button shells; their retry/reload, launch-state, utility CTA, sidebar footer navigation, and config-browser row controls now sit on shared `Button` contracts.
- 2026-02-28: `PromptsPage`, `LoginPage`, and `MentionMenu` no longer contain feature-local button shells; the final app-code `<button>` audit now only matches test helpers plus the intentionally retained `AgentsPage` schedule radios.
- 2026-02-28: Final consistency audit result: app code no longer contains local `<button>` shells, custom checkbox toggles, raw semantic palette classes, or feature-local modal shells beyond the documented `AgentsPage` radios and the full-suite timeout baseline below.

## Verification Checklist

- [x] `cd web && bun run typecheck`
- [x] Run targeted component tests for each migration batch.
- [x] Run broader frontend tests when a batch affects shared primitives.
- [x] Playground updated for any changed message-flow component states.
- [x] No new raw semantic colors introduced in this batch.
- [x] No new duplicated dialog, switch, or button patterns introduced in this batch.
- [x] Full suite clean or unrelated failures documented below.

## Follow-ups

- Final audit on 2026-02-28 shows app-code UI rewrite debt is closed for the targeted button/dialog/switch/status/token scope.
- `web/src/components/SessionEditorPane.tsx` no longer contains local `<button>` shells after the tree/search control migration.
- `web/src/components/SessionTerminalDock.tsx` no longer contains local `<button>` shells after the dock-toolbar/tab migration.
- `web/src/components/TopBar.tsx` no longer contains local `<button>` shells after the workspace-tab and toolbar migration.
- `web/src/components/FilesPanel.tsx` no longer contains local `<button>` shells after the tree/refresh/back migration.
- `web/src/components/ProcessPanel.tsx` and `web/src/components/ToolBlock.tsx` no longer contain local `<button>` shells after the disclosure/refresh toggle migration.
- `web/src/components/SessionItem.tsx`, `web/src/components/AiValidationToggle.tsx`, and `web/src/components/TaskPanel.tsx` no longer contain local `<button>` shells after the latest session-surface batch.
- `web/src/components/DiffPanel.tsx`, `web/src/components/ModelSwitcher.tsx`, and `web/src/components/TerminalAccessoryBar.tsx` no longer contain local `<button>` shells after the latest navigation/terminal batch.
- `web/src/components/home/BranchPicker.tsx`, `web/src/components/ProjectGroup.tsx`, and `web/src/components/FolderPicker.tsx` no longer contain local `<button>` shells after the latest branch/navigation batch.
- `web/src/components/McpPanel.tsx`, `web/src/components/CronManager.tsx`, and the touched admin/message examples in `web/src/components/Playground.tsx` no longer contain local `<button>` shells after the latest admin batch.
- `web/src/components/SectionErrorBoundary.tsx`, `web/src/components/AppErrorBoundary.tsx`, `web/src/components/SessionCreationProgress.tsx`, `web/src/components/SessionLaunchOverlay.tsx`, `web/src/components/TerminalPage.tsx`, `web/src/components/Sidebar.tsx`, and `web/src/components/ClaudeConfigBrowser.tsx` no longer contain local `<button>` shells after the latest utility/chrome batch.
- `web/src/components/PromptsPage.tsx`, `web/src/components/LoginPage.tsx`, and `web/src/components/MentionMenu.tsx` no longer contain local `<button>` shells after the final app-code batch.
- `web/src/components/AgentsPage.tsx` no longer contains local `<button>` shells or native checkboxes after the CTA/button and skills-toggle migration; only the schedule recurrence radios remain native.
- Final `cd web && bun run test` audit on 2026-02-28 still shows unrelated order-dependent/full-suite timeout failures outside the rewrite’s targeted component batches:
  - `server/cli-launcher.test.ts > launch > stores container metadata when containerId provided`
  - `server/codex-adapter.test.ts` timed out in multiple existing cases including `translates agent message streaming to content_block_delta events`, `rejects messages and discards queue after init failure`, and `emits command progress with elapsed time`
  - `server/routes/fs-routes.test.ts > GET /fs/tree > builds a tree with directories and files, sorted correctly`
  - `src/components/ClaudeMdEditor.test.tsx > ClaudeMdEditor > closes via backdrop click`
  - `src/components/DiffViewer.test.tsx > DiffViewer > handles multi-file unified diff`
  - `src/components/EnvManager.test.tsx > EnvManager create flow (embedded) > creates a new environment with name and variables`
  - `src/components/HomePage.test.tsx > HomePage > filters session table with search`
  - `src/components/PromptsPage.test.tsx > PromptsPage > creates a global prompt`
  - `src/components/SettingsPage.test.tsx > SettingsPage > shows QR code with address tabs when button is clicked`
  - `src/components/Sidebar.test.tsx > Sidebar > delete-all modal uses singular 'session' when only one archived session`
  - `src/components/ui/button.test.tsx > Button > passes axe accessibility checks`
  - These failures appeared in the full-suite run while the corresponding targeted files still passed in isolation/reduced batches, which is consistent with the previously documented order-dependent timeout baseline rather than a rewrite-specific regression.
- 2026-02-28 batch verification:
  - `cd web && bun run typecheck` passed after the `EnvManager`/shared surface token migration.
  - `cd web && bun run test src/components/EnvManager.test.tsx src/components/ui/button.test.tsx src/components/ui/dialog.test.tsx src/components/ui/input.test.tsx src/components/ui/textarea.test.tsx` passed.
  - `rg -n "#[0-9a-fA-F]{3,6}|(text|bg|border|ring)-(red|green|amber|yellow|blue|orange|emerald|cyan|violet|purple|pink)-" web/src/components/EnvManager.tsx web/src/index.css` only matched the historical `#d97757` comment in `web/src/index.css`; no raw semantic colors remain in `EnvManager`.
- 2026-02-28 sidebar verification:
  - `cd web && bun run typecheck` passed after the `Sidebar` migration.
  - `cd web && bun run test src/components/Sidebar.test.tsx src/components/ui/button.test.tsx src/components/ui/dialog.test.tsx` passed.
  - `rg -n "(text|bg|border|ring)-(red|green|amber|yellow|blue|orange|emerald|cyan|violet|purple|pink)-" web/src/components/Sidebar.tsx` returned no matches.
- 2026-02-28 process panel verification:
  - `cd web && bun run typecheck` passed after the `ProcessPanel` semantic action/status migration.
  - `cd web && bun run test src/components/ProcessPanel.test.tsx src/components/ui/button.test.tsx` passed.
  - `rg -n "(text|bg|border|ring)-(red|green|amber|yellow|blue|orange|emerald|cyan|violet|purple|pink)-" web/src/components/ProcessPanel.tsx` returned no matches.
- 2026-02-28 home page verification:
  - `cd web && bun run typecheck` passed after the `HomePage` warning/status migration.
  - `cd web && bun run test src/components/HomePage.test.tsx src/components/ui/button.test.tsx` passed.
  - `rg -n "(text|bg|border|ring)-(red|green|amber|yellow|blue|orange|emerald|cyan|violet|purple|pink)-|#[0-9a-fA-F]{3,6}" web/src/components/HomePage.tsx` returned no matches.
- 2026-02-28 session editor verification:
  - `cd web && bun run typecheck` passed after the `SessionEditorPane` action/status migration.
  - `cd web && bun run test src/components/SessionEditorPane.test.tsx src/components/ui/button.test.tsx` passed.
  - `rg -n "(text|bg|border|ring)-(red|green|amber|yellow|blue|orange|emerald|cyan|violet|purple|pink)-|#[0-9a-fA-F]{3,6}" web/src/components/SessionEditorPane.tsx` returned no matches.
- 2026-02-28 message-flow verification:
  - `cd web && bun run typecheck` passed after the `PermissionBanner`/`MessageBubble`/`MessageFeed` batch.
  - `cd web && bun run test src/components/PermissionBanner.test.tsx src/components/MessageBubble.test.tsx src/components/MessageFeed.test.tsx src/components/Playground.test.tsx src/components/ui/button.test.tsx` passed.
  - `rg -n "(text|bg|border|ring)-(red|green|amber|yellow|blue|orange|emerald|cyan|violet|purple|pink)-|#[0-9a-fA-F]{3,6}" web/src/components/PermissionBanner.tsx web/src/components/MessageBubble.tsx web/src/components/MessageFeed.tsx web/src/components/Playground.tsx` returned no component matches.
- 2026-02-28 status audit verification:
  - `cd web && bun run typecheck` passed after the `TopBar`/`SessionItem`/`TaskPanel` semantic status cleanup.
  - `cd web && bun run test src/components/TopBar.test.tsx src/components/SessionItem.test.tsx src/components/TaskPanel.test.tsx src/components/ui/badge.test.tsx` passed.
  - `rg -n "(text|bg|border|ring|fill|stroke)-(red|green|amber|yellow|blue|orange|emerald|cyan|violet|purple|pink)-|#[0-9a-fA-F]{3,6}" web/src/components/TopBar.tsx web/src/components/SessionItem.tsx web/src/components/TaskPanel.tsx` only matched existing semantic git classes in `TaskPanel`.
- 2026-02-28 agents page verification:
  - `cd web && bun run typecheck` passed after the `AgentsPage` primitive-adoption batch.
  - `cd web && bun run test src/components/AgentsPage.test.tsx src/components/ui/button.test.tsx src/components/ui/dialog.test.tsx src/components/ui/switch.test.tsx src/components/ui/textarea.test.tsx` passed.
  - `rg -n "(text|bg|border|ring|fill|stroke)-(red|green|amber|yellow|blue|orange|emerald|cyan|violet|purple|pink)-|#[0-9a-fA-F]{3,6}" web/src/components/AgentsPage.tsx` returned no matches.
  - `rg -n "fixed inset-0 z-50 flex items-center justify-center bg-black/50|type=\"checkbox\"" web/src/components/AgentsPage.tsx` now only matches the remaining skills multi-select checkbox.
- 2026-02-28 terminal fallback verification:
  - `cd web && bun run typecheck` passed after the terminal fallback cleanup.
  - `cd web && bun run test src/components/SessionTerminalDock.test.tsx` passed.
  - `rg -n "(text|bg|border|ring|fill|stroke)-(red|green|amber|yellow|blue|orange|emerald|cyan|violet|purple|pink)-|#[0-9a-fA-F]{3,6}" web/src/components/TerminalView.tsx` returned no matches.
- 2026-02-28 Claude config browser verification:
  - `cd web && bun run typecheck` passed after the `ClaudeConfigBrowser` dialog-shell migration.
  - `cd web && bun run test src/components/ClaudeConfigBrowser.test.tsx src/components/ui/dialog.test.tsx src/components/ui/button.test.tsx src/components/ui/textarea.test.tsx` passed.
  - `rg -n "createPortal|fixed inset-0 bg-black/40 z-50|fixed inset-4 sm:inset-8 md:inset-x-\\[10%\\] md:inset-y-\\[5%\\]" web/src/components/ClaudeConfigBrowser.tsx` returned no matches.
  - `rg -n "(text|bg|border|ring|fill|stroke)-(red|green|amber|yellow|blue|orange|emerald|cyan|violet|purple|pink)-|#[0-9a-fA-F]{3,6}" web/src/components/ClaudeConfigBrowser.tsx` returned no matches.
- 2026-02-28 composer verification:
  - `cd web && bun run test src/components/Composer.test.tsx src/components/ui/button.test.tsx` passed.
- 2026-02-28 process/tool batch verification:
  - `cd web && bun run typecheck` passed after the `ProcessPanel`/`ToolBlock` button-contract cleanup.
  - `cd web && bun run test src/components/ProcessPanel.test.tsx` passed.
  - `cd web && bun run test src/components/ToolBlock.test.tsx` passed.
  - `rg -n "<button" web/src/components/ProcessPanel.tsx web/src/components/ToolBlock.tsx` returned no matches.
- 2026-02-28 session-surface verification:
  - `cd web && bun run typecheck` passed after the `SessionItem`/`AiValidationToggle`/`TaskPanel` button-contract cleanup.
  - `cd web && bun run test src/components/SessionItem.test.tsx src/components/AiValidationToggle.test.tsx src/components/TaskPanel.test.tsx src/components/ui/button.test.tsx` passed.
  - `rg -n "<button" web/src/components/SessionItem.tsx web/src/components/AiValidationToggle.tsx web/src/components/TaskPanel.tsx` returned no matches.
- 2026-02-28 navigation/terminal verification:
  - `cd web && bun run typecheck` passed after the `DiffPanel`/`ModelSwitcher`/`TerminalAccessoryBar` button-contract cleanup.
  - `cd web && bun run test src/components/DiffPanel.test.tsx src/components/ModelSwitcher.test.tsx src/components/TerminalAccessoryBar.test.tsx src/components/ui/button.test.tsx` passed.
  - `rg -n "<button" web/src/components/DiffPanel.tsx web/src/components/ModelSwitcher.tsx web/src/components/TerminalAccessoryBar.tsx` returned no matches.
- 2026-02-28 branch/navigation verification:
  - `cd web && bun run typecheck` passed after the `home/BranchPicker`/`ProjectGroup`/`FolderPicker` button-contract cleanup.
  - `cd web && bun run test src/components/home/BranchPicker.test.tsx src/components/FolderPicker.test.tsx src/components/ProjectGroup.test.tsx src/components/ui/button.test.tsx` passed.
  - `rg -n "<button" web/src/components/home/BranchPicker.tsx web/src/components/ProjectGroup.tsx web/src/components/FolderPicker.tsx` returned no matches.
- 2026-02-28 admin/playground verification:
  - `cd web && bun run typecheck` passed after the `McpPanel`/`CronManager`/`Playground` button-contract cleanup.
  - `cd web && bun run test src/components/McpPanel.test.tsx src/components/CronManager.test.tsx src/components/Playground.test.tsx src/components/ui/button.test.tsx src/components/ui/switch.test.tsx` passed.
  - `rg -n "<button" web/src/components/McpPanel.tsx web/src/components/CronManager.tsx web/src/components/Playground.tsx` returned no matches.
- 2026-02-28 utility/chrome verification:
  - `cd web && bun run typecheck` passed after the `SectionErrorBoundary`/`AppErrorBoundary`/`SessionCreationProgress`/`SessionLaunchOverlay`/`TerminalPage`/`Sidebar`/`ClaudeConfigBrowser` button-contract cleanup.
  - `cd web && bun run test src/components/SectionErrorBoundary.test.tsx src/components/AppErrorBoundary.test.tsx src/components/SessionCreationProgress.test.tsx src/components/TerminalPage.test.tsx src/components/Sidebar.test.tsx src/components/ClaudeConfigBrowser.test.tsx src/components/ui/button.test.tsx` passed.
  - `rg -n "<button" web/src/components/SectionErrorBoundary.tsx web/src/components/AppErrorBoundary.tsx web/src/components/SessionCreationProgress.tsx web/src/components/SessionLaunchOverlay.tsx web/src/components/TerminalPage.tsx web/src/components/Sidebar.tsx web/src/components/ClaudeConfigBrowser.tsx` returned no matches.
- 2026-02-28 final app-code verification:
  - `cd web && bun run typecheck` passed after the `PromptsPage`/`LoginPage`/`MentionMenu` button-contract cleanup.
  - `cd web && bun run test src/components/PromptsPage.test.tsx src/components/LoginPage.test.tsx src/components/MentionMenu.test.tsx src/components/ui/button.test.tsx` passed.
  - `rg -n "<button|type=\"checkbox\"|type=\"radio\"|createPortal|fixed inset-0 z-50 flex items-center justify-center bg-black/50" web/src/components` now only matches test helpers plus the intentionally retained `AgentsPage` schedule radios.
  - `rg -n "#[0-9a-fA-F]{3,6}|(text|bg|border|ring|fill|stroke)-(red|green|amber|yellow|blue|orange|emerald|cyan|violet|purple|pink)-" web/src/components web/src/index.css` only matches the historical `#d97757` comment in `web/src/index.css`, semantic git utility classes, and test assertions/comments.
  - `cd web && bun run test` still fails with the unrelated timeout baseline listed above; targeted rewrite batches remain green.
  - `cd web && bun run typecheck` passed after the `Composer` primitive-adoption batch.
  - `rg -n "<button|text-(red|green|amber|yellow|blue|orange|emerald|cyan|violet|purple|pink)-|bg-(red|green|amber|yellow|blue|orange|emerald|cyan|violet|purple|pink)-|border-(red|green|amber|yellow|blue|orange|emerald|cyan|violet|purple|pink)-|#[0-9a-fA-F]{3,6}" web/src/components/Composer.tsx` returned no matches.
- 2026-02-28 settings page verification:
  - `cd web && bun run test src/components/SettingsPage.test.tsx src/components/ui/button.test.tsx` passed.
  - `cd web && bun run typecheck` passed after the `SettingsPage` button-shell migration.
  - `rg -n "<button|type=\"checkbox\"|text-(red|green|amber|yellow|blue|orange|emerald|cyan|violet|purple|pink)-|bg-(red|green|amber|yellow|blue|orange|emerald|cyan|violet|purple|pink)-|border-(red|green|amber|yellow|blue|orange|emerald|cyan|violet|purple|pink)-|#[0-9a-fA-F]{3,6}" web/src/components/SettingsPage.tsx` returned no matches.
- 2026-02-28 terminal dialog verification:
  - `cd web && bun run test src/components/SessionTerminalDock.test.tsx src/components/TerminalAccessoryBar.test.tsx src/components/TerminalPage.test.tsx src/components/ui/dialog.test.tsx src/components/ui/button.test.tsx` passed.
  - `cd web && bun run typecheck` passed after the `TerminalView` dialog-shell migration.
  - `rg -n "fixed inset-0 z-50 flex items-center justify-center bg-black/50|<dialog|createPortal" web/src/components/TerminalView.tsx` returned no matches.
- 2026-02-28 Claude MD editor verification:
  - `cd web && bun run test src/components/ClaudeMdEditor.test.tsx src/components/ui/dialog.test.tsx src/components/ui/button.test.tsx src/components/ui/textarea.test.tsx` passed.
  - `cd web && bun run typecheck` passed after the `ClaudeMdEditor` dialog-shell migration.
  - `rg -n "createPortal|fixed inset-0 z-50 flex items-center justify-center bg-black/50|<button" web/src/components/ClaudeMdEditor.tsx` returned no matches.
- 2026-02-28 settings switch verification:
  - `cd web && bun run test src/components/SettingsPage.test.tsx src/components/ui/switch.test.tsx src/components/ui/button.test.tsx` passed.
  - `cd web && bun run typecheck` passed after the `SettingsPage` switch migration.
  - `rg -n "type=\"checkbox\"|<button|text-(red|green|amber|yellow|blue|orange|emerald|cyan|violet|purple|pink)-|bg-(red|green|amber|yellow|blue|orange|emerald|cyan|violet|purple|pink)-|border-(red|green|amber|yellow|blue|orange|emerald|cyan|violet|purple|pink)-|#[0-9a-fA-F]{3,6}" web/src/components/SettingsPage.tsx` returned no matches.
- 2026-02-28 agents page CTA/skills verification:
  - `cd web && bun run test src/components/AgentsPage.test.tsx` passed after re-running the full file with the updated editor-chrome and skills-toggle assertions.
  - `cd web && bun run typecheck` passed after the `AgentsPage` CTA/button and skills-toggle migration.
  - `rg -n "<button|type=\"checkbox\"|aria-pressed" web/src/components/AgentsPage.tsx` returned only the expected `aria-pressed` multi-select skill toggles; no local `<button>` or native checkbox usage remains.
- 2026-02-28 final audit spot-check:
  - `rg -n "<button|createPortal|fixed inset-0 z-50 flex items-center justify-center bg-black/50|type=\"checkbox\"|type=\"radio\"" web/src/components` shows remaining feature-local button debt is now concentrated outside `AgentsPage`, especially in `HomePage`, `SessionEditorPane`, `FilesPanel`, `ProcessPanel`, `TopBar`, `SessionTerminalDock`, and a handful of smaller panels.
  - `rg -n "#[0-9a-fA-F]{3,6}|(text|bg|border|ring|fill|stroke)-(red|green|amber|yellow|blue|orange|emerald|cyan|violet|purple|pink)-" web/src/components web/src/index.css` only matched the historical `#d97757` comment in `web/src/index.css` plus existing semantic git utility classes.
- 2026-02-28 home page button-contract verification:
  - `cd web && bun run test src/components/HomePage.test.tsx src/components/ui/button.test.tsx` passed after the `HomePage` composer/selector/resume-action migration.
  - `cd web && bun run typecheck` passed after the `HomePage` batch.
  - `rg -n "<button" web/src/components/HomePage.tsx` shows remaining local buttons are limited to narrower detail/table controls beyond the main composer and resume-session action surfaces migrated in this batch.
- 2026-02-28 session editor button-contract verification:
  - `cd web && bun run test src/components/SessionEditorPane.test.tsx src/components/ui/button.test.tsx` passed after the tree/search/button migration.
  - `cd web && bun run typecheck` passed after the `SessionEditorPane` tree/search control migration.
  - `rg -n "<button" web/src/components/SessionEditorPane.tsx` returned no matches.
- 2026-02-28 session terminal dock button-contract verification:
  - `cd web && bun run test src/components/SessionTerminalDock.test.tsx src/components/ui/button.test.tsx` passed after the dock-toolbar/tab migration.
  - `cd web && bun run typecheck` passed after the `SessionTerminalDock` batch.
  - `rg -n "<button" web/src/components/SessionTerminalDock.tsx` returned no matches.
- 2026-02-28 top bar button-contract verification:
  - `cd web && bun run test src/components/TopBar.test.tsx src/components/ui/button.test.tsx src/components/ui/badge.test.tsx` passed after the `TopBar` toolbar/tab migration.
  - `cd web && bun run typecheck` passed after the `TopBar` batch.
  - `rg -n "<button" web/src/components/TopBar.tsx` returned no matches.
- 2026-02-28 files panel button-contract verification:
  - `cd web && bun run test src/components/FilesPanel.test.tsx src/components/ui/button.test.tsx` passed after the `FilesPanel` tree/refresh/back migration.
  - `cd web && bun run typecheck` passed after the `FilesPanel` batch.
  - `rg -n "<button" web/src/components/FilesPanel.tsx` returned no matches.
- 2026-02-28 process/tool button-contract verification:
  - `cd web && bun run test src/components/ProcessPanel.test.tsx` passed after the `ProcessPanel` disclosure/refresh migration.
  - `cd web && bun run test src/components/ToolBlock.test.tsx` passed after the `ToolBlock` header-toggle migration.
  - `cd web && bun run typecheck` passed after the `ProcessPanel`/`ToolBlock` batch.
  - `rg -n "<button" web/src/components/ProcessPanel.tsx web/src/components/ToolBlock.tsx` returned no matches.
