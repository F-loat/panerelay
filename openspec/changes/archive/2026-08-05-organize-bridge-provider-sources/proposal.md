## Why

Codex, Claude Code, Qoder, and OpenCode integrations are Agent Providers owned by the Bridge, but their implementation files currently share the Bridge source root with routing, configuration, and host-service modules. Grouping the Provider implementations by runtime makes ownership and navigation clearer without creating package boundaries that the current dependency graph and release model do not support.

## What Changes

- Add `packages/bridge/src/providers/` as the internal home for the shared Provider contract and runtime-specific Provider implementations.
- Group Codex, Claude Code, ACP, Qoder, and OpenCode modules and their tests into runtime subdirectories.
- Update Bridge consumers, cross-Provider imports, generated artifact expectations, and release inventories for the new source and output paths.
- Clarify current RFC terminology so agent-runtime integrations are consistently called Agent Providers rather than Provider adapters.
- Keep Agent Providers compiled and bundled as part of `@panerelay/bridge`; no independent workspace package, public export, version, or runtime registry is introduced.

## Non-goals

- Do not move Provider implementations into `packages/providers/` or publish them independently.
- Do not change Provider discovery, executable probing, session lifecycle, conversation normalization, approvals, interruption, history, browser guidance, or diagnostics.
- Do not move Bridge-owned host modules such as `agent-service`, runtime configuration, platform discovery, agent context, browser automation hints, or conversation image handling.
- Do not change protocol, permission, control-lease, browser attachment, compatibility, or release behavior.

## Capabilities

### New Capabilities

None. This is an internal source-layout refactor and the change opts out of delta specs.

### Modified Capabilities

None. No specified product behavior changes.

## Impact

Affected areas are Bridge TypeScript source and test paths, internal imports, compiled Bridge output paths, deterministic release artifact checks, and current RFC terminology. Public package names, Bridge entry points, native-host bundle behavior, setup configuration, compatibility classifications, and external dependencies remain unchanged.
