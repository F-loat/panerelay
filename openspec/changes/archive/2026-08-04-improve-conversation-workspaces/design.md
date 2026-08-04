## Context

See [proposal.md](proposal.md) for motivation and the three capability specs for observable behavior. Today the Side Panel calls `conversation.list` during initialization, resumes the first result, and calls `conversation.start` as soon as “new conversation” is chosen. The background forwards those requests without active-tab context. Provider discovery is also inconsistent: Codex reads configuration only, while Qoder starts and initializes its ACP process from `getDescriptor()`.

RFC-0001 already assigns provider lifecycle to the Bridge, defines a conversation-to-related-tabs relationship, keeps raw Chrome tab IDs outside the public protocol, and separates chat availability from authorization and control leases. This change fills in those accepted boundaries; it does not change RFC-0002's browser-level CDP ownership or RFC-0003's lease lifecycle.

Mearl is used as a behavioral reference for provider warm-up, session-scoped tab mappings, page-created target inheritance, and stale-binding rejection. PaneRelay will implement the behavior against its own protocol and architecture rather than copying Mearl source.

## Goals / Non-Goals

**Goals:**

- Keep provider discovery cheap and expose runtime preparation as an explicit Bridge operation.
- Make the background service worker the authority for the active tab's conversation workspace.
- Make every asynchronous Side Panel transition conditional on an opaque workspace revision.
- Preserve a conversation across page-created related tabs without leaking Chrome tab IDs to the Bridge/provider protocol.
- Keep the first-send path free of intentionally persisted empty conversations.
- Show provider-reported model identity without adding model-selection controls.
- Give every new conversation one canonical, provider-neutral path to the repository Skill.
- Let that Skill use existing local integration registrations as a fast path for ordinary browser work.
- Keep streaming output visible when the user is following it without overriding deliberate reading position.
- Keep terminal activity cards compact while preserving access to their complete command and detail text.

**Non-Goals:**

- Persist prompts, draft text, or tab mappings beyond the current Chrome session.
- Close provider-native history merely because the last bound Chrome tab closes.
- Add server-side history pagination or a cross-profile synchronization service.
- Select, override, or persist provider model choices in the Extension.
- Detect installed Skills from the Bridge, manage Skill lifecycle automatically, or expose unrelated Skill metadata.
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

Resetting an active tab creates a new `groupId`, draft payload, and revision for that tab only. It does not call the normal group replacement path, so sibling tabs retain the old group and conversation. The draft first-send orchestration remains Extension-private: reserve the detached draft workspace, start one provider conversation, bind that draft group, send the message, then return detail/turn/revision. Existing conversations use the normal `conversation.send` operation. If provider start succeeds but binding cannot commit because a conflicting newer mutation exists, PaneRelay fails closed and does not send the prompt; this rare orphan is reported rather than attached to the wrong tab.

Alternative considered: let the Side Panel call start, bind, and send as three independent steps. Rejected because a tab switch between steps can attach a prompt or conversation to the wrong workspace.

### 5. Only page-created navigation targets inherit a workspace

The background uses `chrome.webNavigation.onCreatedNavigationTarget` as the only positive inheritance signal. When it reports that source page A created target tab B, B copies A's current record unless B already belongs to another group. `chrome.tabs.onCreated` remains useful to Chrome itself but is not sufficient for conversation inheritance: browser chrome and keyboard/tab-strip actions can create a tab with an opener-like relationship that does not express the user's intent to continue the same Agent conversation. This keeps the existing non-content-reading `webNavigation` permission bounded to page-created target discovery.

Closing a tab removes only that record. Other records with the same `groupId` remain bound, so a conversation survives until the group's last tab closes or a user replaces the group workspace. An unrelated new tab has no record and receives a fresh draft snapshot on activation.

Alternative considered: retain `tabs.onCreated` plus `openerTabId` as a second inheritance path. Rejected because it cannot distinguish a browser-created new tab from a page-created target reliably enough for conversation ownership. Focus, timing, and matching origins remain rejected for the same reason.

### 6. Workspace activation is event-driven and cache-aware

On tab activation, the background broadcasts the active tab's current `WorkspaceSnapshot`. A conversation snapshot causes the Side Panel to display a cached detail when available, otherwise it explicitly resumes that conversation. Draft snapshots display an empty timeline. Related tabs sharing a group therefore reuse the same cached detail without repeatedly resuming Qoder/Codex.

Conversation events continue to carry only conversation IDs. The controller applies them only to the matching active conversation and retains cached state for inactive workspaces.

### 7. Carry optional effective-model metadata through normalized summaries

`AgentProviderSummary` and `ConversationSummary` gain an optional bounded `model` field. Codex records the configured model returned by `config/read` during preparation, falling back to the entry marked `isDefault` by `model/list` when configuration leaves the model implicit, and records the effective model returned by `thread/start` or `thread/resume`; the conversation value wins in the UI. ACP providers derive the current model name from the standard `model` session configuration option returned by new/load/resume operations. Providers that cannot report a model omit the field, and the Side Panel omits model copy rather than rendering a placeholder. An unavailable provider never shows stale model metadata.

The Side Panel refreshes provider descriptors after successful preparation so a newly discovered default model becomes visible. Model selection remains provider-owned and no credentials, provider configuration, or raw session-config payload crosses the normalized protocol.

Alternative considered: parse provider configuration files in the Extension or label the provider name as a model. Rejected because the Extension must not own provider configuration and the provider name is not an effective model identifier.

### 8. Add canonical Skill guidance to new-conversation context

The Bridge always produces a short developer/system instruction for a newly created conversation, even when no page URL or title is available. It tells the Agent to load `$panerelay-browser` first for work in the user's authorized existing-browser tabs and not switch to another browser tool while that Skill is available. If the Skill is unavailable, the Agent must first attempt `npx skills add F-loat/panerelay --skill panerelay-browser` and load it after success. Only when installation cannot complete may the Agent explain the failure and use another available browser automation tool as an explicitly identified fallback. Existing sanitized page metadata follows in a separate clearly untrusted block.

This instruction is identical across Codex, Claude Code, Qoder, and OpenCode adapters through `createConversationContextInstructions`. The Bridge does not enumerate Skills or claim installation state; the Agent runtime applies its normal Skill discovery rules.

Before creating that instruction, the Bridge reads the same local registration surfaces already used by integration settings: the agent-browser Panerelay Provider/default state and the protected Browser Use and Playwright CLI-adapter registry/preferences. Registered engines are summarized as a cached, potentially stale setup hint. For ordinary browser tasks the hint tells the Skill to attempt the requested engine directly, without repeating generic operating-system, Node.js, executable-version, setup, or doctor probes. A failed first invocation returns the workflow to the smallest targeted diagnostic layer. The hint does not include filesystem paths or claim that an upstream executable is still present, the Extension is connected, a tab is authorized, or a control lease exists.

Alternative considered: inject the full repository `SKILL.md` into every conversation. Rejected because it duplicates a versioned instruction source, increases every prompt, and bypasses each Agent's Skill lifecycle.

Alternative considered: persist and inject an authoritative executable/version inventory. Rejected for this change because setup registrations already provide the required low-latency routing hint, while an inventory would become stale too and require a new lifecycle and compatibility contract. Direct invocation remains the cheapest live probe.

### 9. Track bottom affinity before timeline height changes

The timeline owns a mutable “following bottom” flag updated by scroll events using a small pixel threshold. A layout effect runs after timeline or transient feedback renders and scrolls only when that flag was already true. The controller exposes a monotonic send-scroll signal so an explicit user send re-enables following and pins the optimistic message even if the user had been reading older output.

This avoids computing the decision only after streamed content has increased `scrollHeight`, which can incorrectly classify a previously pinned viewport as far from the bottom. Conversation/workspace changes reset affinity and place the restored timeline at its bottom once, while user upward scrolling disables subsequent automatic movement.

Alternative considered: call `scrollIntoView` on every delta. Rejected because it continuously steals the viewport from users reading earlier content.

### 10. Use one terminal-activity disclosure for success and failure

Completed, failed, and declined activity records render as native `details` disclosures. Their collapsed summaries retain the existing single-line ellipsis, status, and compact secondary detail. Opening the disclosure shows the unmodified activity title first and the full detail below it with preserved whitespace and selectable text. The expanded title intentionally bypasses display-only title normalization so a command truncated in the summary remains recoverable exactly as the provider reported it.

Running activities remain non-expandable because their title/detail can still change as provider updates arrive. Terminal activities remain expandable even when `detail` is absent because the compact title itself can be truncated. A chevron and a neutral localized disclosure label expose the interaction for success and failure alike; failure coloring applies without making successful detail text look erroneous.

Alternative considered: show full commands on hover. Rejected because hover is unavailable on touch, difficult to select, and inaccessible for keyboard-only users.

## Risks / Trade-offs

- **[Risk] `webNavigation` adds a Chrome Web Store permission explanation.** → Limit its use to `onCreatedNavigationTarget`, document that browser-created tabs do not inherit and that it neither reads page content nor grants site access, and cover manifest identity/permission tests.
- **[Risk] A provider can create a conversation just before a reserved binding loses a conflict.** → Do not send the prompt or attach it elsewhere; surface the failure and cover the conflict path. Provider-native deletion is deliberately not assumed.
- **[Risk] Resuming many distinct tab conversations retains provider sessions.** → Cache active details in the Side Panel and reuse provider sessions; provider-wide cleanup still occurs when the Bridge closes. Per-conversation eviction is deferred.
- **[Risk] MV3 suspension can interrupt a queued mutation.** → Persist every committed or reserved record in `chrome.storage.session`. A reservation retains the prior draft or conversation payload under a fresh opaque revision, so a later Side Panel instance can safely restore it without repeating the abandoned provider request.
- **[Risk] A provider can omit or change its model metadata shape.** → Keep the normalized field optional and bounded, parse only documented Codex/ACP fields, and omit the model label when unknown.
- **[Risk] Skill guidance can be mistaken for proof that the Skill is installed.** → Phrase it conditionally, let the Agent runtime confirm discovery or installation, and require an explicit explanation before using a fallback tool.
- **[Risk] A setup registration can outlive its upstream executable or Extension connection.** → Label it as a staleable hint, omit paths and authorization claims, attempt the selected engine once, and run only targeted diagnostics if that attempt fails.
- **[Risk] Expanded commands can be long and disturb the narrow timeline.** → Preserve whitespace, wrap anywhere inside the card, keep the collapsed summary ellipsized, and expose expansion only after terminal status.
- **[Trade-off] History search covers the bounded provider result only.** → Label it as recent history and defer provider pagination until the protocol has a common cursor contract.
- **[Trade-off] Typed draft text is not persisted.** → Keep it only in the live React controller to avoid storing prompts; a Side Panel reload may clear unsent text.
- **[Trade-off] Provider startup exposes no fine-grained progress events.** → Show honest local phases (“starting conversation” and “working”) with animation rather than inventing percentage progress or provider steps.

## Migration Plan

1. Add protocol/provider preparation and optional model-summary support without changing model-selection ownership.
2. Add the Extension-private workspace store, page-target observer, message contracts, and deterministic conflict/detachment tests.
3. Switch the React controller and UI to lazy history, draft-first new conversations, preparation, model labels, scroll affinity, and workspace activation.
4. Add the canonical Skill guidance to normalized new-conversation context and update adapter tests.
5. Update RFC-0001, the extension permission description, and agent-browser `0.33.0` compatibility notes. Existing provider conversations remain resumable; stored session workspaces need no schema migration because detachment uses existing record fields.
6. Rollback omits the optional model fields and restores the prior Side Panel behavior; provider-native conversations and browser authorization remain unaffected.
