## Context

See `proposal.md` for motivation and the delta specs for observable behavior. The completed cross-browser change ships one large background source file behind runtime feature gates. Chromium can relay CDP through `chrome.debugger`; Firefox cannot. Firefox can be controlled through geckodriver/Marionette only when the process was started with remote control enabled.

Spike [0006](../../../docs/spikes/0006-firefox-agent-browser-transport.md) inspected agent-browser `v0.33.0`. Its browser-provider result accepts only a CDP URL, but its automation engine already contains a generic WebDriver backend used by Safari and iOS. This creates a narrow upstream contract gap instead of a reason to reproduce automation semantics in Panerelay.

RFC-0001 through RFC-0004 remain authoritative for Extension connection, explicit authorization, browser-level target ownership, control visibility, and revocation. RFC-0005 remains the record of the collaboration-only Firefox release. A new RFC will supersede its Firefox automation non-goal and transport model without rewriting that history.

## Goals / Non-Goals

**Goals:**

- Give compatible agent-browser commands real Firefox WebDriver behavior on explicitly authorized tabs.
- Make the Bridge the policy boundary between agent-browser and an otherwise browser-wide WebDriver session.
- Produce inspectable Chromium and Firefox Extension graphs with no platform-private adapter in the other artifact.
- Keep normal Firefox startup and collaboration usable without automation.
- Preserve the Chromium `0.33.0` behavior and protocol migration path.

**Non-Goals:**

- Make WebDriver look like CDP or claim parity for CDP-only command groups.
- Add a Panerelay locator, snapshot, input, wait, or network automation engine.
- Enable Firefox system access or automate browser chrome.
- Reconfigure the user's normal Firefox shortcut or silently restart the browser.
- Treat WebDriver readiness, focus, a challenge response, or site permission alone as tab authorization.

## Decisions

### Build separate browser entry graphs around shared services

The current `src/background/index.ts` will become a browser-neutral bootstrap that accepts platform adapters. Browser-specific modules will live below distinct entry directories:

```text
src/background/shared/
  bootstrap.ts
  native-host-client.ts
  agent-service.ts
  authorization-service.ts
  page-comment-service.ts
  workspace-service.ts

src/background/chromium/
  index.ts
  cdp-automation.ts
  target-lifecycle.ts
  panel.ts
  indicators.ts

src/background/firefox/
  index.ts
  webdriver-rendezvous.ts
  panel.ts
  readiness.ts
```

The Chromium manifest imports only `background/chromium/index.ts`; the Firefox manifest imports only `background/firefox/index.ts`. Shared code depends on small interfaces and never imports either platform directory. Platform entries construct the adapters and call shared bootstrap.

The side-panel/sidebar UI remains mostly shared but receives a build-time platform descriptor through separate page entry wrappers. Browser-specific settings components are imported only from their own wrapper. Runtime feature detection remains a defensive check, not the mechanism used to exclude code.

Vite will emit a module-ownership manifest for each target. Browser-private modules also retain a short platform marker in production. Package and release validation require the expected marker and module graph and reject the other platform marker.

Keeping one entry with `if (firefox)` branches was rejected because dynamic API guards do not prove that Chromium-only code is absent from the Firefox artifact.

### Generalize automation transport without changing old Chromium registrations

The registration capability becomes:

```text
automation?: {
  transport: "cdp" | "webdriver" | "none"
  ready: boolean
}
```

The existing optional `cdpRelay` field remains accepted during one compatibility window:

- missing `automation` plus missing `cdpRelay` keeps the accepted older-Chromium behavior;
- `cdpRelay: true` normalizes to ready CDP;
- `cdpRelay: false` normalizes to no automation unless an explicit WebDriver capability is present;
- an explicit `automation.transport: "none"` or `ready: false` is authoritative.

Bridge state exposes the normalized transport. `/sessions` allocates a transport-specific participant only after readiness checks. Browser family remains presentation and routing metadata; it never grants authority.

Replacing the boolean in place was rejected because released same-protocol Chromium artifacts must reconnect safely.

### Extend agent-browser's Provider result instead of adding a CDP shim

The coordinated agent-browser change extends `BrowserProviderResult` compatibly:

```text
transport?: "cdp" | "webdriver"
cdpUrl?: string
webdriverUrl?: string
webdriverSessionId?: string
directPage?: boolean
cleanup?: JSON
metadata?: JSON
```

An omitted transport with `cdpUrl` retains Provider v1 behavior. A WebDriver result requires both its endpoint and existing session ID. agent-browser constructs its existing `WebDriverClient`/`WebDriverBackend`, retains its current unsupported-action gate, and invokes the existing provider cleanup request at close.

The Panerelay plugin checks an agent-browser capability probe before requesting a Firefox relay session. During development, acceptance pins the exact coordinated source commit. Stable setup names a semantic minimum only after that contract ships.

Implementing WebDriver operations in `@panerelay/agent-browser` was rejected because that package is a Provider adapter and RFC-0001 keeps automation semantics in the automation engine. A CDP-to-WebDriver translation server was rejected because it would be incomplete, expensive to secure, and dishonest about command compatibility.

### Use an explicit Firefox launcher and geckodriver connect-existing mode

Setup discovers a Firefox executable and geckodriver separately. It installs a per-user `panerelay-firefox` launcher beside other Panerelay-managed files. The launcher:

1. resolves a configured or default Firefox profile without modifying profile contents beyond Firefox's own Marionette startup state;
2. rejects system-access, remote-host, unvalidated executable, and conflicting profile arguments;
3. starts Firefox with `--marionette`;
4. writes bounded process and readiness metadata to a user-only runtime file;
5. never terminates an existing Firefox process to make the launch succeed.

The Native Host detects that the Extension belongs to the managed process and asks the Bridge to start geckodriver with `--connect-existing`. geckodriver's HTTP listener uses an ephemeral loopback port. Its Marionette connection uses the selected Firefox process's configured loopback port.

The raw geckodriver listener is never returned to agent-browser. Bridge cleanup closes its driver/session and runtime metadata but leaves Firefox running.

Using Firefox Remote Agent WebDriver BiDi directly was considered. agent-browser already has a common WebDriver HTTP backend and geckodriver provides the needed existing-process session lifecycle, so the W3C WebDriver path minimizes new automation-engine work. BiDi can be added later inside agent-browser for command groups that need it.

### Relay a virtual WebDriver session through the Bridge

The Bridge creates one real geckodriver session for the connected managed Firefox process and one virtual session per Panerelay participant. Each Provider receives:

- a loopback relay URL containing an unguessable participant path capability;
- a virtual WebDriver session ID;
- bounded browser/version/expiry metadata;
- cleanup data tied to the current Bridge PID and browser registration.

The relay accepts only exact W3C WebDriver routes used by the compatible agent-browser backend. It replaces the virtual session ID with the real driver session ID, checks the participant and current target mapping, forwards the request, bounds the response, restores virtual identifiers, and emits only sanitized activity.

Window enumeration, switching, closing, and creation are policy-sensitive:

- enumeration filters to participant-mapped authorized windows;
- switching requires a current mapping;
- closing removes only the selected mapped window;
- creation requires all-tabs authorization and maps the new window before returning it.

Other element, script, navigation, screenshot, and input routes require a selected mapped window and current control lease. Browser/session deletion releases the participant but does not request Firefox process shutdown.

Letting agent-browser connect directly to geckodriver was rejected because a WebDriver session is browser-wide and would bypass the Bridge's per-tab authorization and revocation boundary.

### Map Extension tabs to WebDriver windows with a browser-attested rendezvous

The Firefox manifest registers a small rendezvous content script only on origins for which the user granted Extension access. Mapping proceeds as follows:

1. the Bridge enumerates WebDriver window handles and generates a unique challenge for one handle;
2. through that WebDriver window it dispatches a bounded `window.postMessage` challenge;
3. the isolated Panerelay content script receives the event and sends it to the Firefox background;
4. Firefox supplies `sender.tab.id`, URL, document identity, and frame origin to the background;
5. the background forwards the challenge only if the sender is the top document of a currently authorized eligible tab;
6. the Bridge accepts exactly one timely response and binds the handle to the tab's existing opaque target ID.

The challenge is correlation data, not authority. A page can observe or block its own challenge, causing mapping failure, but it cannot forge Firefox's `sender.tab.id`. An unauthorized tab response is ignored. Duplicate responses fail closed. Navigation changes the document identity and invalidates the mapping until a new rendezvous completes.

URL/title matching alone was rejected because duplicate tabs and page-controlled metadata make it ambiguous. Firefox system-access evaluation was rejected because it would expose browser-chrome authority through an unauthenticated browser remote-control surface.

### Preserve explicit authorization and participant lifecycle

Firefox gains the same user-facing current-tab and all-tabs automation authorization modes as Chromium, implemented by its own adapter. Site permission and tab authorization remain separate. The Firefox adapter never uses focus as authorization.

The Bridge acquires the control lease only after agent-browser creates a participant. Multiple participants may reuse the real driver session but retain virtual session IDs, selected targets, serialization, heartbeat, and cleanup. Commands are serialized per mapped window.

Revocation first invalidates mappings and participant work in the Bridge, then refreshes Extension state. Extension disconnect, driver exit, Firefox exit, document navigation, permission removal, target close, heartbeat expiry, participant close, and Bridge shutdown use the same terminal cleanup discipline.

### Keep compatibility claims transport and evidence specific

Chromium plus agent-browser `0.33.0` remains Verified and unchanged. The Firefox compatibility table is grouped by WebDriver backend command family:

- deterministic relay/backend coverage without a real browser is Forwarded;
- available collaboration plus a missing managed restart or driver is Partial;
- commands rejected by agent-browser's WebDriver unsupported list are Unsupported;
- a group becomes Verified only after a dated real Firefox run records exact Firefox, geckodriver, agent-browser, Extension, and Panerelay versions.

The new RFC is Accepted while this change is under development. Like other RFCs, it remains Accepted rather than Implemented until released.

## Risks / Trade-offs

- [The required agent-browser Provider contract is outside this repository] → Prepare a minimal upstream patch and contract fixture against the pinned tag, keep Firefox automation gated until a released version is detected, and do not lower Chromium compatibility.
- [Firefox must be restarted through a special launcher] → Make the state explicit and one-step, never close the browser automatically, and keep collaboration usable after normal startup.
- [A page can observe or suppress the rendezvous challenge] → Treat the challenge only as correlation, accept only browser-attested responses from currently authorized tabs, reject duplicates, and classify suppression as fail-closed denial rather than authorization.
- [WebDriver is browser-wide underneath the relay] → Never expose geckodriver, filter every window route, require a current mapping and lease for page routes, and invalidate mappings before forwarding after revocation.
- [geckodriver and Firefox versions can drift] → Probe versions in setup/doctor and maintain a dated compatibility matrix rather than a broad unversioned claim.
- [WebDriver backend supports fewer command groups than Chromium CDP] → Surface the automation engine's existing unsupported errors and document capability groups separately.
- [Separate entries can cause shared-service drift] → Keep browser-neutral behavior behind adapter contracts and run the same shared contract suite against both adapter fixtures.
- [Driver startup or cleanup can leave stale files/processes] → Use PID/browser-instance correlation, user-owned runtime files, health checks, idempotent cleanup, and no process kill unless the PID was spawned and owned by Panerelay.

## Migration Plan

1. Land the Extension entry-graph split with behavior-preserving Chromium tests and Firefox collaboration tests.
2. Add normalized transport registration while retaining `cdpRelay` compatibility.
3. Prepare and validate the coordinated agent-browser WebDriver Provider patch against the pinned source tag.
4. Add Firefox launcher/driver discovery and readiness without enabling authorization UI until the full relay is available.
5. Add Bridge virtual WebDriver sessions, rendezvous mapping, authorization, revocation, and command-policy tests.
6. Enable Firefox automation UI only when every runtime capability is ready.
7. Record real Firefox evidence and set the released agent-browser minimum.

Rollback disables the explicit Firefox WebDriver capability and authorization UI while preserving the already released Firefox collaboration surface. Chromium remains on its existing CDP adapter throughout.

## Open Questions

- The semantic version of the first released agent-browser WebDriver Provider contract is unknown until the coordinated upstream change is accepted.
- Real Firefox testing will determine the initial verified geckodriver/Firefox version pairs and any platform-specific launcher limitations without changing the chosen transport or authorization design.
