## Context

See [proposal.md](proposal.md) for motivation and the three capability specs for observable behavior. Today the Side Panel calls `conversation.list` during initialization, resumes the first result, and calls `conversation.start` as soon as “new conversation” is chosen. The background forwards those requests without active-tab context. Provider discovery is also inconsistent: Codex reads configuration only, while Qoder starts and initializes its ACP process from `getDescriptor()`.

RFC-0001 already assigns provider lifecycle to the Bridge, defines a conversation-to-related-tabs relationship, keeps raw Chrome tab IDs outside the public protocol, and separates chat availability from authorization and control leases. This change fills in those accepted boundaries; it does not change RFC-0002's browser-level CDP ownership or RFC-0003's lease lifecycle.

Mearl is used as a behavioral reference for provider warm-up, session-scoped tab mappings, trusted opener inheritance, and stale-binding rejection. PaneRelay will implement the behavior against its own protocol and architecture rather than copying Mearl source.

## Goals / Non-Goals

**Goals:**

- Keep provider discovery cheap and expose runtime preparation as an explicit Bridge operation.
- Make the background service worker the authority for the active tab's conversation workspace.
- Make every asynchronous Side Panel transition conditional on an opaque workspace revision.
- Preserve a conversation across trusted related tabs without leaking Chrome tab IDs to the Bridge/provider protocol.
- Keep the first-send path free of intentionally persisted empty conversations.

**Non-Goals:**

- Persist prompts, draft text, or tab mappings beyond the current Chrome session.
- Close provider-native history merely because the last bound Chrome tab closes.
- Add server-side history pagination or a cross-profile synchronization service.
- Change agent-browser `0.33.0` command semantics or treat a workspace as a control lease.

## Decisions

### 1. Add `agent.prepare` to the provider-neutral Bridge contract

`AgentProvider` gains `prepare(): Promise<void>`, and `AgentRequest` gains `{ method: "agent.prepare"; providerId }`. `AgentService` forwards preparation independently from conversation operations. Each adapter deduplicates its own in-flight startup and makes subsequent calls idempotent.

Codex preparation starts/initializes app-server. Qoder preparation resolves the executable and starts/initializes ACP. Qoder discovery resolves the executable/version only; before ACP is prepared, capability flags that require negotiation remain conservative. Once prepared, discovery can report negotiated capabilities.

The Side Panel fire-and-forgets preparation for the selected ready provider. It tracks `idle/preparing/ready/error` per provider and exposes a contextual retry, but a failure does not write `ExtensionStatus.error`.

Alternative considered: keep using `conversation.list` as warm-up. Rejected because it conflates runtime availability with history, creates avoidable work at panel startup, and cannot warm a provider that does not support history listing.

### 2. Keep history lazy and drafts local

Initialization discovers providers, restores the active workspace snapshot, and prepares the selected provider; it does not list provider history. The history button opens a dedicated popover whose first open loads recent summaries. The popover owns loading, empty, error, retry, and client-side title/identifier search states. Provider changes invalidate the loaded history cache. Codex recent history is provider-wide: the Bridge excludes archived threads but does not constrain `thread/list` by source kind or working directory, so conversations started from Codex CLI, Codex App, and other compatible Codex clients remain resumable from Panerelay.

“New conversation” asks the background to reset the active workspace to a draft. If a turn is running, the Side Panel first interrupts it. No provider conversation is created at reset time. The first non-empty send creates the conversation, binds it to the captured workspace, and sends the message. While that request is waiting for creation, the timeline renders a transient animated status alongside the optimistic user message. Once the send returns a turn identifier, the status changes to an Agent-working state and disappears when provider output, approval, or terminal state provides the relevant feedback. This status is derived from controller state and never enters the provider message model or stored history.

Alternative considered: pre-create a session after a typing debounce, as Mearl can do for ephemeral sessions. Rejected because PaneRelay's current providers expose durable sessions and would leave empty Codex/Qoder history entries.

### 3. Store tab workspaces in `chrome.storage.session`

The background stores records keyed by raw Chrome tab ID under a versioned session-storage key. Each record contains:

- an opaque random `groupId` shared by related tabs;
- a random `revision` used for optimistic concurrency;
- `providerId`;
- either `kind: "draft"` or `kind: "conversation"` plus `conversationId`.

Raw tab IDs and `groupId` never enter `@panerelay/protocol`, provider metadata, prompts, or activity events. Side Panel messages may carry only a `WorkspaceSnapshot` with its opaque revision, provider, kind, and optional conversation ID.

Session storage survives MV3 service-worker suspension but is cleared with the Chrome session, matching the capability spec. An in-memory fallback keeps deterministic tests and older environments safe.

Alternative considered: store bindings in the Bridge. Rejected for `0.1.0` because the Bridge would need raw browser-tab identity or a new bidirectional opaque mapping, while the Extension already observes Chrome lifecycle and is the correct authority for per-session UI state.

### 4. Serialize workspace mutations and require the expected revision

All workspace reads and writes run through one background queue. Mutating Side Panel requests include the snapshot revision they were rendered from. The background captures the active tab at request start, verifies the expected revision, and reserves a new revision before awaiting provider work. It commits or rolls back only if that reservation is still current.

Responses include the resulting snapshot. The React controller also increments a local activation generation and discards async results from a prior active tab. A request that began on tab A may finish and update tab A, but it cannot overwrite or render into newly active tab B.

The draft first-send orchestration remains Extension-private: reserve workspace, start one provider conversation, bind the original tab group, send the message, then return detail/turn/revision. Existing conversations use the normal `conversation.send` operation. If provider start succeeds but binding cannot commit because a conflicting newer mutation exists, PaneRelay fails closed and does not send the prompt; this rare orphan is reported rather than attached to the wrong tab.

Alternative considered: let the Side Panel call start, bind, and send as three independent steps. Rejected because a tab switch between steps can attach a prompt or conversation to the wrong workspace.

### 5. Related tabs inherit only Chrome-reported source relationships

The background observes both `chrome.tabs.onCreated` with `openerTabId` and `chrome.webNavigation.onCreatedNavigationTarget`. When either reports source tab A and new eligible tab B, B copies A's current record unless B already belongs to another group. Duplicate reports are idempotent. This requires adding the non-content-reading `webNavigation` permission and documenting its use for trusted related-tab discovery.

Closing a tab removes only that record. Other records with the same `groupId` remain bound, so a conversation survives until the group's last tab closes or a user replaces the group workspace. An unrelated new tab has no record and receives a fresh draft snapshot on activation.

Alternative considered: infer relationships from window focus, timing, or matching origins. Rejected because those signals are ambiguous and focus must never create authorization or ownership.

### 6. Workspace activation is event-driven and cache-aware

On tab activation, the background broadcasts the active tab's current `WorkspaceSnapshot`. A conversation snapshot causes the Side Panel to display a cached detail when available, otherwise it explicitly resumes that conversation. Draft snapshots display an empty timeline. Related tabs sharing a group therefore reuse the same cached detail without repeatedly resuming Qoder/Codex.

Conversation events continue to carry only conversation IDs. The controller applies them only to the matching active conversation and retains cached state for inactive workspaces.

## Risks / Trade-offs

- **[Risk] `webNavigation` adds a Chrome Web Store permission explanation.** → Limit its use to `onCreatedNavigationTarget`, document that it neither reads page content nor grants site access, and cover manifest identity/permission tests.
- **[Risk] A provider can create a conversation just before a reserved binding loses a conflict.** → Do not send the prompt or attach it elsewhere; surface the failure and cover the conflict path. Provider-native deletion is deliberately not assumed.
- **[Risk] Resuming many distinct tab conversations retains provider sessions.** → Cache active details in the Side Panel and reuse provider sessions; provider-wide cleanup still occurs when the Bridge closes. Per-conversation eviction is deferred.
- **[Risk] MV3 suspension can interrupt a queued mutation.** → Persist every committed or reserved record in `chrome.storage.session`. A reservation retains the prior draft or conversation payload under a fresh opaque revision, so a later Side Panel instance can safely restore it without repeating the abandoned provider request.
- **[Trade-off] History search covers the bounded provider result only.** → Label it as recent history and defer provider pagination until the protocol has a common cursor contract.
- **[Trade-off] Typed draft text is not persisted.** → Keep it only in the live React controller to avoid storing prompts; a Side Panel reload may clear unsent text.
- **[Trade-off] Provider startup exposes no fine-grained progress events.** → Show honest local phases (“starting conversation” and “working”) with animation rather than inventing percentage progress or provider steps.

## Migration Plan

1. Add protocol/provider preparation support and tests without changing current Side Panel calls.
2. Add the Extension-private workspace store, Chrome observers, message contracts, and deterministic conflict/lifecycle tests.
3. Switch the React controller and UI to lazy history, draft-first new conversations, preparation, and workspace activation.
4. Update RFC-0001, the extension permission description, and agent-browser `0.33.0` compatibility notes. Existing provider conversations remain resumable; no persisted tab mapping is migrated.
5. Rollback removes the session-storage key and `webNavigation` permission. Provider-native conversations are unaffected.
