# RFC-0001: Extension Connection and Bidirectional Agent Interoperability

- RFC: 0001
- Title: Extension Connection and Bidirectional Agent Interoperability
- Status: Accepted
- Authors: F-loat
- Created: 2026-07-29
- Updated: 2026-07-30

## Summary

PaneRelay will let browser automation tools and AI agents interact with a user's existing browser through a Chrome extension and a local bridge. The same extension will provide a side panel for agent conversations, browser-context sharing, activity review, approvals, interruption, and control handoff.

The first automation integration will use agent-browser without maintaining a permanent fork. A PaneRelay provider will return a local CDP endpoint backed by the extension. agent-browser will continue to own browser automation semantics such as snapshots, locators, input, waiting, and screenshots; PaneRelay will provide transport, browser attachment, policy, and human interaction.

The first release will be local-first. Browser content and agent traffic will not require a PaneRelay cloud service.

RFC-0001 standardizes the trust boundary, direct-page automation path, control model, and
provider-neutral conversation boundary needed for the first complete local workflow. Browser-level
multi-target CDP, rich browser-to-agent context sharing, external-agent activity convergence, and
cross-agent handoff remain product goals, but require follow-up RFCs and do not block acceptance of
this RFC.

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
3. Define provider-neutral protocols so agent-browser and the initial agent runtime remain adapters rather than permanent core dependencies.
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

- **Extension**: the PaneRelay Manifest V3 browser extension.
- **Bridge**: the local native process that terminates Native Messaging, exposes local automation endpoints, and enforces session policy.
- **Automation adapter**: an integration that connects a browser automation engine to the Bridge. The first adapter targets agent-browser.
- **Agent provider**: an adapter for an agent runtime, such as an app-server or an Agent Client Protocol implementation.
- **Browser registration**: the durable identity and current connection metadata for one extension installation.
- **Relay session**: a scoped connection between an automation client and one browser registration.
- **Control lease**: revocable ownership that permits one actor to mutate a tab.
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
│ Agent Runtime(s) │◀─────▶│     PaneRelay Bridge     │
└──────────────────┘       │ routing, policy, leases  │
                           └────────────┬─────────────┘
                                      │ Native Messaging
                                      ▼
                           ┌──────────────────────────┐
                           │   PaneRelay Extension    │
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

The Extension does not store model credentials or spawn local agent processes.

#### Bridge

The Bridge:

- is installed as a Chrome Native Messaging host;
- authenticates the paired extension and local clients;
- maintains browser registrations, relay sessions, tab bindings, and control leases;
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
3. create a relay session and acquire the requested tab binding;
4. return the Bridge's CDP WebSocket URL and cleanup metadata to agent-browser.

On close, it will release the relay session and any leases owned by that session.

The adapter will not implement page actions itself. agent-browser remains responsible for automation behavior.

#### Side panel

The side panel is a client of the same Bridge session model used by external agents. It will support:

- provider discovery and setup guidance;
- conversation start, resume, and close;
- streaming text, reasoning summaries when provided, tool activity, and completion state;
- interruption and approval responses;
- current-tab and related-tab binding;
- explicit attachment of selected elements, screenshots, or page context;
- a live view of which actor controls each bound tab;
- release and handoff actions.

Agent-provider-specific wire events will be normalized before reaching the side panel.

## Extension-backed CDP

### Chosen direction

PaneRelay will expose a CDP-compatible endpoint instead of adding PaneRelay-specific page actions to agent-browser.

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

Unsupported methods must return explicit CDP errors. PaneRelay must not report successful execution for ignored commands.

### CDP session mapping

The Bridge will map:

- a relay browser target ID to a Chrome tab ID;
- a relay CDP session ID to one debugger attachment;
- target lifecycle events to Chrome tab and navigation events;
- client disconnects to lease and attachment cleanup.

These identifiers are opaque outside the Bridge. Raw Chrome tab IDs are not part of the public protocol.

## Relay protocol

PaneRelay will define a versioned JSON protocol in `@panerelay/protocol`. Native Messaging and local Bridge clients will use the same logical envelopes even when their transports differ.

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

transport.chunk
transport.cancel
```

`agent.request` carries a provider-neutral operation (`agent.providers`, `conversation.list`,
`conversation.start`, `conversation.resume`, `conversation.send`, `conversation.interrupt`, or
`conversation.respond`). `agent.response` correlates the bounded result or error. Streaming and
unsolicited updates use `conversation.event`.

The normalized conversation event union currently covers turn lifecycle, assistant message
deltas and completion, reasoning-summary deltas, tool activity, approval requests and resolution,
interruption, failure, and provider errors. Provider-native event objects do not cross the Bridge
boundary.

## Browser and tab identity

The Extension will generate a stable random browser ID and store it in extension-local storage. The ID identifies an installation, not a person, device account, or Chrome profile.

The Bridge will expose opaque relay target IDs. A target ID may be rebound after browser restart only when the Bridge can prove continuity; otherwise clients receive target-close and target-create events.

Focus may choose a default browser or tab only when the caller did not specify one. Focus never grants authorization or a control lease.

## Browser authorization scopes

The side panel exposes two explicit authorization scopes:

- **single tab** requests Chrome access to the current origin, records the tab selected by the user,
  and permits the next relay session to attach only to that tab;
- **all tabs** requests Chrome access to HTTP and HTTPS origins through a user-facing permission
  prompt and makes every supported web tab eligible, while the active tab selects the target when
  a direct-page relay session attaches.

These scopes authorize eligibility, not concurrent ownership. Direct-page mode still controls one
tab per relay session. Changing or clearing the scope revokes the current control lease and detaches
the debugger. Single-tab authorization is memory-only. The all-tabs selection persists in
Extension-local storage until the user releases it or removes the corresponding Chrome site
permission. Control leases and debugger attachments never persist or revive after a disconnect.

Navigation is re-evaluated against the authorized origin before further commands run. A single-tab
navigation to another origin clears that authorization and detaches the debugger. All-tabs access
continues only while Chrome still reports the explicitly requested web-origin permissions.

## Control leases

Mutating browser operations require a control lease.

The first version will use one exclusive lease per tab:

- a relay session acquires a lease before debugger attachment;
- the lease has an owner, expiration, and heartbeat;
- side-panel users can revoke it immediately;
- disconnect and timeout release it;
- a conversation can request a handoff but cannot silently steal a lease;
- read-only observation may be shared only when Chrome's debugger attachment model and the privacy policy permit it.

The user remains the ultimate owner. Manual browser use does not require a lease and the UI must never block the user from navigating, closing a tab, or releasing automation.

## Bidirectional interoperability

PaneRelay defines bidirectional interoperability as three observable flows.

### Agent to browser

An external or side-panel agent performs actions through an acquired relay session. The Extension shows that the tab is controlled, and the side panel receives activity events with the responsible actor and outcome.

### Browser to agent

The user explicitly sends context from the browser to a conversation. Supported context will begin with:

- current URL and title;
- selected element metadata and accessible text;
- an optional screenshot;
- a user-authored comment;
- IDs of explicitly bound tabs.

Page bodies, cookies, storage, request headers, and browser history are not attached automatically.

### Human handoff

The user can interrupt a conversation, deny an approval, release a tab, or transfer a tab binding. Every action invalidates stale automation references and produces a visible event for affected clients.

## Agent provider contract

The Bridge will expose a provider-neutral conversation contract. A provider adapter is responsible for:

- availability and setup status;
- listing resumable sessions when supported;
- starting and resuming sessions;
- validating text and image inputs;
- streaming normalized events;
- interruption;
- approval and structured-question responses;
- cleanup.

The reference implementation adapts Codex app-server over its local stdio JSON-RPC transport. The
Bridge owns the process, initialization, thread lifecycle, streaming-event normalization, approval
responses, and interruption. Codex app-server types remain adapter-private and do not become the
PaneRelay public conversation protocol.

The same internal registry adapts Qoder CLI over ACP when a compatible optional runtime is
available. The Bridge negotiates capabilities, keeps ACP option identifiers private, normalizes
supported streams and permissions, and contains process failure so Qoder availability cannot block
Codex.

For browser work, each new Codex or Qoder session receives a uniquely scoped PaneRelay
agent-browser MCP server. The MCP process uses the existing PaneRelay agent-browser provider and
therefore must acquire the same short-lived browser relay session and user-visible control lease as
an external automation client. Chat availability does not imply browser authorization.

The relationship between a side-panel agent and browser tools must be explicit. A provider receives a scoped relay session or scoped agent-browser MCP endpoint; it does not inherit unrestricted access to all registered browsers.

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
10. Agent providers receive only the browser sessions and context explicitly bound to them.

### Native Messaging

The Bridge installer registers only the effective PaneRelay Extension ID selected by the user.
Official builds default to `panplnkjlkoceaonlmpdekjphgmbggmi`, derived from the retained public
manifest key; a validated custom ID can be persisted for self-built Extensions. The Bridge rejects
messages that do not complete a versioned registration handshake with the same actual
`chrome.runtime.id`. On Windows, installation uses a user-owned launcher and the exact current-user
Chrome Native Messaging registry key.

Large payloads use bounded `transport.chunk` envelopes with transfer IDs, byte counts, ordering, and
CRC32 integrity metadata. `transport.cancel` abandons incomplete transfers. Receivers cap bytes,
chunk count, and individual frame size, expire incomplete transfers, and clear transfer state on
disconnect without retaining abandoned content.

### Local clients

The Bridge will generate a local authentication secret with user-only filesystem permissions. CDP WebSocket URLs will contain short-lived session credentials and will not be reusable after cleanup.

The Bridge must not listen on non-loopback interfaces in the first release.

### Extension permissions

The initial Chrome extension is expected to require `debugger`, `nativeMessaging`, `sidePanel`, `storage`, and tab-related permissions. Broad host access will be optional and requested per site or origin through a user gesture.

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
- If the automation client disconnects, the Bridge releases its leases and debugger attachments.
- If the Bridge restarts, the Extension reconnects and re-registers, but prior control leases do not revive automatically.
- If DevTools or another debugger displaces PaneRelay, the affected target closes and clients receive an explicit error.
- If a tab navigates outside authorized origins, mutating commands pause until authorization is re-evaluated.
- If side-panel event replay is incomplete, the UI reports the gap instead of implying a complete history.

## Compatibility strategy

PaneRelay will test against pinned agent-browser versions and publish a compatibility matrix.

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
packages/agent-browser
packages/cli
```

All publishable JavaScript packages will use the `@panerelay` npm scope. The scoped CLI package may expose the unscoped `panerelay` executable.

Code derived from another project must have clear provenance and compatible licensing before it is added. Product-specific integrations remain separate packages or downstream projects.

## Alternatives considered

### Maintain an agent-browser fork

A fork could add direct extension transport throughout the agent-browser daemon. It would offer deep integration but create continuous merge and release work. This RFC instead chooses a provider and CDP compatibility boundary that can work with upstream releases.

### Delegate high-level actions to a generic plugin

PaneRelay could expose `snapshot`, `click`, and similar commands as custom plugin actions. Existing agent-browser plugins do not replace core action execution, and a parallel action vocabulary would fragment CLI and MCP behavior. This alternative is not selected.

### Load the extension only into agent-browser-managed Chrome

agent-browser can load extensions into a browser it launches. This is useful for tests but does not connect to the user's existing tabs and daily browser session, which is a primary PaneRelay goal.

### Expose a raw remote-debugging port from the user's browser

Launching the daily browser with a remote-debugging port weakens the extension-controlled authorization model and may require a separate profile. PaneRelay instead exposes short-lived, policy-aware CDP sessions through the Bridge.

### Put the agent runtime inside the extension

This would constrain runtimes, complicate credentials, and place privileged logic in a frequently suspended environment. Agent runtimes remain local Bridge adapters.

## Delivery plan

### RFC-0001 reference delivery

- Define versioned protocol envelopes and provider-neutral conversation events.
- Build the Extension, Native Messaging Bridge, and authenticated loopback relay.
- Expose one explicitly authorized tab as a direct-page CDP endpoint.
- Integrate unmodified agent-browser through its Provider interface.
- Enforce one short-lived, exclusive, user-revocable control lease.
- Provide a Codex side-panel vertical slice with conversation lifecycle, streaming, approvals, and
  interruption.
- Provide setup, diagnostics, uninstallation, Agent guidance, and optional global Provider
  selection.
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
3. maintainers agree on exclusive, revocable tab control leases;
4. maintainers agree on the provider-neutral side-panel conversation contract;
5. maintainers agree on local-first deployment and loopback-only endpoints;
6. the RFC-0001 reference delivery assertions below all pass.

### Reference delivery status

| Assertion                                                                                                    | Status  | Evidence or remaining work                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An unmodified supported agent-browser client connects through PaneRelay.                                     | Pass    | Spike 0001 passed with agent-browser 0.33.0 in test and daily Chrome profiles.                                                                                                                                                                                                                |
| Snapshot, click, fill, navigation, wait, and screenshot work on an authorized existing tab.                  | Pass    | A current daily-Chrome run completed the checked-in action fixture through agent-browser 0.33.0, including filled state and post-navigation screenshots.                                                                                                                                      |
| Denied browser targets and missing leases fail closed.                                                       | Pass    | Exact-origin matching, Chrome permission removal, unsupported targets, invalid credentials, and lease conflicts are covered; a real all-tabs grant also survived Extension reload.                                                                                                            |
| Disconnect and user revocation reliably detach the debugger and invalidate credentials.                      | Pass    | Relay tests cover provider cleanup, credential expiry, and immediate extension revocation.                                                                                                                                                                                                    |
| Large messages support bounded chunks, integrity checks, cancellation, timeout, and cleanup.                 | Pass    | Protocol tests cover UTF-8 reassembly, sub-1 MiB frames, corruption rejection, explicit cancellation, timeout, and released receiver state.                                                                                                                                                   |
| The browser visibly identifies controlled state and offers immediate release.                                | Pass    | The Extension shows a controlled-tab count in its action badge, marks each attached page favicon with the agent-browser icon and a green status dot, and keeps release in the side panel.                                                                                                     |
| Codex uses the provider-neutral conversation contract for lifecycle, streaming, approvals, and interruption. | Pass    | Bridge contract tests cover provider discovery, normalized events, and approval requests.                                                                                                                                                                                                     |
| Qoder ACP uses the same provider-neutral boundary without becoming a prerequisite.                           | Pass    | Qoder CLI 1.1.2 completed two consecutive daily-Chrome browser turns; each terminal turn closed its scoped agent-browser connection before another Agent acquired control. Adapter tests cover capabilities, streaming, permissions, interruption, process restart, MCP scoping, and cleanup. |
| Local setup installs, diagnoses, and removes the Native Host, Provider configuration, and Agent guidance.    | Pass    | Setup and packed-consumer tests cover project/global selection, custom Extension IDs, doctor, Skill installation, scoped uninstall, and the Windows registry/launcher contract.                                                                                                               |
| Real Windows Chrome launches and removes the installed Native Host.                                          | Pending | Windows path, launcher, registry, update, and uninstall behavior has deterministic coverage; the stable release gate still requires a real Windows Chrome run from a path containing spaces.                                                                                                  |

## Open questions

The following dispositions keep unresolved ecosystem work from making RFC-0001 indefinitely broad:

1. RFC-0001's direct-page foundation is extended by
   [RFC-0002](0002-browser-level-cdp-and-agent-browser-compatibility.md), which defines
   browser-level target support.
2. CDP compatibility remains trace-driven. Unsupported methods return explicit errors.
3. RFC-0001 requires exclusive ownership; shared read-only observation requires a follow-up
   privacy and ownership decision.
4. External-agent activity convergence and handoff require a follow-up interoperability RFC.
5. Rich browser-context objects require a follow-up privacy and data-model RFC.
6. Direct-page leases belong to relay sessions. A broader principal model is deferred until
   handoff is specified.
7. Codex app-server and Qoder ACP are the initial provider adapters; future providers must adapt to
   the same normalized contract.
8. Setup registers one exact official or user-selected Extension ID. Broader pairing and managed
   enterprise distribution remain future policy topics.

## References

- [agent-browser plugin system](https://github.com/vercel-labs/agent-browser/blob/main/docs/src/app/plugins/page.mdx)
- [Chrome Extensions: `chrome.debugger`](https://developer.chrome.com/docs/extensions/reference/api/debugger)
- [Chrome Extensions: Native Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)
- [Chrome Extensions: Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
