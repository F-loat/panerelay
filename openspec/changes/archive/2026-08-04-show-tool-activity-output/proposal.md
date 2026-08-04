## Why

Completed Side Panel tool cards can be expanded, but successful ACP tool content is discarded before it reaches the shared conversation model. Users therefore see the full command again without the command output or other displayable text result needed to verify what happened.

## What Changes

- Add a bounded optional output field to normalized conversation activity, separate from the existing title and failure-detail fields.
- Preserve text content that Qoder or OpenCode explicitly publishes as ACP tool-call content for a completed tool, while continuing to exclude images, terminal handles, `rawInput`, `rawOutput`, metadata, and provider-native objects.
- Show successful tool output only in the expanded terminal activity card as wrapped, selectable monospaced text; keep the compact card unchanged.
- Retain bounded failure diagnostics as `detail` and do not reinterpret successful output as an error.

Non-goals:

- This change does not expose arbitrary ACP raw output, retrieve output from provider-owned terminal handles, persist a new tool-output log, or promise output when an Agent does not publish displayable text content.
- It does not change browser authorization, control ownership, provider approval, tab scope, or browser automation behavior.
- It does not change the agent-browser 0.33.0, Browser Use 0.13.7 / Browser Harness 0.1.8, or Playwright CLI 0.1.17 compatibility groups.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `conversation-history-workflow`: Expanded terminal activity can show bounded provider-supplied output separately from the full command and diagnostic detail.
- `qoder-agent-provider`: Successful Qoder ACP tool-call text content is normalized into the shared activity output field without forwarding raw payloads.
- `opencode-agent-provider`: Successful OpenCode ACP tool-call text content follows the same provider-neutral output boundary.
- `agent-error-details`: Successful output remains excluded from diagnostic detail while the shared activity model may carry it in a separate bounded field.

## Impact

- Shared protocol: additive optional `ConversationActivity.output` field.
- Bridge: ACP tool-call content normalization and bounds.
- Extension: terminal activity disclosure rendering and styling.
- Tests: protocol/Bridge provider normalization and Side Panel component coverage.
- No external dependency, RFC, browser compatibility record, or release boundary changes.
