## Why

Panerelay's side panel supports local Codex and Qoder runtimes, but users who work with Claude Code cannot reuse the same project-aware conversation, approval, and browser-control surface.

## What Changes

- Add a `claude` Agent Provider backed by the official Claude Agent SDK.
- Discover the local Claude Code executable during setup and report its absence as an optional warning.
- Normalize bounded history, streaming text and reasoning, tool activity, usage, approvals, interruption, and terminal results into the existing provider-neutral protocol.
- Give each Claude turn an optional participant-scoped Panerelay browser MCP server and close that browser participant at terminal cleanup.
- Add side-panel provider discovery and targeted install/login guidance.
- Add compatibility evidence and release validation for the packaged Claude Agent SDK.

## Capabilities

### New Capabilities

- `claude-code-agent-provider`: Local Claude Code discovery, project-scoped sessions, conversation streaming, approvals, interruption, resume, and scoped browser tools.

### Modified Capabilities

- `guided-browser-readiness`: Missing Claude Code receives provider-specific setup guidance.
- `stable-distribution`: Claude Code remains optional and the Bridge package proves its supported SDK dependency.

## Impact

- Affects `packages/bridge`, `packages/protocol`, `packages/setup`, the Extension side panel, release validation, and compatibility documentation.
- Adds `@anthropic-ai/claude-agent-sdk` as a packaged Bridge runtime dependency.
- Does not change browser authorization, control-lease, or credential-storage boundaries.
