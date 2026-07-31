## Why

Packaging the Claude Agent SDK makes every `@panerelay/bridge` and `@panerelay/setup` installation pull a platform-specific Claude binary of roughly 257 MB, even when the user does not enable Claude Code. Panerelay already requires a user-owned `claude` executable for readiness, so the duplicated runtime cost is unnecessary.

## What Changes

- Remove `@anthropic-ai/claude-agent-sdk` and its platform binaries from Panerelay's packaged dependencies.
- Execute the discovered global Claude Code CLI directly in documented headless `stream-json` mode.
- Normalize CLI input/output, session resume, tool approval, interruption, and browser MCP integration behind the existing provider-neutral Bridge contract.
- Add a minimum supported Claude Code CLI version and deterministic CLI protocol fixtures to release and compatibility validation.
- Keep Claude Code optional; Panerelay reports installation/login guidance but does not install or update Claude Code without an explicit user action.
- Non-goals: importing packages from global npm roots, implementing Anthropic's model protocol, storing Anthropic credentials, widening browser authorization, or changing agent-browser 0.33.0 ownership and control behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `claude-code-agent-provider`: Replace the packaged SDK runtime with the discovered user-owned Claude Code CLI while preserving bounded history, streaming, approvals, interruption, resume, and scoped browser tools.
- `stable-distribution`: Require release artifacts to exclude the Claude Agent SDK and its platform binaries while documenting and checking the supported Claude Code CLI floor.

## Impact

- Affects `packages/bridge`, setup discovery/version checks, release validation, Claude compatibility documentation, and deterministic provider tests.
- Reduces the default setup/Bridge dependency footprint by removing the SDK and its matching platform binary.
- Does not change the shared protocol, Extension provider UX, Chrome authorization, control leases, or the agent-browser 0.33.0 compatibility group.
