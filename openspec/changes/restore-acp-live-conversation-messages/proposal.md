## Why

Closing and reopening the Side Panel destroys its mount-local timeline cache. Qoder 1.1.2 can successfully load the still-live ACP session without replaying historical message chunks, so Panerelay currently replaces the restored view with an empty message list even though the Bridge observed the completed turn.

## What Changes

- Retain a bounded user/assistant transcript in memory for live ACP conversations while their Bridge provider process remains active.
- When an ACP load or resume returns no message history for a conversation already known to that provider process, return the retained normalized transcript instead of an empty history.
- Keep provider-replayed history authoritative when it is available, and refresh the in-memory transcript from that normalized history.
- Add regressions for Qoder and the shared ACP adapter covering Side Panel close/reopen semantics and context-envelope privacy.
- Document the Qoder 1.1.2 and OpenCode 1.18.12 compatibility behavior.
- Non-goals: persisting prompts or replies to disk or Extension storage; reconstructing reasoning, activity cards, approvals, images, or an in-progress partial assistant message; restoring across Bridge or browser restart; changing ACP, Native Messaging, browser attachment, authorization, target selection, or control ownership.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tab-conversation-workspaces`: Reopening the Side Panel for a bound tab restores the live conversation's retained user/assistant messages when provider history replay is empty.
- `qoder-agent-provider`: A Qoder session known to the current Bridge process uses bounded in-memory messages as a resume fallback when Qoder 1.1.2 emits no history chunks.
- `opencode-agent-provider`: The shared ACP behavior keeps OpenCode provider history authoritative while providing the same bounded live-session fallback when replay is empty.

## Impact

- Affects the shared ACP provider session state and Qoder/OpenCode provider tests in `packages/bridge`, plus Side Panel restoration coverage in `apps/extension` if required by the resulting contract.
- Updates compatibility evidence for Qoder 1.1.2 and OpenCode 1.18.12. The pinned agent-browser 0.33.0, Browser Use, Playwright CLI, browser ownership, authorization, and control-lease behavior are unchanged.
- Adds no dependency and no persistent content store. Retained text is bounded by the existing provider-neutral message limits and is cleared with the provider process.
