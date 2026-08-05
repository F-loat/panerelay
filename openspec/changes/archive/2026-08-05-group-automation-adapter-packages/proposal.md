## Why

The three publishable browser automation adapters currently sit beside Panerelay's core packages, which obscures the intended boundary between engine-specific integrations and shared routing, policy, setup, and protocol code. Grouping them under one directory makes that boundary explicit before additional adapters are added, without changing their public package identities or behavior.

## What Changes

- Move `@panerelay/agent-browser`, `@panerelay/browser-use`, and `@panerelay/playwright` into `packages/adapters/` while preserving each package as an independent publishable workspace package.
- Update workspace discovery, TypeScript and test paths, setup bundling, release inventories, local development configuration, package metadata, lockfile importer paths, and current documentation links.
- Define the grouped packages as browser automation Adapters, distinct from Agent Providers such as Codex, Qoder, Claude Code, and OpenCode.
- Preserve lockstep package names, versions, exports, binaries, compatibility classifications, and runtime behavior.

## Non-goals

- Do not merge the three packages or introduce a shared adapter abstraction.
- Do not move Agent Provider implementations or core packages such as the Bridge, protocol, browser registry, CLI, or setup package.
- Do not change CDP behavior, browser attachment, authorization, control ownership, target lifecycle, browser-process ownership limitations, or unsupported capability classifications.
- Do not change the pinned agent-browser 0.33.0 baseline or the Browser Use 0.13.7 / Browser Harness 0.1.8 and Playwright CLI 0.1.17 compatibility groups.

## Capabilities

### New Capabilities

None. This is a repository-only refactor and the change opts out of delta specs.

### Modified Capabilities

None. No specified product behavior changes.

## Impact

Affected areas include the three adapter package directories, pnpm workspace and lockfile paths, setup's private adapter bundling, release and CI path allowlists, local agent-browser configuration, repository metadata, current RFC repository layout text, spikes, and public documentation links. Public npm package names and package-name imports remain unchanged, and no external dependency is added or modified.
