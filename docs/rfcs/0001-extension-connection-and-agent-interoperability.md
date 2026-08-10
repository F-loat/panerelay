# RFC-0001: Extension Connection and Bidirectional Agent Interoperability

- RFC: 0001
- Title: Extension Connection and Bidirectional Agent Interoperability
- Status: Accepted
- Authors: F-loat
- Created: 2026-07-29
- Updated: 2026-08-06
- Amendment: `openspec/changes/archive/2026-08-02-make-adapter-installation-explicit`
- Amendment: `openspec/changes/archive/2026-08-01-add-browser-use-default-setting`
- Amendment: `openspec/changes/archive/2026-08-01-improve-browser-authorization-controls`
- Amendment: `openspec/changes/archive/2026-08-03-simplify-setup-skill-installation`
- Amendment: `openspec/changes/archive/2026-08-04-add-conversation-target-hints`
- Amendment: `openspec/changes/archive/2026-08-04-fix-acp-prompt-lifecycle-privacy`
- Amendment: `openspec/changes/archive/2026-08-04-restore-agent-runtime-path`
- Amendment: `openspec/changes/add-native-host-self-update`
- Amendment: `openspec/changes/resume-cached-conversation-workspaces`
- Amendment: RFC-0009, `openspec/changes/add-browser-fetch-adapters`

RFC-0008 extends this RFC's Native Messaging registration and fixed setup-operation boundaries with semantic release reporting, a stable user-scoped launcher, and bounded best-effort Native Host self-update. Version mismatch remains separate from connection readiness and does not change this RFC's authorization, control, or Agent-provider boundaries.

RFC-0010 adds a separately authorized browser-state fetch path and supported Codex/Claude MCP routing. Fetch does not grant tab authorization or browser control, and Agent tool configuration does not widen site permission or Chrome Host Permission.

RFC-0004 supersedes this RFC's attachment-as-control and page-indicator semantics by separating visible read observation from active browser control.

## Summary

Panerelay will let browser automation tools and AI agents interact with a user's existing browser through a Chrome extension and a local bridge. The same extension will provide a side panel for agent conversations, browser-context sharing, activity review, approvals, interruption, and control handoff.

The first automation integration will use agent-browser without maintaining a permanent fork. A Panerelay provider will return a local CDP endpoint backed by the extension. agent-browser will continue to own browser automation semantics such as snapshots, locators, input, waiting, and screenshots; Panerelay will provide transport, browser attachment, policy, and human interaction.

The first release will be local-first. Browser content and agent traffic will not require a Panerelay cloud service.

RFC-0001 standardizes the trust boundary, direct-page automation path, control model, and provider-neutral conversation boundary needed for the first complete local workflow. Browser-level multi-target CDP, rich browser-to-agent context sharing, external-agent activity convergence, and cross-agent handoff remain product goals, but require follow-up RFCs and do not block acceptance of this RFC.

## Motivation

Browser automation agents commonly launch an isolated browser or require an existing browser to expose a remote debugging port. Both approaches are useful, but neither provides a complete collaboration loop with a person's daily browser:

- the user may already be authenticated in the browser they are using;
- the relevant state may live in the current tab, window, or navigation history;
- the user needs a visible place to provide instructions and context;
- sensitive actions need informed approval and immediate revocation;
- external and browser-embedded agents should share one coherent view of browser control.

A browser extension can attach to explicitly authorized tabs, use Chrome's debugging APIs, expose a side panel, and maintain visible user controls. A local bridge can connect that extension to browser automation engines and local agent runtimes without placing privileged native operations in the extension.

## Goals

1. Let an unmodified agent-browser client control an authorized tab in the user's existing Chrome installation.
2. Provide a browser side panel for starting, resuming, observing, interrupting, and approving agent work.
3. Define neutral protocols so agent-browser remains an Automation Adapter and the initial agent runtime remains behind an Agent Provider rather than becoming a permanent core dependency.
4. Keep the first complete workflow local-first and open source.
5. Make authorization, ownership, visibility, and revocation protocol-level invariants.

## Follow-up goals

The following goals extend the accepted foundation and will be specified independently:

1. Carry selected elements, screenshots, and structured page context from the browser to an agent.
2. Surface external-agent activity in the side panel.
3. Support explicit control handoff between external and side-panel agents.
4. Expose browser-level multi-target CDP with tab and popup lifecycle support.
5. Publish reusable protocol and provider SDK packages after their compatibility surfaces stabilize.

## Non-goals

1. Reimplement agent-browser's snapshot, locator, wait, input, or screenshot logic.
2. Build a hosted browser or mandatory cloud relay in the first release.
3. Import product-specific Mearl capabilities such as internal request signing, test-account systems, or company services.
4. Silently grant access to all sites, tabs, cookies, or browser history.
5. Support every Chromium-based browser, Firefox, Safari, mobile browser, or headless engine in the first release.
6. Standardize a universal agent protocol for every coding and general-purpose agent.
7. Allow multiple agents to mutate one tab concurrently without an explicit ownership model.

## Terminology

- **Extension**: the Panerelay Manifest V3 browser extension.
- **Bridge**: the local native process that terminates Native Messaging, exposes local automation endpoints, and enforces session policy.
- **Automation adapter**: an integration that connects a browser automation engine to the Bridge. The first adapter targets agent-browser.
- **Agent provider**: a Bridge-owned integration for an agent runtime, such as Codex, Qoder, Claude Code, or OpenCode, implemented through an app-server, CLI, or Agent Client Protocol transport.
- **Browser registration**: the durable identity and current connection metadata for one extension installation.
- **Relay participant**: an independently authenticated automation-client connection within one browser control lease.
- **Control lease**: revocable Panerelay automation ownership that may contain bounded relay participants and permits serialized mutation of authorized tabs.
- **Conversation**: a user-visible agent session shown in the side panel.
- **Tab binding**: an association between a conversation or relay session and one or more browser tabs.

## Proposed architecture

```text
                         ┌──────────────────────────┐
External Agent ──MCP──▶ │      agent-browser       │
                         └────────────┬─────────────┘
                                      │ CDP WebSocket
                                      ▼
┌──────────────────┐       ┌──────────────────────────┐
│ Agent Runtime(s) │◀─────▶│     Panerelay Bridge     │
└──────────────────┘       │ routing, policy, leases  │
                           └────────────┬─────────────┘
                                      │ Native Messaging
                                      ▼
                           ┌──────────────────────────┐
                           │   Panerelay Extension    │
                           │ debugger, permissions,   │
                           │ side panel, tab status   │
                           └────────────┬─────────────┘
                                      │
                                      ▼
                              Authorized browser tabs
```

### Component responsibilities

#### Extension

The Extension:

- registers a stable browser identity with the Bridge;
- reports windows, tabs, focus changes, and attachment state;
- requests optional site permissions through user-facing Chrome flows;
- attaches Chrome's debugger API only to controlled tabs;
- forwards supported CDP commands and events;
- displays a visible controlled-tab state and immediate release action;
- hosts the side panel and its conversation interface;
- sends explicitly selected elements, page context, screenshots, and user comments to a conversation;
- receives normalized agent events, activity updates, and approval requests.
- lets the user request user-level integration settings and one fixed setup-backed installation for a missing supported adapter through the Native Host without editing local configuration or supplying command material itself.

The Extension does not store model credentials or spawn local agent processes.

#### Bridge

The Bridge:

- is installed as a Chrome Native Messaging host;
- authenticates the paired extension and local clients;
- maintains browser registrations, relay participants, tab bindings, and control leases;
- reads and conditionally updates Panerelay-owned user-level integration settings;
- maps a closed adapter identifier to one lockstep, setup-backed installation command with bounded execution and output;
- exposes loopback-only CDP WebSocket endpoints;
- translates browser-level CDP target operations into extension and tab operations;
- multiplexes tab-scoped CDP commands and events over Native Messaging;
- chunks bounded messages for screenshots, traces, and other large payloads;
- launches or connects to configured agent providers;
- normalizes conversation events for the side panel;
- records an audit stream without retaining page content by default;
- tears down debugger attachments and leases after disconnects or revocation.

#### agent-browser adapter

The initial `@panerelay/agent-browser` adapter will implement agent-browser's external browser provider protocol.

On launch, it will:

1. connect to or start the local Bridge;
2. select a registered browser according to explicit configuration or recent focus;
3. create an independently authenticated relay participant and join or create the browser control lease;
4. return the Bridge's CDP WebSocket URL and cleanup metadata to agent-browser.

On close, it releases only its relay participant. Target attachments remain while another participant references them; the last participant releases the browser control lease.

The adapter will not implement page actions itself. agent-browser remains responsible for automation behavior.

#### Side panel

The side panel is a client of the same Bridge session model used by external agents. It will support:

- provider discovery and setup guidance;
- conversation start, resume, and close;
- the current provider-reported model when known, with no model placeholder when unknown;
- an optional project directory selected with a native chooser before a draft starts;
- streaming text, reasoning summaries when provided, tool activity, and completion state;
- interruption and approval responses;
- a visible, default-off automatic Agent-approval preference;
- current-tab and related-tab binding;
- explicit page comments and style annotations in the top document or currently authorized reachable frames, with one-shot or continuous selection, element-anchored editing, page markers, and review before sending;
- bounded clipboard-image attachments with removable previews for providers that advertise image input;
- a live view of which actor controls each bound tab;
- release and handoff actions.

Agent-provider-specific wire events will be normalized before reaching the side panel.

Agent-provider readiness gates provider preparation, conversation history, suggestions, composition, and other Agent operations. It does not gate the explicit browser-authorization surface: while the Native Host and Bridge are connected, the compact main-panel authorization card remains available even when the selected Agent is unavailable and the panel is showing setup guidance. Selecting or changing an Agent never grants, revokes, or changes browser authorization.

Automatic Agent approval applies only to a normalized approval request for the currently displayed conversation. It may choose the one-request `accept` decision when the provider offers it; it never chooses a session-wide decision, grants Chrome site access, acquires a browser control lease, or answers an approval for an inactive conversation.

## Extension-backed CDP

### Chosen direction

Panerelay will expose a CDP-compatible endpoint instead of adding Panerelay-specific page actions to agent-browser.

This preserves standard agent-browser CLI and MCP behavior, avoids duplicating its automation semantics, and keeps the integration useful for other CDP clients where practical.

### Proof-of-concept mode

The first technical proof will expose a direct-page CDP connection for the active authorized tab. It must demonstrate:

- Runtime, Page, DOM, Accessibility, Input, and screenshot commands required by a basic agent-browser workflow;
- snapshot, click, fill, navigation, wait, and screenshot through unmodified agent-browser commands;
- deterministic detach and recovery when the extension, Bridge, or client disconnects.

Direct-page mode deliberately excludes complete multi-tab behavior.

### Browser-level mode

The first product release will expose a browser-level CDP endpoint that multiplexes multiple attached tabs.

The Bridge will implement or synthesize the required browser-level target operations and forward tab-scoped commands through the Extension. The compatibility surface will be driven by recorded agent-browser command traces and contract tests rather than an assumption that every Chrome DevTools Protocol method can be supported.

Unsupported methods must return explicit CDP errors. Panerelay must not report successful execution for ignored commands.

### CDP session mapping

The Bridge will map:

- a relay browser target ID to a Chrome tab ID;
- each participant's relay CDP session ID to a shared target attachment;
- target lifecycle events to Chrome tab and navigation events;
- participant disconnects to participant-local command and virtual-session cleanup;
- final participant disconnect, Extension revocation, or Bridge failure to lease-wide attachment cleanup.

These identifiers are opaque outside the Bridge. Raw Chrome tab IDs are not part of the public protocol.

## Relay protocol

Panerelay will define a versioned JSON protocol in `@panerelay/protocol`. Native Messaging and local Bridge clients will use the same logical envelopes even when their transports differ.

Every request and event will include:

- protocol version;
- message type;
- correlation or event ID;
- session and browser identity where applicable;
- bounded payload;
- declared capability or action class where policy evaluation is required.

Initial message families are expected to include:

```text
browser.register
browser.heartbeat
browser.focus
browser.disconnect

tab.list
tab.bind
tab.unbind
tab.updated

control.acquire
control.renew
control.release
control.revoked

cdp.attach
cdp.detach
cdp.command
cdp.result
cdp.event

agent.request
agent.response
conversation.event

integration.request
integration.response

transport.chunk
transport.cancel
```

`agent.request` carries a provider-neutral operation (`agent.providers`, `agent.prepare`, `conversation.list`, `conversation.start`, `conversation.resume`, `conversation.send`, `conversation.interrupt`, or `conversation.respond`). `agent.response` correlates the bounded result or error. Streaming and unsolicited updates use `conversation.event`.

`integration.request` carries a local Panerelay integration operation. These operations read or update the user-level agent-browser default Provider, the Browser Use Direct/Extension connection preference, and the current-browser default, open a platform-native project-directory chooser, or request installation of the closed `agent-browser` / `browser-use` adapter enum. The install operation accepts no executable, package name, path, shell fragment, or argument from the Extension. The Bridge resolves a local package runner, pins `@panerelay/setup` to the connected lockstep Extension version, maps the enum to its fixed setup flag, bounds time and captured output, and serializes each adapter's installation. `integration.response` returns a bounded resulting value, one canonical absolute directory, a cancelled-selection result, one installed adapter identifier, or a correlated error. The Extension only requests these changes over its authenticated Native Messaging connection; the Bridge validates the request and owns all access to protected Panerelay configuration.

The side panel presents `agent-browser` and `browser-use` as independent choices under one “Set as default” setting. Hover does not change a control's background, border, or text color; only a missing integration replaces its label with a localized click-to-install action. A missing integration remains clickable while the Native Host is connected and shows a per-adapter installing state that rejects duplicate clicks. Successful setup is revalidated against protected registration state before that adapter is selected as the default. Clearing agent-browser removes the value only when it currently selects Panerelay. Clearing browser-use selects Direct mode. When more than one live browser registration exists, a separate “Control by default” switch indicates whether the current browser is the saved unscoped routing default; the row is hidden for zero or one live registration without changing the saved value. None of these operations installs or updates an upstream automation engine, uninstalls an integration, edits project-level configuration, grants site or tab authorization, creates a relay participant, starts an automation daemon, or acquires a control lease.

When the browser reports that the Native Host is missing, the side panel places its title and primary description below the welcome icon using the connected welcome heading pattern. Supporting benefits, the required setup action, and optional tool selection then appear in that order as three lightweight sibling cards aligned with the connected layout, without one enclosing panel. The setup-action card uses an action-oriented installation title with the same heading treatment as the optional-tools card rather than repeating a missing-Host diagnostic, and its command uses the theme's muted-gray raised surface. The base setup command has neither automation adapter selected by default. The guide explains that Panerelay reuses the existing browser session under explicit tab authorization, offers `agent-browser` and `browser-use` as independent text-only toggles matching the settings controls, and deterministically composes either or both fixed flags into the visible command. The toggles contain no secondary descriptions, checkbox glyphs, or status indicators. An accessible compact icon action copies the exact command and confirms success locally. Retrying the Native Host connection, including a transient hide and return of the missing-Host view, preserves those selections and the generated command. These controls do not send an integration request, grant browser authorization, or claim to install either upstream engine; only the existing retry action reconnects to the Native Host after the user runs setup.

The normalized conversation event union currently covers turn lifecycle, assistant message deltas and completion, reasoning-summary deltas, tool activity, approval requests and resolution, interruption, failure, and provider errors. Provider-native event objects do not cross the Bridge boundary.

`conversation.start` may include one validated project directory and bounded initial-page metadata. Initial-page metadata contains a sanitized URL and title, not a raw Chrome tab ID. These fields orient the new Agent session and do not establish a tab binding, Chrome authorization, or control lease.

`conversation.send` may include user-selected image inputs alongside text. Supported inputs are PNG, JPEG, WebP, and GIF, limited to four images, 10 MiB per image, and 20 MiB total. The Extension validates for immediate feedback and the Bridge repeats count, MIME, base64, name, and decoded-byte validation before provider dispatch.

## Browser and tab identity

The Extension will generate a stable random browser ID and store it in extension-local storage. The ID identifies an installation, not a person, device account, or Chrome profile.

The Bridge will expose opaque relay target IDs. A target ID may be rebound after browser restart only when the Bridge can prove continuity; otherwise clients receive target-close and target-create events.

Focus may choose a default browser or tab only when the caller did not specify one. Focus never grants authorization or a control lease.

## Browser authorization scopes

The side panel exposes two explicit authorization scopes:

- **single tab** requests Chrome access to the current origin, records the tab selected by the user, and permits the next relay session to attach only to that tab;
- **all tabs** requests Chrome access to HTTP and HTTPS origins through a user-facing permission prompt and makes every supported web tab eligible, while the active tab selects the target when a direct-page relay session attaches.

These scopes authorize eligibility, not control by themselves. Direct-page mode still controls one tab per participant. Changing the scope, or clicking its selected control again to clear it, revokes the current control lease and detaches the debugger without removing Chrome's already granted site permission. The separate release action revokes the complete control lease and detaches every observed or controlled target without changing the selected scope or Chrome site permission; invoking it with no active lease acquires nothing. Single-tab authorization is memory-only. The all-tabs selection persists in Extension-local storage until the user clears it or removes the corresponding Chrome site permission. Control leases and debugger attachments never persist or revive after a Bridge or Extension disconnect.

Navigation is re-evaluated against the authorized origin before further commands run. A single-tab navigation to another origin clears that authorization and detaches the debugger. All-tabs access continues only while Chrome still reports the explicitly requested web-origin permissions.

## Control leases

Mutating browser operations require a control lease.

The first version uses one exclusive Panerelay automation lease for the authorized browser:

- the first relay participant creates the lease before debugger attachment;
- later independently authenticated participants may join the same lease without another Chrome permission prompt;
- the lease has a current actor, bounded participant set, expiration, and per-participant heartbeat;
- each participant owns independent virtual CDP sessions, pending commands, credentials, and cleanup;
- complete target-scoped command lifecycles are serialized per target;
- side-panel users can revoke it immediately;
- participant disconnect and timeout release only that participant;
- the last participant ending, user release, Extension disconnect, or Bridge failure releases the lease;
- another debugger cannot silently steal Panerelay's Chrome attachment.

The user remains the ultimate owner. Manual browser use does not require a lease and the UI must never block the user from navigating, closing a tab, or releasing automation.

## Bidirectional interoperability

Panerelay defines bidirectional interoperability as three observable flows.

### Agent to browser

An external or side-panel agent performs actions through an acquired relay session. The Extension shows that the tab is controlled, and the side panel receives activity events with the responsible actor and outcome.

### Browser to agent

The user explicitly sends context from the browser to a conversation. Supported context will begin with:

- bounded current URL and title when a draft conversation starts;
- selected element metadata, visible text, and rectangle from the top document or one explicitly selected authorized frame;
- an optional screenshot;
- user-pasted image files that remain visible and removable before send;
- a user-authored comment;
- IDs of explicitly bound tabs.

Sensitive URL fields are redacted, form values are not collected as element text, and selected page evidence is delimited as untrusted webpage data before it reaches the Agent. A subframe selection carries bounded frame URL, title, and viewport metadata in addition to top-page metadata; raw Chrome frame IDs stay Extension-private. Pasted image bytes are not written to workspace state, conversation previews, activity events, or logs. Page bodies, cookies, storage, request headers, browser history, raw Chrome tab IDs, automatically captured screenshots, and frame contents beyond the explicitly selected element are not attached automatically.

### Human handoff

The user can interrupt a conversation, deny an approval, release a tab, or transfer a tab binding. Every action invalidates stale automation references and produces a visible event for affected clients.

## Agent provider contract

The Bridge will expose a provider-neutral conversation contract. An Agent Provider is responsible for:

- availability and setup status;
- explicit, idempotent runtime preparation without creating a conversation;
- listing resumable sessions when supported;
- starting and resuming sessions;
- validating text and image inputs;
- streaming normalized events;
- interruption;
- approval and structured-question responses;
- cleanup.

The reference implementation integrates Codex app-server over its local stdio JSON-RPC transport. The Bridge owns the process, initialization, thread lifecycle, streaming-event normalization, approval responses, and interruption. Codex app-server types remain Provider-private and do not become the Panerelay public conversation protocol.

The same internal registry adapts Qoder CLI over ACP when a compatible optional runtime is available. The Bridge negotiates capabilities, keeps ACP option identifiers private, normalizes supported streams and permissions, and contains process failure so Qoder availability cannot block Codex.

Provider discovery is side-effect free. It may resolve an executable and version, but it does not start app-server, ACP, or a conversation. The side panel explicitly requests `agent.prepare` for the selected available provider and reports preparation failures as provider-local state rather than as a global Extension failure.

Native Messaging does not define an ordinary interactive-shell command environment. During setup or update, the Bridge installer therefore captures a bounded, normalized list of absolute command-search directories from the invoking user's `PATH`, prepends the selected Node executable directory, and stores the list only in the existing user-protected runtime configuration. At Native Host startup, the Bridge prepends validated captured entries to the current host `PATH` and passes that explicit environment to every built-in Agent provider process. It does not source shell startup files, scan version-manager directories, persist arbitrary environment variables, add filesystem paths to Agent context, or treat a captured directory as executable readiness. Rerunning setup refreshes stale entries; live provider discovery and command execution remain authoritative.

Provider and conversation summaries may carry one optional bounded effective-model label reported through the provider's supported configuration, model catalog, or session result. Codex preparation prefers an explicit configured model and otherwise uses the catalog entry marked as default. Conversation metadata takes precedence over a prepared provider default. The Side Panel does not infer, select, persist, or change a model; when the selected installed provider reports no model, or the selected provider is unavailable, it omits model copy instead of rendering a placeholder. Credentials and provider-native configuration payloads remain Bridge-private.

Side-panel providers do not install agent-browser, Browser Use, another browser MCP, or a Skill, and do not inject Skill contents or engine-specific cleanup commands. Every new conversation does receive one short provider-neutral instruction to load the independently managed `$panerelay` Skill first for browser-authenticated Fetch, Panerelay setup, or authorized existing-browser work and not choose another browser tool while it is available. When the Agent runtime cannot load that Skill, the instruction tells the Agent to attempt `npx skills add F-loat/panerelay --skill panerelay`, then load the installed Skill. Only if installation cannot complete may it explain the failure and use another available browser automation tool as an explicitly identified fallback. The Bridge does not claim installation success or inspect unrelated Skills.

The Bridge may append a bounded setup hint derived from the same agent-browser Provider/default state and protected CLI-adapter registrations/preferences that its integration settings already read. This hint contains only registered engine names and the relevant default/mode; it omits executable paths, adapter versions, and raw configuration. It is explicitly cached and potentially stale. For ordinary browser tasks, `$panerelay` uses it to attempt the requested or preferred registered engine directly instead of repeating generic platform, Node.js, executable-version, setup, and doctor probes. A failed first invocation returns to the smallest targeted diagnostic layer. Registration never proves that an executable remains installed, the Extension is connected, a tab is authorized, or a control lease exists. Explicit setup, verification, and troubleshooting requests continue to use the full Skill workflow.

Each Agent still discovers automation tools through its own supported configuration. RFC-0010 permits Panerelay-owned Codex and Claude processes to receive the bounded Panerelay Fetch MCP and permits explicit reversible external-Agent Fetch MCP setup. Fetch uses separate site permission and does not imply tab authorization or a control lease. If an automation tool connects through Panerelay, the existing authenticated routing, explicit tab authorization, visible control lease, liveness, and user-release boundaries still apply. Chat availability, model metadata, setup hints, and Agent tool configuration never imply browser authorization.

For a new session, every provider receives the validated project directory as its actual working directory. Panerelay additionally passes bounded, redacted current-tab URL/title orientation, the bounded setup hint, and an optional opaque browser/target UUID pair through the provider's supported instruction or first-prompt surface. The opaque pair may derive bounded engine-specific locating data: one reserved agent-browser/Playwright session label, Browser Use's existing target selector, and one target-scoped Playwright gateway URL. These values are staleable locators, not credentials; they do not grant site permission, add a target to an authorized inventory, attach a debugger, acquire control, or expose a raw Chrome tab ID. A missing or revoked exact target fails closed without URL/title matching, browser fallback, or authorization widening. Resumed provider-native sessions are not retroactively reoriented.

ACP v1 has no separate hidden system/developer instruction field. Qoder and OpenCode therefore receive Panerelay-authored first-turn context inside the literal `<panerelay-context version="1">` / `</panerelay-context>` envelope. When loading history for the Side Panel, the Bridge strips only a complete recognized v1 envelope or an exact legacy prefix from the first user message after all chunks are assembled; it preserves partial markers and similar user-authored text. Provider-native transcript stores may retain the original first prompt because Panerelay does not rewrite provider-owned history.

Codex maps validated images to `turn/start` data URLs. Qoder maps them to ACP image content blocks only after runtime preparation negotiates `promptCapabilities.image`; the Extension refreshes the provider descriptor after preparation so the composer reflects that result.

## Extension-private conversation workspaces

The Extension background service worker owns the current Chrome session's relationship between a side-panel conversation and its related tabs. It stores only an opaque group identifier, an opaque revision, the provider identifier, an optional draft project directory, and either a local draft state or provider conversation identifier in `chrome.storage.session`. Raw Chrome tab IDs and workspace group identifiers do not cross the shared protocol or provider boundary.

Side-panel mutations include the revision they were rendered from. The background captures the active tab before asynchronous provider work, serializes workspace mutations, and rejects stale revisions. Selecting “new conversation” detaches only the active tab into a new opaque group and creates an Extension-local draft; sibling tabs keep their prior group and conversation. The first text, pasted-image set, or reviewed page-comment batch performs one provider start, binds only the detached draft group, and sends once. Later mutations in either group do not replace the other. A project can be selected, replaced, or cleared only while the workspace is a draft; it is immutable after binding.

Conversation history remains lazy and is loaded only when the user opens it. The Extension merges provider-listed summaries with valid current-session timeline summaries by the exact provider/conversation pair, displays each pair once, and prefers provider metadata. A retained summary fills only a provider-list omission; when provider listing fails completely, a non-empty retained list remains usable without being described as complete provider history. Selecting either source still requires a successful provider resume or load before any workspace changes. After success, only the captured active tab moves into an existing opaque group for that provider/conversation pair, or into a new bound group when no live group remains. Siblings in the tab's prior group and tabs already in the destination group remain unchanged. Recreating the Side Panel resolves that active-tab binding and restores its retained timeline automatically during the same Chrome session. These are Extension workspaces, not Chrome visual tab groups, and cached discovery or group membership grants no browser or approval authority.

A new tab inherits a workspace only when Chrome reports through `webNavigation.onCreatedNavigationTarget` that a bound source page created it as a navigation target. `tabs.onCreated` and `openerTabId` alone do not inherit a conversation because browser chrome, keyboard shortcuts, and tab-strip controls can produce opener-like metadata without expressing conversation continuity. Focus, timing, origin equality, and ordinary navigation never create a relationship. These workspaces select UI/provider context only: they grant no Chrome site permission, tab authorization, debugger attachment, or control lease.

The Extension background separately retains a versioned, conversation-scoped presentation snapshot in `chrome.storage.session` so recreating the Side Panel document does not reduce the visible timeline to provider messages. The snapshot contains at most 400 sanitized user-visible message, reasoning, activity, and terminal-error items. Per field it retains at most 100,000 message, reasoning, or displayable-output characters, 20,000 activity-detail or error characters, 4,000 title characters, and 1,000 identifier characters. It strips streaming presentation flags and excludes approvals, usage, diagnostics, page comments, pasted images, page context, raw ACP/CDP objects, provider-native metadata, credentials, and Panerelay-authored hidden context.

Normalized events that arrive while no Side Panel document is mounted are sanitized first and retained in a per-conversation journal of at most 500 entries. The background assigns a local increasing sequence before broadcasting an event. A Side Panel snapshot acknowledges only the sequence it has reduced; newer journal entries remain available for replay. The store serializes updates, caps each record at 750,000 serialized characters, keeps at most 30 least-recently-updated records within a 4,000,000-character aggregate bound, and evicts oldest content without spilling into `storage.local`, files, logs, or provider metadata. Unknown schemas and identifier mismatches are ignored.

On activation, a valid session snapshot renders before provider resume. Provider resume may refresh compatible conversation metadata and provider session state, but returned messages do not modify a retained or in-memory timeline because provider identifiers, timestamps, ordering, and completeness are not stable enough for lossless reconciliation. Provider messages are a display fallback only when no local timeline exists. Provider history remains canonical only for provider-owned history, while this snapshot is a bounded Extension presentation cache. It ends with the Chrome session. A retained approval never recreates an actionable decision; only a current live approval event can do so. Snapshot restoration does not grant site permission, tab authorization, debugger attachment, target ownership, focus, or a control lease.

The page-comment runtime is injected into the authorized active tab's currently reachable frames only after an explicit user action. Chrome host permissions continue to decide which same-origin or cross-origin frames are reachable; inaccessible frames remain untouched. Extension-private frame tokens coordinate one active picker highlight and pause or resume selection across installed frames. A single Side Panel click starts one-shot selection; a double click starts continuous selection. Each frame keeps its own element outline, compact anchored editor, optional live and reversible style preview, and editable pencil markers in isolated Shadow DOM. Pending annotations appear as compact Side Panel pills. It prevents the selection click from activating the site and clears its document-local state on send, tab switch, navigation, close, or permission revocation. Commenting requires site authorization but never requires or grants an automation control lease, and frame selection never widens that authorization.

## Security and privacy

### Invariants

1. Installing the Extension does not grant all-site automation.
2. Site permission and tab control are separate decisions.
3. Focus does not imply permission.
4. A mutating client must hold the current control lease.
5. Controlled state and the controlling actor are visible to the user.
6. Revocation must stop new commands and detach the debugger.
7. Local endpoints are authenticated and bound to loopback or user-scoped operating-system transports.
8. Unsupported or unauthorized actions fail closed.
9. Sensitive browser data is not included in logs by default.
10. Extension-initiated integration installation selects only a fixed adapter enum and never carries arbitrary command material.
11. Agent providers receive only the browser sessions and context explicitly bound to them.
12. Automatic Agent approval remains separate from Chrome permissions and browser control ownership.
13. Page evidence is bounded, user-selected, treated as untrusted, and cleared at document boundaries.
14. Image inputs are explicit, bounded at both Extension and Bridge boundaries, capability-gated, and excluded from logs and durable workspace state.
15. Session-retained conversation timelines contain only bounded normalized presentation data, never restore approval authority, and grant no browser permission or control ownership.

### Native Messaging

The Bridge installer registers only the effective Panerelay Extension ID selected by the user. Official builds default to `panplnkjlkoceaonlmpdekjphgmbggmi`, derived from the retained public manifest key; a validated custom ID can be persisted for self-built Extensions. The Bridge rejects messages that do not complete a versioned registration handshake with the same actual `chrome.runtime.id`. RFC-0008 requires Host/Extension semantic release reporting but completes valid ordinary registration before its one-shot best-effort maintenance check; it owns the stable launcher and self-update lifecycle. On Windows, installation uses a user-owned launcher and the exact current-user Chrome Native Messaging registry key.

Large payloads use bounded `transport.chunk` envelopes with transfer IDs, byte counts, ordering, and CRC32 integrity metadata. `transport.cancel` abandons incomplete transfers. Receivers cap bytes, chunk count, and individual frame size, expire incomplete transfers, and clear transfer state on disconnect without retaining abandoned content.

### Local clients

The Bridge will generate a local authentication secret with user-only filesystem permissions. CDP WebSocket URLs will contain short-lived session credentials and will not be reusable after cleanup.

The Bridge must not listen on non-loopback interfaces in the first release.

### Extension permissions

The initial Chrome extension is expected to require `debugger`, `nativeMessaging`, `sidePanel`, `storage`, `webNavigation`, and tab-related permissions. `webNavigation` is used only to observe Chrome's `onCreatedNavigationTarget` relationship so a tab created by a bound source page can inherit that page's conversation workspace. Tabs created through browser chrome do not inherit through this permission. It does not read browsing history or page content and does not grant host access. Broad host access will be optional and requested per site or origin through a user gesture.

Permission descriptions and controlled-tab indicators are part of the product, not release documentation alone.

## Observability and audit

The Bridge and side panel will expose a bounded activity stream containing:

- actor and session identity;
- action category and target;
- start, completion, failure, denial, interruption, and revocation;
- timing and non-sensitive error summaries.

Audit events will not contain raw page HTML, screenshots, cookies, credentials, request bodies, or agent prompts unless a future explicit capture mode is enabled.

## Failure handling

- If the Extension disconnects, the Bridge closes its CDP targets and expires its leases.
- If an automation participant disconnects, the Bridge releases its virtual sessions and pending work. Shared debugger attachments remain referenced by other participants; the final participant disconnect releases them.
- If the Bridge restarts, the Extension reconnects and re-registers, but prior control leases do not revive automatically.
- If DevTools or another debugger displaces Panerelay, the affected target closes and clients receive an explicit error.
- If a tab navigates outside authorized origins, mutating commands pause until authorization is re-evaluated.
- If side-panel event replay is incomplete, the UI reports the gap instead of implying a complete history.

## Compatibility strategy

Panerelay will test against pinned agent-browser versions and publish a compatibility matrix.

Contract tests will cover:

- provider launch and cleanup;
- CDP handshake and target discovery;
- snapshot, click, fill, navigation, wait, and screenshot;
- tab open, close, switch, and popup discovery in browser-level mode;
- debugger displacement and reconnect;
- permission denial and lease revocation;
- payload chunking and cancellation.

The adapter will fail with a supported-version message when a known-incompatible agent-browser version is detected.

## Repository and package boundaries

The initial monorepo is expected to contain:

```text
apps/extension
packages/protocol
packages/bridge
packages/adapters/agent-browser
packages/cli
```

All publishable JavaScript packages will use the `@panerelay` npm scope. The scoped CLI package may expose the unscoped `panerelay` executable.

Code derived from another project must have clear provenance and compatible licensing before it is added. Product-specific integrations remain separate packages or downstream projects.

## Alternatives considered

### Maintain an agent-browser fork

A fork could add direct extension transport throughout the agent-browser daemon. It would offer deep integration but create continuous merge and release work. This RFC instead chooses a provider and CDP compatibility boundary that can work with upstream releases.

### Delegate high-level actions to a generic plugin

Panerelay could expose `snapshot`, `click`, and similar commands as custom plugin actions. Existing agent-browser plugins do not replace core action execution, and a parallel action vocabulary would fragment CLI and MCP behavior. This alternative is not selected.

### Load the extension only into agent-browser-managed Chrome

agent-browser can load extensions into a browser it launches. This is useful for tests but does not connect to the user's existing tabs and daily browser session, which is a primary Panerelay goal.

### Expose a raw remote-debugging port from the user's browser

Launching the daily browser with a remote-debugging port weakens the extension-controlled authorization model and may require a separate profile. Panerelay instead exposes short-lived, policy-aware CDP sessions through the Bridge.

### Put the agent runtime inside the extension

This would constrain runtimes, complicate credentials, and place privileged logic in a frequently suspended environment. Agent runtimes remain local Bridge adapters.

## Delivery plan

### RFC-0001 reference delivery

- Define versioned protocol envelopes and provider-neutral conversation events.
- Build the Extension, Native Messaging Bridge, and authenticated loopback relay.
- Expose one explicitly authorized tab as a direct-page CDP endpoint.
- Integrate unmodified agent-browser through its Provider interface.
- Enforce one short-lived, user-revocable Panerelay control lease with bounded, independently authenticated participants and serialized target commands.
- Provide a Codex side-panel vertical slice with conversation lifecycle, streaming, approvals, and interruption.
- Provide engine-neutral Native Host setup plus explicit agent-browser and Browser Use integration selection, diagnostics, uninstallation, Agent guidance, and optional agent-browser default selection.
- Complete direct-page compatibility evidence and bounded large-message cancellation.

### Follow-up RFC topics

- Browser-level target discovery, tab lifecycle, popup discovery, and multiplexed CDP sessions.
- Explicit selected-element, screenshot, and structured page-context sharing.
- A unified activity stream for external and side-panel agents.
- Control handoff between external agents, conversations, and people.
- Protocol and provider SDK publication policy and compatibility guarantees.
- Additional Chromium browsers, automation adapters, and optional remote pairing.

## Acceptance criteria

RFC-0001 can move from `Draft` to `Accepted` when:

1. maintainers agree on the Bridge as the trust and routing boundary;
2. maintainers agree on CDP compatibility as the initial agent-browser integration;
3. maintainers agree on one exclusive, revocable Panerelay control lease with explicit participant isolation;
4. maintainers agree on the provider-neutral side-panel conversation contract;
5. maintainers agree on local-first deployment and loopback-only endpoints;
6. the RFC-0001 reference delivery assertions below all pass.

### Reference delivery status

| Assertion | Status | Evidence or remaining work |
| --- | --- | --- |
| An unmodified supported agent-browser client connects through Panerelay. | Pass | Spike 0001 passed with agent-browser 0.33.0 in test and daily Chrome profiles. |
| Snapshot, click, fill, navigation, wait, and screenshot work on an authorized existing tab. | Pass | A current daily-Chrome run completed the checked-in action fixture through agent-browser 0.33.0, including filled state and post-navigation screenshots. |
| Denied browser targets and missing leases fail closed. | Pass | Exact-origin matching, Chrome permission removal, unsupported targets, invalid credentials, and lease conflicts are covered; a real all-tabs grant also survived Extension reload. |
| Disconnect, scope clearing, and user control release reliably detach the debugger and invalidate credentials. | Pass | Relay and Extension tests cover provider cleanup, credential expiry, scope-change revocation, and a scope-preserving immediate release action. |
| Large messages support bounded chunks, integrity checks, cancellation, timeout, and cleanup. | Pass | Protocol tests cover UTF-8 reassembly, sub-1 MiB frames, corruption rejection, explicit cancellation, timeout, and released receiver state. |
| The browser visibly identifies controlled state and offers immediate release. | Pass | The Extension shows a substantively controlled-tab count in its action badge, marks each document touched by an Agent page command with the agent-browser favicon and a green status dot, and keeps release in the side panel. Virtual target discovery and page-session bootstrap remain unmarked. |
| Codex uses the provider-neutral conversation contract for lifecycle, streaming, approvals, and interruption. | Pass | Bridge contract tests cover provider discovery, normalized events, and approval requests. |
| Qoder ACP uses the same provider-neutral boundary without becoming a prerequisite. | Pass | Provider tests cover capabilities, streaming, permissions, interruption, process restart, project working directories, bounded tab context, the explicit reconstructed Agent command environment, and the absence of Panerelay-injected browser MCPs or engine cleanup. |
| Local setup installs, diagnoses, and removes only the selected components. | Pass | Plain setup covers the Native Host and side-panel prerequisites. `--agent-browser`, `--browser-use`, and `--playwright` independently gate their program probes, Provider/adapter registrations, output, success, settings availability, and doctor checks; user defaults require an explicitly selected default-capable integration. Agent Skill lifecycle is independent and belongs to `npx skills`. The settings installer accepts only fixed adapter identifiers, pins the lockstep setup package, revalidates registration, and then changes only that adapter's default. |
| Real Windows Chrome launches and removes the installed Native Host. | Pending | Windows path, launcher, registry, update, and uninstall behavior has deterministic coverage; the stable release gate still requires a real Windows Chrome run from a path containing spaces. |

## Open questions

The following dispositions keep unresolved ecosystem work from making RFC-0001 indefinitely broad:

1. RFC-0001's direct-page foundation is extended by [RFC-0002](0002-browser-level-cdp-and-agent-browser-compatibility.md), which defines browser-level target support.
2. CDP compatibility remains trace-driven. Unsupported methods return explicit errors.
3. RFC-0001 permits bounded participants inside one Panerelay lease, with independent authentication and per-target command serialization; sharing control with another debugger or transport remains unsupported.
4. External-agent activity convergence and handoff require a follow-up interoperability RFC.
5. Rich browser-context objects require a follow-up privacy and data-model RFC.
6. Relay participants belong to one browser control lease. Human handoff and non-automation principals remain deferred.
7. Codex app-server and Qoder ACP are the initial Agent Providers; future Providers must implement the same normalized contract.
8. Setup registers one exact official or user-selected Extension ID. Broader pairing and managed enterprise distribution remain future policy topics.
9. [RFC-0010](0010-browser-state-fetch-authority-and-agent-routing.md) governs browser-state fetch authority and Agent Fetch MCP routing without changing the conversation or automation ownership model here.

## References

- [agent-browser plugin system](https://github.com/vercel-labs/agent-browser/blob/main/docs/src/app/plugins/page.mdx)
- [Chrome Extensions: `chrome.debugger`](https://developer.chrome.com/docs/extensions/reference/api/debugger)
- [Chrome Extensions: Native Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)
- [Chrome Extensions: Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
