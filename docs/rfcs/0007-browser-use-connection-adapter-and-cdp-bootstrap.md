# RFC-0007: Browser Use connection adapter and CDP HTTP bootstrap

- RFC: 0007
- Title: Browser Use connection adapter and CDP HTTP bootstrap
- Status: Accepted
- Authors: F-loat
- Created: 2026-07-31
- Updated: 2026-08-01
- OpenSpec: `openspec/changes/archive/2026-08-01-add-browser-use-connection-adapter`
- Amendments: `openspec/changes/relax-browser-use-version-gate`, `openspec/changes/add-browser-use-default-setting`

## Summary

Panerelay defines an optional Browser Use connection adapter behind the recurring Panerelay CLI. Setup installs the adapter and a Panerelay Browser Use Skill only when requested. The Skill continues to use Browser Use and Browser Harness automation semantics while the adapter supplies a short-lived authenticated HTTP CDP bootstrap URL for explicitly authorized targets in the user's existing Chromium browser.

Browser Harness uses one isolated, lazily started Panerelay daemon lane and keeps its virtual CDP WebSocket participant connected across sequential commands. Task completion does not stop that lane. Extension revocation, authorization loss, WebSocket or heartbeat failure, and Native Host shutdown remain authoritative cleanup boundaries.

No Browser Use upstream provider change, fork, PATH shim, global Browser Use configuration rewrite, or Chrome Remote Debugging requirement is introduced.

## Relationship to existing RFCs

- RFC-0001 remains authoritative for the Extension, Native Host, Bridge, authorization, local authentication, and automation-adapter boundaries.
- RFC-0002 remains authoritative for browser-level virtual CDP, target/session synthesis, logical activation, and browser-process ownership limitations.
- RFC-0004 remains authoritative for observed versus controlled attachments and visible revocation.
- RFC-0006 remains authoritative for deterministic browser registration selection and participant pinning.
- RFC-0003 describes the participant heartbeat, activity, expiry, and isolation behavior reused here, but remains marked Draft.

This RFC adds a durable Panerelay CLI adapter protocol, lazy HTTP-to-WebSocket bootstrap lifecycle, a persistent Browser Use participant, and two general virtual-CDP compatibility prerequisites within RFC-0002's existing authorized-target boundary. It does not supersede the existing permission, top-level inventory, foreground-focus, or control rules.

## Goals and non-goals

### Goals

1. Connect Browser Use CLI, its installed Panerelay Skill, and Browser Harness-backed CLI MCP to authorized daily-browser targets without modifying Browser Use upstream.
2. Put recurring integration calls behind an engine-neutral Panerelay CLI with separately installed adapters.
3. Allocate a Browser Use participant only when Browser Harness starts a new daemon connection.
4. Keep Direct and Extension Browser Use lanes independently selectable and reusable.
5. Bound credentials, localhost APIs, revocation, Native Host generations, and compatibility claims.

### Non-goals

1. Transparently change arbitrary Browser Use Python SDK construction.
2. Intercept every raw `browser-use` command or replace the official Browser Use Skill.
3. Reimplement Browser Use helpers, tasks, prompts, command sequencing, or page state.
4. Provide browser-process close, isolated contexts, process flags, whole-profile access, or focus-based authority.
5. Claim per-Agent task isolation inside one persistent Browser Harness daemon.

## Architecture

```text
Panerelay Browser Use Skill
          │
          ▼
  @panerelay/cli
  selection, mode, run
          │ bounded adapter stdio
          ▼
@panerelay/browser-use
  registration + bootstrap request
          │ authenticated loopback HTTP
          ▼
  Panerelay Bridge / Native Host
          │ short-lived HTTP CDP base
          ▼
Browser Harness persistent daemon
          │ virtual CDP WebSocket
          ▼
Bridge → Native Messaging → Extension → authorized targets
```

The Extension remains the only owner that starts the Native Host through `chrome.runtime.connectNative()`. Setup installs the manifest; neither CLI nor adapter starts a standalone imitation of the host.

## CLI adapter boundary

`@panerelay/cli` dispatches setup-registered adapters out of process through a versioned, bounded JSON stdio protocol. The CLI owns human-facing commands, localization, Direct/Extension mode selection, one-run override, browser selection, child process execution, signals, and exit status. It does not own an engine's automation commands.

Each adapter registration contains an identifier, exact absolute executable path, protocol version, and capabilities. The CLI does not discover adapters from PATH or package names and does not load them into its process. Adapter manifests declare the child-environment keys they may return.

The Browser Use adapter receives the selected opaque browser ID, rereads only that protected live registration, requests a bootstrap ticket using its Bridge bearer, and returns Browser Use connection environment. Bridge bearers never appear in command arguments, standard output, or adapter responses.

Setup installs a private version-pinned CLI launcher and adapter artifact for the Skill without installing either globally or changing shell PATH. A globally installed CLI remains optional and can read the same protected adapter registry.

The implemented user-facing surfaces are `panerelay connection use <adapter> <mode>`, `panerelay connection resolve <adapter>`, and `panerelay run <adapter> -- <exact child command>`. Setup records and injects the detected compatible Browser Use executable into its additive Skill; Agents do not discover the adapter or Browser Use executable from PATH.

## CDP HTTP bootstrap

The Bridge exposes an authenticated generic bootstrap request and a ticket-specific DevTools version endpoint:

```text
POST /cdp/bootstrap
GET  /cdp/bootstrap/<ticket>/json/version
WS   /cdp?session=<participant>&token=<connection capability>
```

The POST requires the current Bridge bearer and validates a bounded automation actor, lane key, and connection policy. It creates a random, memory-only, short-lived ticket but no participant, lease, target, or WebSocket.

The first valid ticket-specific `/json/version` request creates at most one participant and returns its virtual WebSocket URL. Repeated version requests are idempotent before connection. An invalid, expired, consumed, wrong-generation, or occupied-lane ticket fails closed without disclosing live state.

Browser Harness needs one WebSocket. Its participant uses a single-connection policy: the first successful handshake consumes the connection capability, further handshakes fail, and a later disconnected daemon obtains a new ticket. Existing agent-browser `/sessions` and multi-connection participant behavior remain unchanged.

Bootstrap is loopback-only, no-store, has no permissive CORS, bounds methods, paths, bodies, timeouts, and outstanding tickets, and excludes credentials and content from logs. Ticket capacity, participant capacity, invalid or expired tickets, generation changes, and occupied lanes have distinct bounded error codes. The ticket and participant are bound to one browser and Native Host generation; host shutdown invalidates all of them.

## Persistent Browser Use lane

The adapter supplies a private Browser Harness runtime directory, a protected temporary directory, a stable Panerelay daemon name, and a fresh HTTP CDP bootstrap URL. It also disables Browser Harness/Browser Use telemetry and automatic recording for this lane. The first Browser Use invocation starts the daemon and consumes the URL. Later sequential invocations reuse the healthy daemon and WebSocket; their unused tickets expire without consuming participant capacity.

Normal task completion does not close the lane because Browser Harness is intentionally daemonized and the Skill lacks a reliable cross-Agent task boundary. The side panel therefore presents a persistent Browser Use actor and retains immediate release. RFC-0004 continues to distinguish observed and controlled targets.

Browser Harness is not a child of the Native Host. Native Host shutdown closes its relay and participant but may leave a stale detached daemon process. Removing installed files does not itself prove that an already running Native Host disconnected, so uninstall reports that the current participant may remain until user release or Extension/Native Host disconnection. The next invocation must recover through verified Browser Harness public health/restart behavior or fail explicitly. Panerelay will not inspect undocumented daemon internals, kill broad process patterns, or silently fall back to Direct Chrome.

The canonical Panerelay CLI run surface serializes or fails simultaneous child invocations for this lane. Sequential commands from separate Agents may still interleave through Browser Harness's shared current-page/session state; the first release documents that limitation and does not claim task isolation.

## Connection modes

Panerelay stores a per-adapter Direct or Extension preference in protected Panerelay configuration. Extension mode uses the registered adapter and private daemon lane. Direct mode bypasses the adapter and invokes Browser Use with its normal environment and daemon behavior.

An explicit mode applies only to one CLI invocation and never mutates the saved preference. Changing the saved preference does not restart either lane. Browser selection follows RFC-0006 and never falls through from an unavailable explicit/default registration to another browser or Direct mode.

The Extension settings surface may change the saved Browser Use preference through versioned `browser-use-default.get`, `browser-use-default.set`, and `browser-use-default.clear` integration requests over the existing authenticated Native Messaging channel. The Bridge exposes this control only when the protected Browser Use adapter registration exists and declares Extension mode, and it delegates the read or write to the CLI adapter-configuration API. Results are bounded to availability, effective mode, and whether Panerelay is selected. Set chooses Extension mode and clear chooses Direct mode; neither operation starts Browser Harness, mints a bootstrap ticket, creates a participant, changes browser selection, or changes the independent agent-browser default.

## Security invariants

1. Site permission, tab authorization, browser selection, bootstrap ticket possession, participant allocation, and control lease remain distinct.
2. Focus never grants authorization or selects a registration.
3. Only a valid Bridge bearer can mint a bootstrap ticket.
4. Ticket issuance creates no participant or target state.
5. A Browser Use WebSocket credential is short-lived and consumed by its first handshake.
6. Unsupported or unauthorized CDP methods fail explicitly and never reroute to Direct Chrome.
7. User release, authorization loss, Extension disconnect, Native Host shutdown, transport loss, and heartbeat expiry remain fail-closed.
8. Local services remain loopback-only and omit permissive CORS.
9. Panerelay-owned components do not log credentials, page content, cookies, screenshots, prompts, request bodies, or raw CDP bodies by default. Browser Harness 0.1.8's unavoidable daemon log is confined to protected Panerelay-owned storage; its one-time WebSocket credential is consumed at handshake and the owned log is removed by uninstall or scoped cleanup.
10. The adapter cannot inject undeclared child environment or change the Browser Use executable and arguments selected by the caller.

## Compatibility

The user-facing minimum is Browser Use 0.13.7. Setup and doctor accept stable Browser Use releases at or above that floor only when the Browser Use environment is complete; they report one Browser Use status and tell users to install, repair, or upgrade Browser Use rather than manage its internal packages. Panerelay continues to probe the Browser Harness distribution internally with a 0.1.8 floor because the supported CLI, daemon, Skill-helper, and CLI MCP paths require it.

The exact verified integration baseline remains Browser Use 0.13.7 with Browser Harness 0.1.8. A newer pair that passes the minimum gate is eligible to run but is not automatically `Verified`. Claims cover the Panerelay Browser Use Skill, Browser Use CLI, and Browser Use CLI MCP. Python SDK transparency is not claimed.

Compatibility must be recorded as `Verified`, `Forwarded`, `Partial`, or `Unsupported` for bootstrap, initialization, core page operations, tab and popup lifecycle, child sessions, revocation, persistent reuse, concurrency behavior, Native Host reload, stale-daemon recovery, and browser-ownership limitations. agent-browser 0.33.0 remains the unchanged regression baseline for the shared Bridge.

The architecture-gate follow-up resolved both initial blockers at the generic Extension/virtual-CDP boundary. On daily Chrome, target-scoped `Emulation.setFocusEmulationEnabled({enabled:true})` made the unchanged Browser Harness key and coordinate mouse helpers pass; `Input.setIgnoreInputEvents({ignore:false})` did not. In a true cross-site OOPIF probe, Chrome rejected browser-wide `Target.getTargets` on the tab debuggee but successfully emitted and routed an iframe child session after non-pausing flattened `Target.setAutoAttach`.

Panerelay therefore enables focus emulation only before first Input use for a target/debugger generation, and synthesizes participant-local browser-level iframe target/session views from auto-attached child sessions. These implemented connection-layer behaviors are not Browser Use command translation. They do not foreground a tab, grant authority from focus, widen the authorized top-level inventory, expose raw Chrome identifiers, pause child startup, or claim containment. They share the normal target serialization and cleanup boundaries. The development candidate now includes the adapter and authenticated bootstrap, and daily-Chrome Browser Harness plus agent-browser regressions pass. Availability still begins only with the governed lockstep release.

## Alternatives considered

### Modify Browser Use or Browser Harness upstream

Deferred because a general provider lifecycle would be a substantial upstream change and is not required for the pinned CLI path.

### Pass a fresh raw WebSocket on every Skill call

Rejected because a healthy Browser Harness daemon ignores the new environment, leaving unused participants and credentials.

### Stable unauthenticated `/json/version`

Rejected because arbitrary local pages and processes could obtain automation authority.

### Long-lived naked CDP or bootstrap token

Rejected because Browser Harness stores connection environment and logs the resolved WebSocket URL. Tickets are short-lived and WebSocket credentials are consumed at handshake.

### Global same-name Browser Use shim

Rejected because it changes unrelated terminal and Agent behavior, complicates rollback, and hides which connection mode is active.

### Per-command or inferred per-task cleanup

Rejected because Browser Harness is intentionally persistent and the Skill cannot reliably observe task completion after cancellation or across Agents.

## Delivery and acceptance

The linked OpenSpec change owns implementation tasks and verification details. The committed bounded spike records the pinned Browser Harness initialization trace, lifecycle behavior, focus-emulation resolution, and OOPIF child-session capability. The development candidate implements and regresses the two generic virtual-CDP prerequisites, adapter protocol, authenticated bootstrap, setup integration, Skill, CLI MCP launcher, and private persistent lane. Product acceptance covers bootstrap races, core operations, tabs, popups, frames, single-tab cross-origin loss, visible user release, independent-target exclusion, reuse, reload, stale recovery, simultaneous invocation handling, and credential boundaries.

This RFC remains Accepted while the development candidate is tested. It must not move to Implemented until the lockstep Panerelay release and Browser Use compatibility record are published.
