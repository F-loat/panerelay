## Why

Firefox collaboration without agent-browser control leaves the primary Panerelay workflow incomplete. Firefox needs a real automation transport that preserves explicit tab authorization and revocation, while Chromium and Firefox Extension artifacts must stop carrying each other's platform-only background code.

## What Changes

- Split the Extension into browser-neutral shared services plus separate Chromium and Firefox background entry graphs. The Chromium bundle owns `chrome.debugger`, Target/CDP forwarding, Chromium side-panel setup, badges, and controlled favicons; the Firefox bundle owns sidebar integration, WebDriver rendezvous, Firefox readiness, and revocation.
- Add an explicit Firefox automation transport backed by a Panerelay-controlled WebDriver relay and geckodriver connected to a Firefox process started with Marionette enabled.
- Extend the agent-browser browser-provider contract in the automation engine so a Provider can select its existing WebDriver backend with a scoped endpoint and session ID. Do not emulate CDP in Panerelay or move snapshots, locators, waits, or input semantics into the Extension.
- Install an opt-in Panerelay Firefox launcher. Automation readiness explains that an already-running normal Firefox must be closed once and restarted through that launcher; Panerelay never closes it automatically.
- Map explicitly authorized Firefox Extension tabs to WebDriver window handles through one-time, browser-attested challenges. Ambiguous, unauthorized, stale, navigated, or revoked mappings fail closed.
- Generalize browser registration from a CDP-only boolean to an explicit automation transport while preserving compatible Chromium registrations.
- Add bundle-isolation, relay-policy, lifecycle, setup, compatibility, and release tests, plus real Firefox evidence when a runtime is available.
- Add a new RFC that supersedes only RFC-0005's Firefox automation non-goal. RFC-0001 through RFC-0004 permission, ownership, visibility, and revocation invariants remain authoritative.

Non-goals:

- Reimplement agent-browser commands, locator semantics, trusted input, or WebDriver behavior inside Panerelay.
- Translate WebDriver into a fake CDP server.
- Enable Firefox browser-chrome or unrestricted system access.
- Attach to a Firefox process that was not explicitly started with its automation transport enabled.
- Close, restart, or replace the user's Firefox process without an explicit user action.
- Claim complete parity for CDP-only network, tracing, profiling, or browser-process commands.
- Publish an upstream agent-browser release, Firefox AMO listing, or Panerelay release as part of this change.

## Capabilities

### New Capabilities

- `firefox-agent-browser-automation`: Opt-in Firefox launcher readiness, WebDriver Provider connection, authorized tab/window mapping, command routing, lifecycle, and revocation.

### Modified Capabilities

- `browser-platform-support`: Firefox changes from collaboration-only/CDP-unavailable to an explicit WebDriver automation transport with browser-specific authorization UI.
- `cross-browser-native-messaging`: Setup, update, doctor, and uninstall gain the managed Firefox launcher and automation runtime configuration.
- `guided-browser-readiness`: Firefox distinguishes a missing launcher/restart requirement, unavailable geckodriver, and a ready authorized WebDriver session.
- `stable-distribution`: Packed Extension checks enforce platform-only bundle graphs, and Firefox automation declares its coordinated agent-browser compatibility floor without changing the verified Chromium `0.33.0` baseline prematurely.

## Impact

- Affects `apps/extension`, `packages/protocol`, `packages/bridge`, `packages/setup`, `packages/agent-browser`, release scripts, compatibility records, and Native Messaging installation.
- Adds a Firefox WebDriver relay and managed launcher lifecycle to the Bridge/setup boundary.
- Requires a coordinated agent-browser Provider-contract addition that selects the existing WebDriver backend. The current `v0.33.0` Provider remains CDP-only and continues as the verified Chromium baseline until that addition is released and accepted.
- Supersedes the Firefox automation limitation in RFC-0005 through a new RFC; it does not weaken site permission, tab authorization, control lease, focus, revocation, logging, or loopback/user-scope invariants.
