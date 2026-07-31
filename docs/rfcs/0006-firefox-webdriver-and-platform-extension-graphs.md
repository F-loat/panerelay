# RFC-0006: Firefox WebDriver and platform Extension graphs

- RFC: 0006
- Title: Firefox WebDriver and platform Extension graphs
- Status: Accepted
- Authors: F-loat
- Created: 2026-07-31
- Updated: 2026-07-31
- Supersedes: RFC-0005 Firefox automation non-goal, CDP-only capability model, and single-background-graph decision

## Summary

Panerelay will support agent-browser automation in an explicitly started Firefox session through agent-browser's WebDriver backend, a participant-scoped Bridge relay, and geckodriver connected to Firefox through Marionette. Firefox will not claim CDP compatibility.

The Extension will build separate Chromium and Firefox entry graphs. Chromium owns `chrome.debugger` and CDP behavior. Firefox owns sidebar, WebDriver readiness, and authorized window rendezvous behavior. Shared code contains only browser-neutral collaboration, authorization, and protocol services.

RFC-0001 through RFC-0004 remain authoritative. Site permission, tab authorization, and a live control lease remain separate. Focus never authorizes a target, and revocation must become effective before later mutations.

## Motivation

RFC-0005 correctly rejected pretending that Firefox could use the Chromium Extension debugger path. The collaboration-only result is technically honest but incomplete for Panerelay's primary browser-control workflow.

Firefox exposes supported automation through Marionette, geckodriver, and WebDriver rather than the WebExtension `debugger` API. agent-browser `v0.33.0` already contains a generic WebDriver backend for Safari and iOS, but its browser-provider plugin result accepts only CDP. Spike 0006 shows that extending the automation-engine Provider boundary is smaller and more truthful than adding a CDP compatibility implementation to Panerelay.

The existing shared background entry also makes platform ownership difficult to inspect. Runtime guards prevent calls but do not prove that Firefox artifacts exclude Chromium-only debugger logic.

## Goals and non-goals

### Goals

1. Give supported agent-browser commands real WebDriver behavior in explicitly authorized Firefox tabs.
2. Keep WebDriver and locator/input semantics in agent-browser.
3. Keep the Bridge as the policy boundary in front of the browser-wide driver session.
4. Require an explicit user-managed Firefox automation start.
5. Produce browser artifacts containing only their platform-private adapters.
6. Preserve released Chromium registration and Provider compatibility.

### Non-goals

1. Translate Firefox WebDriver into CDP.
2. Implement automation actions in the Extension or shared protocol.
3. Enable Firefox browser-chrome or system access.
4. Attach transparently to Firefox after a normal process has already started.
5. Close or restart Firefox without explicit user action.
6. Claim CDP-only tracing, profiling, network containment, browser-context, or process-ownership capabilities.

## Terminology

- **Automation transport**: the browser connection family selected for a participant: Chromium CDP, Firefox WebDriver, or none.
- **Managed Firefox process**: Firefox explicitly started through the Panerelay launcher with Marionette enabled.
- **Real driver session**: the browser-wide geckodriver session owned by the Bridge.
- **Virtual WebDriver session**: a participant-scoped endpoint and session identity exposed to agent-browser.
- **Rendezvous challenge**: a one-time correlation value delivered through a WebDriver window and returned by the Extension content script with Firefox's sender tab identity.
- **Platform-private adapter**: code that depends on Chromium debugger/side-panel/indicator APIs or Firefox WebDriver/sidebar/rendezvous behavior.

## Proposed design

### Separate Extension graphs

Each manifest references its own background entry. A shared bootstrap depends on interfaces for panel, automation, target, and indicator behavior but never imports a platform-private module.

The Chromium graph contains debugger attachment, CDP commands/events, target lifecycle, Chromium side panel, action badge, and controlled favicon. The Firefox graph contains sidebar setup, automation readiness, authorization, and window rendezvous. Page comments, Agent conversations, workspaces, localization, Native Messaging, and provider-neutral state remain shared.

Builds emit module-ownership evidence and platform markers. Candidate validation rejects a Firefox archive containing Chromium-private modules or a Chromium archive containing Firefox-private modules.

### Transport registration

New registrations declare:

```text
automation?: {
  transport: "cdp" | "webdriver" | "none"
  ready: boolean
}
```

The Bridge normalizes the existing `capabilities.cdpRelay` field during migration. An older compatible registration with no capability remains CDP-capable. `cdpRelay: true` means ready CDP. `cdpRelay: false` means none unless an explicit ready WebDriver transport is present. Explicit `none` or `ready: false` always fails closed.

The normalized transport, not the browser-family presentation value, selects session allocation.

### agent-browser Provider contract

The automation engine will accept a backward-compatible browser-provider result for either CDP or WebDriver. Existing `cdpUrl` results retain current behavior. WebDriver results supply a scoped endpoint and an existing session ID and initialize agent-browser's existing WebDriver backend.

Panerelay will probe that capability before requesting a Firefox participant. Until a compatible agent-browser release exists, Firefox setup and Provider calls report a targeted upgrade requirement while Chromium continues using the verified `0.33.0` baseline.

### Managed Firefox startup

Setup installs a separate user-owned `panerelay-firefox` launcher. It resolves a validated Firefox executable and profile, enables only Marionette, and rejects system access, non-loopback remote access, conflicting profiles, and unsafe passthrough arguments.

The launcher never replaces a normal Firefox shortcut and never closes an existing browser. When Firefox was started normally, collaboration remains ready and automation reports the required close-and-reopen action.

The Bridge starts and owns geckodriver in connect-existing mode only after it can correlate the managed Firefox process. Driver cleanup does not terminate Firefox.

### WebDriver policy relay

The raw driver endpoint remains private. The Bridge gives each participant an unguessable loopback path and virtual session ID. It accepts only the W3C WebDriver routes required by the compatible agent-browser backend, rewrites virtual and real session identities, bounds responses, and avoids raw payload logging.

Window routes are policy-sensitive. Enumeration returns only mapped authorized windows. Switching and closing require a current mapping. Creation requires all-tabs authorization and completes rendezvous before returning. Page routes require both a selected mapped window and the current control lease.

Unsupported routes fail before forwarding. Deleting a virtual session releases the participant but does not request Firefox process shutdown.

### Authorized window rendezvous

For each real WebDriver handle, the Bridge sends a unique challenge into that window. The Firefox-only isolated content script returns it through Extension messaging. Firefox supplies the sender tab identity; the background forwards the response only for a currently authorized top document with current site permission.

The Bridge accepts one timely response and binds the handle to the existing opaque target. The challenge is not authority. Missing, duplicate, stale, unauthorized, navigated, or inconsistent responses fail closed. Navigation invalidates the mapping and requires a new rendezvous.

### Lifecycle and visibility

Firefox exposes the same current-tab and supported all-tabs authorization modes through its own adapter. Authorization creates eligibility, not a lease. The lease begins only when agent-browser creates a participant.

Revocation, permission removal, navigation, tab close, Extension disconnect, driver exit, Firefox exit, heartbeat expiry, participant close, and Bridge shutdown invalidate affected work and visible state before later mutations. Multiple participants retain independent virtual sessions and cleanup while target work remains serialized.

## Protocol and data model

Registration keeps the old field and adds the normalized input:

```text
capabilities?: {
  cdpRelay?: boolean
  automation?: {
    transport: "cdp" | "webdriver" | "none"
    ready: boolean
  }
}
```

Bridge state stores only the normalized transport and readiness in addition to existing bounded browser metadata.

Session creation returns a transport discriminator and one matching connection shape:

```text
transport: "cdp"
cdpUrl: string
```

or:

```text
transport: "webdriver"
webdriverUrl: string
webdriverSessionId: string
heartbeatIntervalMs: number
```

Connection URLs contain participant capabilities but no raw browser tab, driver port, Firefox profile, or real driver session identity. The coordinated agent-browser heartbeat uses only that scoped URL and virtual session identity; heartbeat expiry releases the participant without closing Firefox.

## Security and privacy

1. Enabling Marionette is an explicit user action and does not authorize any tab.
2. Site permission, tab authorization, rendezvous, and lease are independent gates.
3. Focus, active-tab state, URL, title, and challenge possession do not grant authority.
4. The Bridge never exposes geckodriver or system-access Firefox contexts.
5. Only exact WebDriver routes and mapped windows are forwarded.
6. Revocation invalidates mappings and participant credentials before later forwarding.
7. Runtime files and launchers are user-owned; network listeners bind to loopback.
8. Page content, input values, cookies, screenshots, challenges, driver payloads, prompts, and request bodies are not logged by default.

## Compatibility and migration

Chromium plus agent-browser `0.33.0` remains unchanged. Older Chromium Extension registrations normalize to CDP. New Firefox builds report WebDriver only when launcher, process, driver, relay, and compatible agent-browser readiness are all satisfied.

The previously released Firefox collaboration artifact remains usable after rollback. Disabling the WebDriver capability restores RFC-0005 behavior without removing Native Messaging, Agent conversations, projects, or page comments.

Firefox command groups remain Forwarded or Partial until real runtime evidence records exact Firefox, geckodriver, agent-browser, and Panerelay versions. CDP-only groups remain Unsupported.

## Alternatives considered

### Continue collaboration-only Firefox

Rejected because it leaves the primary agent-browser workflow unavailable.

### Translate content-script actions into CDP

Rejected because content scripts cannot provide trusted input or browser-level instrumentation and would move automation semantics into Panerelay.

### Build a CDP-to-WebDriver compatibility server

Rejected because it would reproduce a large, incomplete automation-engine surface and falsely describe Firefox as CDP-capable.

### Connect agent-browser directly to geckodriver

Rejected because WebDriver is browser-wide and would bypass the Bridge's per-tab policy and revocation boundary.

### Use URL/title matching for tab mapping

Rejected because page-controlled metadata and duplicate tabs are ambiguous.

### Enable Firefox system access to discover tab internals

Rejected because it creates browser-chrome authority outside the accepted per-tab model.

## Delivery plan

1. Split Extension platform graphs and prove archive isolation.
2. Add normalized automation transport registration.
3. Extend and validate the agent-browser WebDriver Provider contract.
4. Add Firefox launcher, driver discovery, health, and setup lifecycle.
5. Add the virtual WebDriver policy relay.
6. Add authorized window rendezvous and Firefox authorization UI.
7. Record transport-specific compatibility and real runtime evidence.

## Acceptance criteria

1. Chromium behavior and the `0.33.0` Provider path remain passing.
2. Firefox and Chromium archives contain only their own platform-private adapters.
3. Normal Firefox startup keeps collaboration ready and automation unavailable with actionable guidance.
4. Managed Firefox startup establishes a driver without exposing its endpoint or closing the browser on cleanup.
5. Compatible agent-browser commands operate only mapped authorized Firefox windows.
6. Unauthorized, stale, duplicate, navigated, and revoked mappings fail before forwarding.
7. Unsupported WebDriver command groups return explicit errors.
8. Participant close, revocation, driver exit, Extension disconnect, and Bridge shutdown clear the correct virtual sessions and visible control state.
9. Real Firefox evidence precedes any Verified compatibility claim.
10. Protocol, Bridge, Extension, setup, agent-browser fixture, release, OpenSpec, and repository checks pass.
