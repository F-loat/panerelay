## Why

Qoder and OpenCode share an ACP adapter that currently persists Panerelay's internal conversation context as part of the first user message and applies the ordinary 30-second RPC timeout to the entire streamed prompt turn. As a result, resumed history can expose internal guidance and otherwise healthy long-running turns can be reported as failed while the Agent continues running.

## What Changes

- Preserve the existing ACP first-turn text semantics and ordering, wrap Panerelay-authored guidance and page metadata in the exact `<panerelay-context version="1">` / `</panerelay-context>` boundary, and keep the user's text and images unchanged.
- Normalize loaded ACP history so Panerelay-injected context is never presented as a user message, including a narrowly matched compatibility path for existing sessions created by prior Panerelay versions.
- Keep the existing bounded timeout for short ACP control-plane requests, but allow `session/prompt` to remain active until ACP completion, explicit user interruption, runtime exit, or provider shutdown.
- Ensure timeout, cancellation, runtime exit, and late-update paths settle a turn exactly once and do not leave a detached Agent turn running after Panerelay reports failure.
- Add deterministic Qoder and OpenCode regressions plus version-specific compatibility documentation for context transport, history privacy, long turns, and interruption.
- Preserve agent-browser 0.33.0 guidance, page orientation, provider-owned browser tools, browser authorization, and control-lease behavior.

Non-goals:

- Panerelay will not inject or take ownership of Qoder/OpenCode browser tools, MCP servers, or automation sessions.
- This change will not alter site permission, tab authorization, control leases, provider permission policy, or the shared browser relay.
- This change will not patch, fork, or infer unsupported behavior from Qoder, OpenCode, the ACP SDK, or agent-browser.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `qoder-agent-provider`: Preserve user-visible prompt content and allow valid long-lived ACP turns while retaining first-turn context and cancellation behavior.
- `opencode-agent-provider`: Preserve user-visible prompt content and allow valid long-lived ACP turns while retaining first-turn context and cancellation behavior.
- `conversation-history-workflow`: Keep provider-neutral guidance and page context out of resumed user-visible history without dropping real user messages.

## Impact

- Affected Bridge code: shared ACP prompt construction, history capture normalization, prompt lifecycle, cancellation, and provider tests.
- Affected providers: Qoder CLI 1.1.2 compatibility group and OpenCode 1.18.12 compatibility group; later versions remain capability-negotiated.
- Affected documentation: ACP/Qoder/OpenCode compatibility evidence and the agent-browser 0.33.0 context-transport note.
- Public protocol and Extension request shapes remain unchanged. No dependency patch or browser-ownership change is required.
