## Why

The Side Panel currently creates or resumes Agent sessions before the user has chosen a conversation, treats history as a single eager continuation, and has no durable relationship between a Chrome tab and the conversation working on it. Before `0.1.0`, PaneRelay needs a clearer workspace model so switching tabs, starting fresh work, and returning to history are predictable without creating empty Agent threads.

## What Changes

- Add explicit, idempotent provider preparation so selecting a ready provider can warm its local runtime without creating a conversation.
- Make conversation history an on-demand picker with search; opening the Side Panel or changing providers no longer automatically resumes the newest conversation.
- Make “new conversation” reset the active tab to a local draft and defer Agent session creation until the first message is sent.
- Associate each controlled Chrome tab with at most one provider conversation, restore that workspace when the active tab changes, and let related tabs inherit the source workspace when Chrome exposes a trusted opener relationship.
- Keep tab identifiers Extension-private and fail closed when stale Side Panels or conflicting bindings attempt to replace a newer workspace.
- Update RFC-0001 and compatibility documentation for the provider lifecycle and tab-workspace ownership decisions.

Non-goals:

- PaneRelay will not synchronize conversations across browser profiles, computers, or Chrome restarts in `0.1.0`.
- A focused tab will not gain authorization or a control lease, and switching tabs will not move an Agent's browser-control lease.
- PaneRelay will not invent opener relationships for unrelated tabs or expose raw Chrome tab IDs through the shared protocol.
- This change does not add provider-side pagination or change agent-browser command semantics.

## Capabilities

### New Capabilities

- `agent-provider-preparation`: Warm a selected Agent provider independently from conversation creation, with idempotent retries and contextual failure handling.
- `conversation-history-workflow`: Load and search history on demand, explicitly resume a chosen conversation, and create a draft that starts only on first send.
- `tab-conversation-workspaces`: Bind conversations to Extension-private Chrome tab workspaces, restore them on tab activation, inherit trusted related tabs, and reject stale conflicts.

### Modified Capabilities

None.

## Impact

- Shared protocol and Bridge provider contract gain an `agent.prepare` request.
- Codex and Qoder providers separate cheap discovery from runtime startup; the Qoder descriptor no longer starts its ACP runtime.
- Extension background state, Side Panel controller/components, Chrome event handling, and tests gain tab-workspace behavior.
- RFC-0001 will record the durable provider preparation and Extension-private workspace ownership model. The agent-browser minimum remains `0.33.0`; the affected compatibility groups are provider selection, browser-level handshake, tab creation/switching, and control-session lifecycle. No agent-browser CLI command or Provider compatibility boundary changes.
