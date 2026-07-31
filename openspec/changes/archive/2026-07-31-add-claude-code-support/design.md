## Context

Panerelay already exposes provider-neutral Agent conversations through the Extension and Bridge. Claude Code has an official Agent SDK with query, session-history, streaming, permission, interruption, and MCP integration surfaces, but those provider-native payloads must remain inside the Bridge.

## Goals / Non-Goals

**Goals:**

- Expose Claude Code through the existing side-panel Agent contract.
- Preserve project working directories and stored Claude session identities.
- Keep tool approvals explicitly correlated and fail closed.
- Reuse Panerelay's scoped agent-browser Provider without granting browser authority from Agent selection.

**Non-Goals:**

- Store Anthropic credentials or model configuration in the Extension.
- Persist raw SDK payloads in the Panerelay protocol.
- Apply Claude permission suggestions or create session-wide approval rules.
- Claim a signed-in live Claude run from deterministic SDK-facade tests.

## Decisions

### Keep the official SDK behind an injectable facade

The Bridge imports the official SDK dynamically through a narrow facade. Production uses the packaged SDK; tests inject deterministic query and history implementations without model credentials.

### Normalize provider-native events at the Bridge

Claude stream records, messages, tool uses, results, and usage stay inside the provider. The Extension receives only bounded provider-neutral events already understood by the shared conversation UI.

### Scope history and turns to canonical working directories

Conversation listing accepts an optional working directory. New and resumed turns retain the canonical project directory selected by the user and never accept a page-controlled directory.

### Treat each approval as one request

Each `canUseTool` callback becomes one correlated approval. One-request accept, decline, and cancel resolve only that callback. Session-wide decisions and permission suggestions are rejected.

### Reuse a participant-scoped browser MCP server

When agent-browser is available, a Claude turn receives an MCP server that invokes the Panerelay Provider with its private config. The provider closes the scoped browser session before emitting the terminal event, including interruption and failure paths.

### Keep Claude Code optional

Setup records a usable `claude` path and bounded version when available. Doctor and the Extension report absence as a warning without affecting Codex, Qoder, or browser automation.

## Risks / Trade-offs

- SDK API drift can break the adapter, so release validation pins a supported minimum and deterministic tests cover the facade contract.
- A signed-in runtime is environment-dependent, so compatibility claims distinguish deterministic verification from forwarded live execution.
- Claude session history can contain sensitive data, so normalization is bounded and raw transcript records are not logged.
