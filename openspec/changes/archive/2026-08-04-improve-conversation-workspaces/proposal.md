## Why

The Side Panel currently creates or resumes Agent sessions before the user has chosen a conversation, treats history as a single eager continuation, and has no durable relationship between a Chrome tab and the conversation working on it. Its header also hides the effective model, its initial Agent context does not guide browser work through the supported Skill, and its message list can stop following output even when the user was already at the bottom. Before `0.1.0`, PaneRelay needs a clearer workspace and conversation model so switching tabs, starting fresh work, understanding the active runtime, and following streamed output are predictable without creating empty Agent threads.

## What Changes

- Add explicit, idempotent provider preparation so selecting a ready provider can warm its local runtime without creating a conversation.
- Make conversation history an on-demand picker with search; opening the Side Panel or changing providers no longer automatically resumes the newest conversation.
- Make “new conversation” reset the active tab to a local draft and defer Agent session creation until the first message is sent.
- Associate each controlled Chrome tab with at most one provider conversation, restore that workspace when the active tab changes, and let only page-created navigation targets inherit the source workspace.
- Detach only the active tab when a user starts a new conversation so related tabs keep their existing conversation.
- Surface the effective model in the Side Panel only when the selected installed provider reports it; omit model copy when it is not known.
- Add provider-neutral browser-work guidance to new conversations: prefer `$panerelay-browser`, attempt its canonical `npx skills` installation when unavailable, permit another browser tool only after installation cannot complete, and use existing Panerelay integration registrations as a cached fast-path hint instead of repeating generic environment diagnostics before every browser task.
- Keep streamed output pinned when the user was following the bottom, while preserving the reading position after the user scrolls upward.
- Make completed and failed activity cards expandable so their full original command/title and detail remain readable when the compact card truncates them.
- Keep tab identifiers Extension-private and fail closed when stale Side Panels or conflicting bindings attempt to replace a newer workspace.
- Update RFC-0001 and compatibility documentation for the provider lifecycle and tab-workspace ownership decisions.

Non-goals:

- PaneRelay will not synchronize conversations across browser profiles, computers, or Chrome restarts in `0.1.0`.
- A focused tab will not gain authorization or a control lease, and switching tabs will not move an Agent's browser-control lease.
- PaneRelay will not invent opener relationships for unrelated tabs or expose raw Chrome tab IDs through the shared protocol.
- PaneRelay will not select or reconfigure provider models from the Side Panel, enumerate unrelated Skills, or install the Skill without an explicit user action.
- This change does not add provider-side pagination or change agent-browser command semantics.

## Capabilities

### New Capabilities

- `agent-provider-preparation`: Warm a selected Agent provider independently from conversation creation, with idempotent retries, contextual failure handling, and optional effective-model metadata.
- `conversation-history-workflow`: Load and search history on demand, explicitly resume a chosen conversation, create a draft that starts only on first send, guide browser work through the supported Skill, and follow live output without overriding deliberate upward scrolling.
- `tab-conversation-workspaces`: Bind conversations to Extension-private Chrome tab workspaces, restore them on tab activation, inherit only page-created related tabs, detach one tab for a fresh conversation, and reject stale conflicts.

### Modified Capabilities

None.

## Impact

- Shared protocol and Bridge provider contract gain an `agent.prepare` request plus optional effective-model metadata on provider and conversation summaries.
- Codex and Qoder providers separate cheap discovery from runtime startup; the Qoder descriptor no longer starts its ACP runtime.
- Bridge conversation context gains bounded Skill guidance without inspecting the user's installed Skills. It may also summarize the Bridge-readable agent-browser Provider and CLI-adapter registrations as explicitly staleable setup hints; those hints neither expose configuration paths nor represent current tab authorization or control. Extension background state, Side Panel controller/components, Chrome event handling, and tests gain tab-workspace, model-label, and scroll-following behavior.
- RFC-0001 will record the durable provider preparation and Extension-private workspace ownership model. The agent-browser minimum remains `0.33.0`; the affected compatibility groups are provider selection, browser-level handshake, tab creation/switching, and control-session lifecycle. No agent-browser CLI command or Provider compatibility boundary changes.
