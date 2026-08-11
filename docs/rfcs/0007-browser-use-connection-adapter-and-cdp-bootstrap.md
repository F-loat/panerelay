# RFC-0007: Browser Use connection adapter and CDP HTTP bootstrap

- RFC: 0007
- Title: Browser Use connection adapter and CDP HTTP bootstrap
- Status: Accepted
- Authors: F-loat
- Created: 2026-07-31
- Updated: 2026-08-11
- OpenSpec: `openspec/changes/archive/2026-08-01-add-browser-use-connection-adapter`
- Amendments: `openspec/changes/archive/2026-08-01-relax-browser-use-version-gate`, `openspec/changes/archive/2026-08-01-add-browser-use-default-setting`, `openspec/changes/show-control-engine-favicon`, `openspec/changes/archive/2026-08-02-make-adapter-installation-explicit`, `openspec/changes/archive/2026-08-03-add-playwright-cdp-integration`, `openspec/changes/archive/2026-08-03-simplify-setup-skill-installation`, `openspec/changes/archive/2026-08-04-add-conversation-target-hints`, `openspec/changes/shorten-conversation-target-session`

## Summary

Panerelay defines an explicitly selected Browser Use integration alongside the agent-browser Provider. `--browser-use` installs the integration and a user-scoped fixed CDP gateway. Setup writes Browser Harness's `BU_CDP_URL` default to the gateway, so the official `browser-use` CLI and `browser-use --cli-mcp` consume the same connection without a Panerelay process wrapper. The independent unified `panerelay` Skill documents this workflow and is managed through `npx skills`, not setup. The gateway mints short-lived authenticated CDP tickets only after selecting the saved browser and routes discovery to explicitly authorized targets in the user's existing Chromium browser.

Browser Harness uses one stable, lazily started user-scoped daemon lane and keeps its virtual CDP WebSocket participant connected across sequential commands. Task completion does not stop that lane. Extension revocation, authorization loss, WebSocket or heartbeat failure, and Native Host shutdown remain authoritative cleanup boundaries.

No Browser Use upstream provider change, fork, PATH shim, or Chrome Remote Debugging requirement is introduced. Panerelay does manage its own Browser Harness workspace `.env` file and a loopback gateway endpoint.

## Relationship to existing RFCs

- RFC-0001 remains authoritative for the Extension, Native Host, Bridge, authorization, local authentication, and automation-adapter boundaries.
- RFC-0002 remains authoritative for browser-level virtual CDP, target/session synthesis, logical activation, and browser-process ownership limitations.
- RFC-0004 remains authoritative for observed versus controlled attachments and visible revocation.
- RFC-0006 remains authoritative for deterministic browser registration selection and participant pinning.
- RFC-0003 describes the participant heartbeat, activity, expiry, and isolation behavior reused here, but remains marked Draft.

This RFC adds a user-scoped fixed discovery gateway, environment-default integration, lazy HTTP-to-WebSocket bootstrap lifecycle, a persistent Browser Use participant, and two general virtual-CDP compatibility prerequisites within RFC-0002's existing authorized-target boundary. It does not supersede the existing permission, top-level inventory, foreground-focus, or control rules.

The Playwright amendment adds a separate `/cdp/playwright` route and `playwright` engine/lane over the same authenticated bootstrap relay. It does not make the Browser Use route multi-client, does not alter Browser Use's persistent lane, and does not add Playwright to the Extension's default-setting surface. Playwright setup is opt-in and exposes only explicit `attach --cdp`/user-managed configuration; it installs no shim and edits no shell startup or user-owned Playwright configuration.

## Goals and non-goals

### Goals

1. Connect Browser Use CLI, the independently installed unified Panerelay Skill, and Browser Harness-backed CLI MCP to authorized daily-browser targets without modifying Browser Use upstream.
2. Keep mode persistence and browser selection in the engine-neutral Panerelay CLI while allowing the official Browser Use process to run directly.
3. Allocate a Browser Use participant only when the fixed gateway receives a valid discovery request.
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
Unified panerelay Skill
          │
          ▼
  @panerelay/cli
  selection + mode persistence
          │ managed BU_CDP_URL
          ▼
  fixed loopback Browser Use gateway
          │ authenticated bootstrap
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

The Browser Use gateway selects the saved opaque browser ID for the fixed environment URL, rereads only that protected live registration, requests a bootstrap ticket using its Bridge bearer, and returns only bounded DevTools version metadata to Browser Harness. A one-run adapter resolution may provide an opaque browser ID and generation in a scoped gateway URL; that route pins the live registration to the supplied generation and ignores inherited browser-selector environment variables. Bridge bearers and ticket WebSocket URLs never appear in command arguments, standard output, or Panerelay logs.

Setup installs the gateway and integration metadata without installing a Browser Use wrapper, changing shell PATH, or managing an Agent Skill. The official Browser Use executable remains the user's installation.

The implemented user-facing surfaces are `panerelay connection use <adapter> <mode>` and the shared browser-selection commands. Browser Use is invoked as the ordinary `browser-use` command. One-shot connection resolution remains bounded internal adapter machinery rather than a public CLI command, and Panerelay exposes no child-process wrapper.

## CDP HTTP bootstrap

The Bridge exposes an authenticated generic bootstrap request and a ticket-specific DevTools version endpoint:

```text
POST /cdp/bootstrap
GET  /cdp/bootstrap/<ticket>/json/version
WS   /cdp?session=<participant>&token=<connection capability>
```

The POST requires the current Bridge bearer and validates a bounded automation actor, a closed automation-engine identifier, lane key, connection policy, and optional canonical opaque initial target UUID. The registered Browser Use adapter always supplies `browser-use` independently from the caller-customizable actor name and session label. It creates a random, memory-only, short-lived ticket but no participant, lease, target, or WebSocket. An initial target is resolved only against the already selected browser's current authorized inventory and never expands that inventory.

The first valid ticket-specific `/json/version` request creates at most one participant and returns its virtual WebSocket URL. Repeated version requests are idempotent before connection. An invalid, expired, consumed, wrong-generation, or occupied-lane ticket fails closed without disclosing live state.

Browser Harness needs one WebSocket. Its participant uses a single-connection policy: the first successful handshake consumes the connection capability, further handshakes fail, and a later disconnected daemon obtains a new ticket. Existing agent-browser `/sessions` and multi-connection participant behavior remain unchanged.

Bootstrap is loopback-only, no-store, has no permissive CORS, bounds methods, paths, bodies, timeouts, and outstanding tickets, and excludes credentials and content from logs. Ticket capacity, participant capacity, invalid or expired tickets, generation changes, and occupied lanes have distinct bounded error codes. The ticket and participant are bound to one browser and Native Host generation; host shutdown invalidates all of them.

## Fixed gateway and persistent Browser Use lane

The integration writes a fixed user-scoped URL such as `http://127.0.0.1:43827/cdp/browser-use` to Browser Harness's managed workspace `.env`, together with a stable Panerelay daemon name and telemetry/recording safeguards. It intentionally leaves Browser Harness's runtime and temporary-directory defaults unchanged: Browser Harness 0.1.8 initializes client IPC paths before loading the workspace `.env`, so overriding those paths from `.env` can make the client and daemon resolve different sockets. `GET /cdp/browser-use/json/version` selects the current saved browser, while the scoped `GET /cdp/browser-use/browser/<opaque-selection>/json/version` route binds one-run adapter resolution to the selected browser ID and generation. Both routes perform the authenticated bootstrap and forward only bounded, controlled version metadata. The returned WebSocket URL remains dynamic and short-lived. The first Browser Use invocation starts the daemon and consumes that URL; later sequential invocations reuse the healthy daemon and WebSocket.

Normal task completion does not close the lane because Browser Harness is intentionally daemonized and the Skill lacks a reliable cross-Agent task boundary. The side panel therefore presents a persistent Browser Use actor and retains immediate release. When that participant issues a control-class command, the routed command carries `browser-use` so the Extension can mark the controlled document with the Browser Use icon and shared green control dot. Actor text, focus, and saved connection preference are not used to infer the icon. RFC-0004 continues to distinguish observed and controlled targets.

## Conversation target orientation

A new Side Panel conversation may carry the originating browser UUID and Extension-generated opaque target UUID as staleable locating data. The hint is not a credential, authorization decision, attachment request, or control lease. It never contains the raw Chrome tab ID.

Browser Use consumes the target UUID through Browser Harness 0.1.8's existing `switch_tab(targetId)` helper on the unchanged shared `BU_NAME=panerelay` daemon lane. The Skill selects that exact target before page helpers and verifies it with `page_info()`. Panerelay does not mint a per-conversation Browser Use lane, infer a target from URL or title, restart the daemon, or fall back to Direct mode when the target is absent. Existing busy and shared-current-page behavior remains authoritative.

Playwright uses a target-scoped discovery route, `/cdp/playwright/target/<opaque-selection>`, whose bounded base64url payload contains only the browser and target UUIDs. The gateway selects that live browser registration, derives the same canonical 56-character `panerelay-v2-<base64url(browser-bytes || target-bytes)>` Playwright CLI session label, and requests an authenticated bootstrap participant with the target UUID as its initial target. The compact shared value remains inside the pinned browser integrations' 64-character portable session boundary; malformed or legacy target encodings never fall back to the unscoped lane. The Bridge revalidates the target before participant allocation and initial discovery, publishes it first, and initializes its Playwright page session before other pages so `tab-list` exposes it at index `0`. A stale, wrong-browser, revoked, or unauthorized hint returns a bounded unavailable failure; it never makes another page index `0` on behalf of the hint. Unscoped Browser Use and Playwright routes and lanes are unchanged.

Browser Harness is not a child of the Native Host. Native Host shutdown closes its relay and participant but may leave a stale detached Browser Harness daemon process. Uninstall first stops the Panerelay gateway when its protected state and loopback health PID agree; it reports a gateway that cannot be verified or stopped and does not kill broad process patterns. Removing installed files still does not prove that an already running Browser Harness daemon disconnected, so the next invocation must recover through verified Browser Harness public health/restart behavior or fail explicitly. Panerelay will not inspect undocumented daemon internals, kill broad process patterns, or silently fall back to Direct Chrome.

The fixed gateway and Browser Harness lane serialize or fail overlapping connection attempts without a Panerelay child-process wrapper. Sequential commands from separate Agents may still interleave through Browser Harness's shared current-page/session state; the first release documents that limitation and does not claim task isolation.

## Connection modes

Panerelay stores a per-adapter Direct or Extension preference in protected Panerelay configuration. Extension mode writes the fixed gateway, stable daemon name, and telemetry/recording safeguards to Browser Harness's managed `.env`; Direct mode removes only those managed keys and lets Browser Use use its normal discovery and daemon behavior.

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
9. Panerelay-owned components do not log credentials, page content, cookies, screenshots, prompts, request bodies, or raw CDP bodies by default. Browser Harness 0.1.8's unavoidable daemon log remains in its protected user-scoped storage; its one-time WebSocket credential is consumed at handshake. Panerelay does not claim ownership of Browser Harness's default runtime or log directories.
10. The gateway binds to loopback only, returns no Bridge bearer, and retains the dynamic WebSocket credential boundary. Same-user local processes are within the gateway's trust boundary; cross-user access is not claimed.
11. Conversation target hints locate only an already exposed target in one selected browser. They never grant authorization or control, and failure never falls back to another target, browser, engine, or Browser Use daemon.

## Compatibility

The user-facing minimum is Browser Use 0.13.7. Setup and doctor accept stable Browser Use releases at or above that floor only when the Browser Use environment is complete; they report one Browser Use status and tell users to install, repair, or upgrade Browser Use rather than manage its internal packages. Panerelay continues to probe the Browser Harness distribution internally with a 0.1.8 floor because the supported CLI, daemon, Skill-helper, and CLI MCP paths require it.

The exact verified integration baseline remains Browser Use 0.13.7 with Browser Harness 0.1.8. A newer pair that passes the minimum gate is eligible to run but is not automatically `Verified`. Claims cover the Browser Use workflow in the unified `panerelay` Skill, Browser Use CLI, and Browser Use CLI MCP. Python SDK transparency is not claimed.

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

The linked OpenSpec change owns implementation tasks and verification details. The committed bounded spike records the pinned Browser Harness initialization trace, lifecycle behavior, focus-emulation resolution, and OOPIF child-session capability. The development candidate implements and regresses the two generic virtual-CDP prerequisites, adapter protocol, authenticated bootstrap, setup integration, independently distributed Skill workflow, CLI MCP surface, and user-scoped persistent lane. Product acceptance covers bootstrap races, core operations, tabs, popups, frames, single-tab cross-origin loss, visible user release, independent-target exclusion, reuse, reload, stale recovery, simultaneous invocation handling, and credential boundaries.

This RFC remains Accepted while the development candidate is tested. It must not move to Implemented until the lockstep Panerelay release and Browser Use compatibility record are published.
