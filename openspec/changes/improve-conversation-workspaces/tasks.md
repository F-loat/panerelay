## 1. Provider Preparation

- [x] 1.1 Add `agent.prepare` to the shared protocol, provider interface, AgentService routing, and contract tests.
- [x] 1.2 Make Codex preparation idempotently initialize app-server without creating a conversation, with concurrency tests.
- [x] 1.3 Make Qoder discovery side-effect free and preparation idempotently initialize ACP, with readiness, capability, retry, and concurrency tests.

## 2. Extension Workspace Authority

- [x] 2.1 Add Extension-private workspace types and a queued `chrome.storage.session` store with opaque revisions, drafts, group replacement, removal, and conflict tests.
- [x] 2.2 Inherit workspaces only through `tabs.onCreated` opener relationships and `webNavigation.onCreatedNavigationTarget`, add the manifest permission, and test duplicate, unrelated, conflict, and last-related-tab lifecycle cases.
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
- [ ] 5.2 Reload the unpacked Extension in daily Chrome; verify provider warm-up, lazy history, draft-first send, active-tab restoration, related-tab inheritance, revocation isolation, and narrow/wide layouts; remove temporary tabs, state, and screenshots.
