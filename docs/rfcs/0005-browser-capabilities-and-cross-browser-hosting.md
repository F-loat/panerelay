# RFC-0005: Browser capabilities and cross-browser hosting

- RFC: 0005
- Title: Browser capabilities and cross-browser hosting
- Status: Accepted
- Authors: F-loat
- Created: 2026-07-31
- Updated: 2026-07-31

> RFC-0006 supersedes this RFC's Firefox automation non-goal, CDP-only capability model, and single-background-graph decision. This RFC remains the accepted record for the collaboration-only release and cross-browser Native Messaging identities.

## Summary

Panerelay will make the automation transport of each connected browser explicit. Microsoft Edge will use the existing Chromium Extension and browser-level CDP relay. Firefox will use a Firefox Manifest V3 build for its native sidebar, Native Messaging, Agent conversations, project context, and page comments, while declaring browser-level CDP relay unavailable.

The Bridge will reject automation-session creation before allocating a participant, lease, or WebSocket when the browser explicitly lacks the required CDP transport. Panerelay will not substitute a separately launched browser, emulate successful CDP commands, or add browser automation semantics to the shared protocol.

Setup will install browser-native Native Messaging manifests: `allowed_origins` for Chromium-family browsers and `allowed_extensions` for Firefox. Browser identities remain explicitly allowlisted, and the Bridge will accept only configured identities.

## Motivation

RFC-0001 and RFC-0002 intentionally scoped the first release to Chrome and an Extension-backed CDP endpoint. Edge exposes the same required extension APIs, but setup does not currently install Edge discovery entries or identify Edge registrations. Firefox exposes compatible WebExtension APIs for sidebars, tabs, scripting, storage, and Native Messaging, but [does not implement Chrome's `debugger` API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Chrome_incompatibilities#unsupported_apis).

A generic "browser connected" state is therefore insufficient. Without a capability declaration, the Bridge can allocate an automation lease that the Extension can never service. Treating all browser integrations as equivalent would create false-positive readiness and weaken the fail-closed contract.

Native Messaging also differs at a trust-boundary field and discovery-location level. Firefox requires an explicit Gecko add-on ID and `allowed_extensions`; Chromium and Edge use Extension origins in `allowed_origins`.

## Goals and non-goals

### Goals

1. Make the required browser automation transport explicit before lease allocation.
2. Give Edge the same Extension-backed CDP behavior and security invariants as Chrome.
3. Give Firefox the collaboration features supported by its WebExtension surface.
4. Fail closed and explain the limitation when Firefox is used for agent-browser automation.
5. Install only browser-native, identity-scoped Native Messaging manifests.
6. Preserve compatibility with older same-version Chromium registrations that omit the new optional capability fields.

### Non-goals

1. Implement WebDriver BiDi, Firefox Remote Debugging Protocol, or a Panerelay action protocol.
2. Launch or own a separate Firefox process.
3. Move snapshots, locators, input, waits, or other automation-engine semantics into Panerelay.
4. Claim that Firefox sidebar support implies Firefox CDP support.
5. Publish to Microsoft Edge Add-ons or Firefox AMO in this change.
6. Treat focus, Extension installation, or Native Host connectivity as authorization.

## Terminology

- **Browser family**: the normalized browser implementation identified by an Extension registration: Chrome, Chromium, Edge, Firefox, or unknown.
- **CDP relay capability**: whether the Extension can attach its browser's debugging API and service Panerelay's browser-level CDP endpoint.
- **Collaboration surface**: the Extension sidebar, Agent conversations, project context, explicit page comments, settings, and Native Messaging connection.
- **Chromium identity**: a validated 32-character Extension ID used in a `chrome-extension://` allowed origin.
- **Firefox identity**: a validated Gecko add-on ID used directly in `allowed_extensions`.

## Proposed design

### Browser registration

`browser.register` adds optional `browserFamily` and `capabilities.cdpRelay` fields. New Extension builds send both fields. The Bridge copies them into the ephemeral Bridge state consumed by the agent-browser Provider.

For compatibility, a same-protocol registration that omits capabilities retains the existing Chromium behavior. An explicit `cdpRelay: false` is authoritative. Unknown browser families do not gain or lose authority on their name alone; the capability field controls transport availability.

### Automation-session gate

The Bridge's authenticated `POST /sessions` handler checks the active registration before reading or allocating participant state. If `cdpRelay` is false, it returns a bounded conflict response naming the connected browser and required missing transport.

The agent-browser Provider checks the same field in Bridge state for an earlier diagnostic, but that check is an optimization. The Bridge remains the policy boundary and repeats the authoritative rejection. Neither path creates a participant, control lease, CDP credential, debugger attachment, or activity record.

### Edge runtime

The Chromium artifact is the Edge artifact. It retains Manifest V3 `side_panel`, `sidePanel`, `debugger`, optional host permissions, service-worker background, and the public Chromium Extension key.

The runtime identifies Edge from browser metadata and registers it as `edge` with `cdpRelay: true` only when the debugger API exists. [Microsoft documents `chrome.sidePanel`](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/sidebar) and Chromium-format [Native Messaging manifests](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/native-messaging) for Edge.

All RFC-0001 through RFC-0004 authorization, observation, control, visibility, serialization, and revocation rules remain unchanged.

### Firefox runtime

The Firefox artifact uses Manifest V3 `sidebar_action`, a background script document, a fixed Gecko add-on ID, and no `debugger` or `sidePanel` permission. Runtime wrappers feature-detect badge and sidebar operations.

The shared sidebar, Native Messaging, storage, tabs, scripting, localization, project context, Agent conversations, and page-comment paths remain available. Automation authorization controls are disabled or omitted. Page comments request only the site access necessary for their user-initiated scripting flow and never create a browser control lease.

Firefox registers `browserFamily: "firefox"` and `capabilities.cdpRelay: false`. A missing `debugger` API is a supported limitation, not a missing Native Host error.

### Native Messaging installation

Setup writes separate content for two manifest groups:

- Chromium and Edge: `allowed_origins: ["chrome-extension://<id>/"]`
- Firefox: `allowed_extensions: ["<gecko-id>"]`

On macOS and Linux, setup writes the documented per-user Chrome/Chromium, Edge stable and prerelease, and Mozilla locations. On Windows it writes distinct Chromium and Firefox JSON manifests and registers exact current-user keys below Google Chrome, Microsoft Edge, and Mozilla.

Runtime configuration retains the existing Chromium `extensionId`, adds the Firefox identity, and derives an Extension-ID allowlist. Install and update validate identities before writes. Uninstall removes only Panerelay-owned files and exact registry keys.

## Protocol and data model

The new registration fields are:

```text
browserFamily?: "chrome" | "chromium" | "edge" | "firefox" | "unknown"
capabilities?: {
  cdpRelay: boolean
}
```

They contain no raw browser tab ID, profile identity, page content, or credential. Bridge state remains local, bounded, ephemeral connection metadata.

`conversation.list` independently gains an optional canonical `cwd` so providers with project-scoped session stores can return relevant history. This does not authorize filesystem access; the existing native directory picker and Bridge validation remain authoritative.

## Security and privacy

1. Capability presence never grants site access, target authorization, or a control lease.
2. Browser family names never override an explicit negative capability.
3. Unsupported transports fail before participant credentials are generated.
4. Firefox page collaboration does not imply automation authorization.
5. Native Messaging manifests authorize only configured Panerelay Extension identities.
6. The Extension still stores no model credentials and spawns no native Agent process.
7. The Bridge remains bound to loopback and Native Messaging remains browser-launched.
8. Logs continue to exclude page content, cookies, prompts, screenshots, request bodies, and credentials by default.

## Compatibility and migration

Chrome plus agent-browser 0.33.0 remains `Verified`. Edge shares the Chromium implementation but remains `Forwarded` until a real Edge run records representative evidence. Firefox collaboration features are `Partial` until real-runtime evidence is recorded, and Firefox browser-level CDP is `Unsupported`.

The protocol additions are optional for compatibility with already built same-version Chrome Extensions. New releases ship Extension, Bridge, protocol, setup, and Agent adapter versions in lockstep. There is no persisted lease or target-state migration; reconnecting re-registers current capabilities.

Existing Chromium custom-ID precedence is preserved. A Firefox identity uses a separate option and environment variable because its valid syntax and Native Messaging representation differ.

## Alternatives considered

### Infer support from the browser name

Rejected because names are presentation strings and do not prove that a required runtime API exists.

### Let Firefox allocate a relay and fail on the first CDP command

Rejected because it creates misleading readiness, credentials, and control state for a transport that cannot work.

### Translate CDP into content-script actions

Rejected because it would move automation semantics into Panerelay, cover only a subset of browser behavior, and report a compatibility surface that is not CDP.

### Launch a separate Firefox process with remote debugging enabled

Rejected because it does not control the user's explicitly authorized existing Firefox tabs and changes Panerelay's browser-ownership model.

### Use one Native Messaging manifest shape everywhere

Rejected because Firefox and Chromium use different allowlist fields and browser discovery locations.

### Remove older-registration compatibility

Rejected because capability absence can safely retain the already accepted Chromium behavior within the same protocol version. An explicit false value still fails closed.

## Delivery plan

1. Add optional browser registration and Bridge state capability fields.
2. Gate Bridge and Provider automation-session creation.
3. Add Edge/Firefox runtime detection and browser-specific manifests.
4. Add cross-browser Native Messaging identities, paths, registry keys, doctor checks, and cleanup.
5. Update setup, sidebar readiness, documentation, compatibility matrices, and release artifacts.
6. Run automated checks for both Extension targets and representative real-browser smoke tests where those runtimes are available.

## Acceptance criteria

1. A compatible older Chromium registration without capability fields continues to create a relay session.
2. Edge registers with CDP support and retains the existing authorization and revocation behavior.
3. Firefox registers without CDP support and can use Native Messaging Agent conversations from its sidebar.
4. Firefox automation requests fail before participant, lease, WebSocket, or debugger state exists.
5. Firefox automation authorization controls are unavailable while page comments remain usable on eligible pages.
6. Setup writes correct per-browser manifest syntax and per-user discovery entries on macOS, Linux, and Windows.
7. Setup and Bridge reject malformed or unconfigured Extension identities.
8. Uninstall removes every Panerelay-managed browser entry without touching unrelated data.
9. Compatibility documentation distinguishes `Verified`, `Forwarded`, `Partial`, and `Unsupported`.
10. Protocol, Bridge, Extension, setup, release, OpenSpec, and full-repository checks pass.
