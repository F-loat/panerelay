# RFC-0003: Control session lifecycle and external-agent activity

- RFC: 0003
- Title: Control session lifecycle and external-agent activity
- Status: Draft
- Authors: F-loat
- Created: 2026-07-29
- Updated: 2026-08-02
- OpenSpec amendment: `openspec/changes/show-control-engine-favicon`

## Summary

Panerelay will make external browser observation and control visible as one provider-neutral browser control lease with bounded, independently authenticated relay participants. The Bridge maintains per-participant liveness with authenticated WebSocket heartbeat, expires unresponsive participants, serializes target-scoped command lifecycles, and emits a bounded stream of participant-attributed sanitized activity events. The Extension side panel shows the current external actor, participant count, observed-target count, controlled-target count, lease state, and recent action categories while keeping immediate release available through browser authorization.

This RFC implements the activity, liveness, and participant-isolation foundation needed before browser-context sharing or human control handoff. It does not introduce overlapping target mutation, persistent surveillance, or a raw CDP audit log.

## Motivation

RFC-0001 requires leases to have ownership, expiration, heartbeat, visible activity, and immediate revocation. A single Provider allocation cannot represent independently scoped side-panel and external Agent work: sharing one credential leaks lifecycle and refs, while rejecting later allocations forces users to release working browser control manually. Participants provide isolated credentials and state while reusing only the already-authorized browser lease and debugger attachments.

This foundation was insufficient for a public release until the activity and liveness work below was implemented. Users need an answer to four questions without exposing sensitive browser data:

1. Is an external Agent connected?
2. Which actor most recently used control, and how many Agents are connected?
3. Is it currently reading, navigating, interacting, or diagnosing?
4. Did the session finish, fail, expire, or get released?

## Goals and non-goals

### Goals

1. Give every active automation lease a visible current actor, participant count, and lifecycle state.
2. Renew participant liveness only through its authenticated CDP transports.
3. Expire only an unresponsive participant while preserving responsive participants, and detach every observed or controlled target when the last participant ends.
4. Emit coarse action lifecycle events with stable sequencing and bounded retention.
5. Show external-agent activity and history gaps in the side panel.
6. Preserve agent-browser 0.33.0 as the minimum supported baseline without requiring changes to its CLI or daemon.

### Non-goals

1. Transfer control between external and side-panel Agents.
2. Permit overlapping target-scoped mutations without deterministic serialization.
3. Store a durable, cross-browser, or cloud audit history.
4. Record raw CDP params/results, URLs, page text, screenshots, prompts, cookies, credentials, headers, request bodies, storage values, or local file paths.
5. Infer user intent or classify whether an operation is safe.
6. Add browser contexts, process launch control, proxying, or other capabilities excluded by RFC-0002.

## Terminology

- **Control lease**: the Bridge-owned Panerelay automation lease for one authorized browser.
- **Relay participant**: one independently authenticated Agent allocation inside the control lease.
- **Transport**: an authenticated WebSocket connection belonging to one relay participant.
- **Heartbeat**: a Bridge WebSocket ping acknowledged by a transport pong.
- **Activity**: one sanitized lifecycle record derived from an Agent CDP command.
- **Activity epoch**: an opaque identifier for one in-memory activity history. A changed epoch tells the UI that earlier history is unavailable.
- **Observed target**: a debugger-attached target that has received only RFC-0004 passive setup or explicitly allowlisted read-only commands.
- **Controlled target**: an attached target that has accepted at least one RFC-0004 control-class command.

## Proposed design

### Control-lease states

A lease moves through these states:

```text
allocated -> connected -> active -> released
                           \-> expired
                           \-> failed
```

- `allocated`: at least one participant received a short-lived CDP credential, but no transport connected.
- `connected`: at least one participant has a responsive authenticated transport.
- `active`: one or more authorized targets are observed, controlled, or have a CDP command in flight.
- `released`: the last Provider participant, last client disconnect, or user explicitly released control.
- `expired`: every participant allocation or connected transport expired.
- `failed`: the Extension or Bridge lost the ability to maintain the session.

Terminal leases never revive. Each participant ID and credential also becomes permanently stale after its release or expiry. A responsive participant keeps the lease alive without reviving another participant.

### Heartbeat and expiry

The Bridge sends WebSocket ping frames to every control transport at a fixed interval. The `ws` client used by agent-browser responds at the protocol layer without an agent-browser change.

Each transport records its most recent authenticated command, connection, or pong time. A participant remains live while at least one of its transports is responsive. When every transport for one participant exceeds the heartbeat deadline, the Bridge removes that participant, closes its transports, rejects its queued and pending work, and removes its virtual CDP sessions. Other participants and their referenced target attachments remain active.

When the final participant ends, the Bridge:

1. marks the lease expired;
2. closes all remaining transports;
3. rejects pending target and CDP operations;
4. instructs the Extension to detach all observed and controlled targets;
5. emits a terminal control-lease status.

The existing Provider `connectExpiresAt` remains only that participant's unused allocation window. Heartbeat expiry starts after its first transport connects.

Heartbeat intervals and deadlines are internal bounded constants in the first implementation. They are not user-configurable until compatibility evidence shows a need.

### Target scheduling and isolation

Every participant receives its own opaque credential, transport set, virtual flattened page sessions, pending command correlation, and cleanup boundary. Target discovery and the underlying Chrome debugger attachment are lease-wide. The Bridge processes a complete target-scoped command lifecycle FIFO per target and releases the queue on result, failure, timeout, cancellation, or participant cleanup. Different targets may progress independently.

### Activity classification

The Bridge observes CDP method names it already routes and maps them into stable provider-neutral categories:

- `target`: discover, attach, activate, create, or close a target;
- `navigation`: navigate, reload, history, or lifecycle waiting;
- `interaction`: DOM input, keyboard, mouse, focus, upload, or dialog handling;
- `read`: Runtime, DOM, Accessibility, snapshot, or screenshot reads;
- `state`: cookie or web-storage operations;
- `network`: Network or Fetch diagnostics, emulation, or routing;
- `emulation`: viewport, media, locale, timezone, user-agent, or device emulation;
- `artifact`: PDF, tracing, profiling, or screencast work;
- `other`: a known-routed method that does not fit another category.

Classification is informational and does not authorize a command or decide whether a target is observed or controlled. RFC-0004 defines a separate fail-closed method allowlist for that access-state decision; activity categories may continue to group mixed read and write methods.

Each activity record contains:

- opaque activity and session IDs;
- the issuing participant's actor name and optional session label;
- opaque target ID when a target is involved;
- category and a user-facing action label;
- `started`, `completed`, `failed`, or `denied` status;
- timestamps and a monotonic sequence number;
- a sanitized error summary when failed.

It does not contain command params or results. The Bridge may keep the original CDP method only inside the in-flight correlation map; it is not sent to the Extension.

### Bounded history and gaps

The Bridge owns a bounded in-memory ring of recent activity for the active control session. The Extension owns a smaller bounded view for the current browser connection. Neither is persisted to disk in this RFC.

Every stream has an opaque epoch and increasing sequence number. On registration, side-panel open, or detected sequence discontinuity, the Extension requests or receives a snapshot. If the first available sequence is newer than the expected sequence, the UI renders a visible history-gap notice. A Bridge restart changes the epoch and prior events are not implied to exist.

### Side-panel presentation

The side panel's browser-access settings panel adds an external-control section that shows:

- most recently active Agent name and optional session label;
- connected participant count when more than one Agent is present;
- `Connected`, `Active`, `Expired`, `Released`, or `Failed` state;
- observed-target count;
- controlled-target count;
- last heartbeat freshness in coarse human-readable form;
- recent activity rows with category, label, status, and time;
- an explicit history-gap row when applicable;
- browser authorization controls that can immediately release the complete lease.

The panel does not display raw CDP method names, params, results, page URLs, or captured content. Side-panel Codex conversation activity remains a separate stream until handoff is specified.

Outside the panel, a controlled top-level document uses a compact engine-attributed favicon indicator. The Bridge attaches the closed `agent-browser` or `browser-use` engine identifier from the exact authenticated participant to each forwarded control command; the Extension renders that engine's mark with the shared green control dot. This indicator means only that the engine most recently sent a control-class command to the page. It does not grant authority, imply exclusive ownership, or follow focus, actor display names, or default settings. Passive observation does not change the page favicon, and detach or release restores the favicon captured before control began.

## Protocol and data model

The shared protocol adds:

- `ControlSessionSummary`, including independent `observedTargetCount` and `controlledTargetCount`
- `AutomationActivity`
- `control.session.changed`
- `control.activity.snapshot`
- `control.activity.updated`
- `AutomationEngineId`, carried on participant-attributed target commands that can update the controlled-page indicator

The Bridge sends these messages to the Extension over the existing chunked Native Messaging channel. The Extension side panel continues to use `chrome.runtime` messages and does not connect directly to the loopback Bridge.

`RelaySessionActor` remains provider-neutral. `ControlSessionSummary.participantCount` reports the bounded live participant set, while each activity preserves its issuing participant actor. The first actor kind is `automation`; future RFCs may add conversation and human principals without reinterpreting existing IDs.

Automation-engine identity remains separate from `RelaySessionActor`: actor names and session labels are bounded presentation data and may be customized, while the engine identifier is assigned by the governed integration path. agent-browser `/sessions` participants receive `agent-browser`; authenticated Browser Use bootstrap participants receive `browser-use`. Unknown engine identifiers fail protocol validation until their branding and compatibility boundary are deliberately added.

Protocol identifiers remain opaque. Chrome tab IDs, debugger session IDs, and raw Provider credentials never appear in activity events.

## Security and privacy

1. Heartbeats prove transport responsiveness, not user intent or operation safety.
2. Only a transport authenticated to its relay participant can renew that participant's liveness.
3. Activity observation never widens Chrome permissions or tab authorization.
4. Activity events are emitted after the Bridge has associated a command with an authorized virtual target session.
5. Parameters and results are excluded by construction rather than redacted after logging.
6. Browser activity excludes raw error payloads. Conversation Provider adapters may separately expose bounded documented user-facing failure text in an expandable error disclosure.
7. Histories are bounded, memory-only, and cleared on browser unregister or Bridge restart.
8. User release remains available even when activity rendering fails.

## Compatibility and migration

agent-browser 0.33.0 remains the initial version-specific evidence baseline and minimum supported version. Newer versions satisfy the version floor but need separate evidence. WebSocket ping/pong is transparent to the Provider and daemon, so no new agent-browser option is required.

Existing Extension builds that do not understand the new message types are incompatible with the updated Bridge protocol package and must be rebuilt as one lockstep Panerelay release. A future protocol revision will require additive version negotiation.

RFC-0001 and RFC-0002 retain authority over authorization, target routing, and unsupported browser-process operations. RFC-0004 supersedes RFC-0002 only for attachment, observation, controlled-count, and favicon semantics. This RFC adds participant isolation, per-target scheduling, liveness, and visibility without widening Chrome permissions.

## Alternatives considered

### Treat any open TCP connection as live forever

This matches the current prototype but cannot recover from a suspended or half-open automation client. It leaves stale debugger attachments and control ownership ambiguous.

### Require an agent-browser heartbeat command

An explicit application command would be easy to reason about but would require upstream changes or a Panerelay-specific daemon fork. WebSocket ping/pong provides transport liveness through the existing Provider boundary.

### Log every CDP method and params

Raw logs provide excellent diagnostics but can reveal URLs, selectors, entered text, headers, cookies, file paths, request bodies, and page content. Coarse categories provide product visibility without creating a surveillance log.

### Persist audit history to disk

Persistence would improve postmortem analysis but requires retention, encryption, deletion, consent, and data-model decisions beyond this local-first activity slice.

## Delivery plan

1. Add protocol types and validation for control-session and activity messages.
2. Add per-participant heartbeat, expiry, independent cleanup, target queue, and terminal-state tests to the Bridge.
3. Classify routed commands and emit correlated activity lifecycle events.
4. Buffer bounded activity snapshots with epoch and sequence metadata.
5. Add Extension state and side-panel rendering for external control.
6. Run an agent-browser 0.33.0 daily-Chrome scenario covering active, completed, failed, released, and expired states.

## Acceptance criteria

1. A connected agent-browser transport responds to Bridge heartbeat without an upstream change.
2. One responsive transport keeps its participant alive.
3. An unresponsive participant expires without disrupting a responsive participant.
4. When the final participant ends, the lease expires and every observed or controlled debugger attachment is detached.
5. User release and normal Provider cleanup remain immediate and participant-scoped where applicable.
6. Two participants receive isolated virtual sessions and serialized target command lifecycles.
7. Started commands emit one participant-attributed sanitized activity with a correlated terminal status.
8. Activity events contain no raw params, results, page content, URLs, cookies, credentials, headers, prompts, request bodies, storage values, or file paths.
9. The side panel displays current external actor, participant count, lease state, separate observed-target and controlled-target counts, and recent activity.
10. A changed epoch or sequence discontinuity produces a visible history-gap notice.
11. Bridge, Extension, protocol, and real-browser acceptance tests pass.

## Implementation evidence

The 2026-07-29 development build was verified with agent-browser 0.33.0, the unpacked Extension, and the installed Native Host in the user's existing Chrome profile. Mutating checks stayed on the checked-in loopback fixture.

- `@panerelay/setup doctor` passed every installation and connection check after Extension reload.
- A fresh Provider session discovered the authorized fixture, read its accessibility snapshot, filled and clicked the form, and observed the resulting page state.
- After 38 seconds without an Agent command, beyond the 35-second active-lease deadline, the same session still read the page title. This verifies that transparent WebSocket pong traffic renews an otherwise idle agent-browser lease.
- The browser-access settings panel showed the actor and session label, active target count, healthy heartbeat, localized completed activity rows, and the immediate release action. The chat timeline remained free of external-control activity.
- Closing the agent-browser session released the control session, and the local fixture process and temporary inspection window were removed after verification.
- `pnpm run check` and `git diff --check` cover heartbeat expiry, multiple transports, pending command races, explicit user release, stale reconnect rejection, activity correlation, bounded replay, history gaps, light/dark rendering structure, and sensitive-value exclusion.

The 2026-07-30 participant-reuse run installed the updated Native Host into the same daily Chrome profile and kept the existing browser authorization. Two independently named agent-browser 0.33.0 sessions simultaneously listed the same eight eligible tabs and concurrently read the title of the same GitHub target. Closing the first participant left the second usable; closing the second completed normally. Deterministic Bridge tests additionally cover a stale participant expiring without affecting a responsive participant, shared target attachment reuse, per-target FIFO forwarding, and queued-command cancellation.

The real-browser run does not deliberately suppress automatic WebSocket pong traffic, restart the Bridge during control, or inject arbitrary CDP failures into the daily profile. Expiry, replay-gap, and failed/denied states therefore remain deterministic automated-test evidence rather than daily-Chrome mutation scenarios.

## Open questions

1. Should public builds expose fixed heartbeat timing in diagnostics without making it configurable?
2. Should a future durable audit mode be opt-in per session or per browser profile?
3. Which activity labels should be localized in the Extension versus standardized in the protocol?
4. Should browser-context sharing reuse this activity stream or define a separate user-authored event channel?
