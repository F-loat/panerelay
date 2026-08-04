## 1. Provider Preparation

- [x] 1.1 Add `agent.prepare` to the shared protocol, provider interface, AgentService routing, and contract tests.
- [x] 1.2 Make Codex preparation idempotently initialize app-server without creating a conversation, with concurrency tests.
- [x] 1.3 Make Qoder discovery side-effect free and preparation idempotently initialize ACP, with readiness, capability, retry, and concurrency tests.

## 2. Extension Workspace Authority

- [x] 2.1 Add Extension-private workspace types and a queued `chrome.storage.session` store with opaque revisions, drafts, group replacement, removal, and conflict tests.
- [x] 2.2 Inherit workspaces through Chrome-reported related-tab events, add the manifest permission, and test duplicate, unrelated, conflict, and last-related-tab lifecycle cases. The final inheritance signal is narrowed in 6.4.
- [x] 2.3 Add workspace-aware Side Panel messages and background orchestration for get, reset, resume, and first-send flows, including stale active-tab and optimistic-revision tests.

## 3. Side Panel Workflow

- [x] 3.1 Update the React controller to restore active-tab workspaces, cache inactive conversation details, react to activation broadcasts, and discard stale async results.
- [x] 3.2 Prewarm the selected ready provider without listing or resuming history and expose contextual retry/install guidance without changing global Extension status.
- [x] 3.3 Replace the history select with a lazy recent-history popover covering load, search, empty, error, retry, and explicit resume states.
- [x] 3.4 Make new conversation create a local draft, interrupt a running turn before reset, and create/bind/send exactly once on the first non-empty message.
- [x] 3.5 Add controller and component coverage for initialization, provider switching, related-tab restoration, history selection, stale responses, and draft-first sends.
- [x] 3.6 Show a transient animated starting/working state during slow sends, clear it on visible or terminal Agent feedback, and cover the lifecycle in component tests.
- [x] 3.7 List non-archived Codex history across source kinds and working directories, with Bridge adapter regression coverage.

## 4. Architecture and Compatibility

- [x] 4.1 Update RFC-0001 with the provider-preparation and Extension-private tab-workspace decisions without changing authorization or lease ownership.
- [x] 4.2 Document the `webNavigation` permission purpose and update the agent-browser `0.33.0` compatibility groups and verification status.

## 5. Validation and Cleanup

- [x] 5.1 Run formatting, targeted package tests, strict OpenSpec validation, the full workspace check, and `git diff --check`.
- [x] 5.2 Reload the unpacked Extension in daily Chrome; verify provider warm-up and model display, lazy history, Skill-guided draft-first send, active-tab restoration, page-created target inheritance, browser-created new-tab isolation, per-tab new-conversation detachment, scroll following, revocation isolation, and narrow/wide layouts; remove temporary tabs, state, and screenshots. Daily-Chrome smoke evidence covers Host restart, model/Skill behavior, browser-created-tab isolation, and narrow/wide rendering; deterministic background and component suites cover the remaining inheritance, detachment, scroll, revocation, and disclosure cases. Temporary QA tabs and screenshots were removed.

## 6. Model, Guidance, Isolation, and Scrolling

- [x] 6.1 Add optional effective-model metadata to normalized provider and conversation summaries; populate Codex configured or catalog-default/start/resume results and ACP session model options with bounded parsing and contract tests.
- [x] 6.2 Refresh prepared provider metadata and show the conversation model only when the selected installed provider reports it, omitting unknown or unavailable-provider model copy, with component coverage.
- [x] 6.3 Add canonical `$panerelay-browser` preference, attempted `npx skills` installation, and explicit last-resort browser-tool fallback guidance to every new-conversation context, preserving sanitized untrusted page metadata and adapter tests.
- [x] 6.4 Restrict workspace inheritance to `webNavigation.onCreatedNavigationTarget`, make reset detach only the active tab into a new group, and cover browser-created tabs, sibling preservation, first-send isolation, and stale conflicts.
- [x] 6.5 Replace post-render distance-only scrolling with explicit bottom affinity, forced follow on send/workspace change, and component tests for streaming at bottom versus reading older content.
- [x] 6.6 Read existing agent-browser and CLI-adapter registrations into a bounded staleable setup hint, inject it into every provider's new-conversation context, and update `$panerelay-browser` to skip generic preflight checks on the fast path with targeted fallback coverage.
- [x] 6.7 Make completed, failed, and declined activity cards expandable with full raw title/command and detail content, a visible disclosure affordance, status-appropriate styling, and component coverage including terminal records without secondary detail.

## 7. Revised Architecture and Validation

- [x] 7.1 Update RFC-0001 and the permission/compatibility wording for navigation-target-only inheritance, per-tab detachment, optional model metadata, Skill guidance, and unchanged authorization/control ownership.
- [x] 7.2 Run formatting, targeted protocol/Bridge/Extension tests, strict OpenSpec validation, the full workspace check, and `git diff --check` after the revised implementation.
