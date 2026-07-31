# RFC-0005: Edge browser capabilities and hosting

- RFC: 0005
- Title: Edge browser capabilities and hosting
- Status: Accepted
- Authors: F-loat
- Created: 2026-07-31
- Updated: 2026-07-31

## Summary

Panerelay will support Microsoft Edge through the existing Chromium Manifest V3 Extension, browser-level CDP relay, side panel, and agent-browser Provider. Edge is identified explicitly at runtime, but it does not receive a separate Extension source graph, automation engine, protocol, or release archive.

Browser registrations will declare optional browser-family and CDP-relay capability metadata. The Bridge will reject automation-session creation before allocating a participant, lease, WebSocket, or activity state when the connected Extension explicitly reports that the required CDP relay is unavailable. Compatible older Chrome registrations that omit the optional metadata retain their existing behavior.

Setup will install the existing identity-scoped Chromium Native Messaging manifest in Microsoft Edge's per-user discovery locations. On Windows, Panerelay will manage exact Chrome and Edge HKCU registry entries independently while retaining one manifest file and one configured Chromium Extension identity.

## Motivation

RFC-0001 and RFC-0002 intentionally scoped the initial integration to Chrome, but the accepted boundaries are Chromium Extension APIs rather than Chrome product ownership. Microsoft Edge documents the same [`chrome.sidePanel` Extension API](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/sidebar) and a Chromium Native Messaging manifest with `allowed_origins`. Its [Native Messaging documentation](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/native-messaging) defines Microsoft-specific discovery locations and the `HKCU\SOFTWARE\Microsoft\Edge\NativeMessagingHosts` registry path.

The existing Panerelay artifact therefore already contains the relevant automation semantics, authorization model, and side-panel UI. What is missing is an honest browser identity, explicit transport capability, Edge discovery installation, independent diagnostics, and evidence-scoped compatibility guidance.

A generic connected state is insufficient for future browser integrations because Native Messaging connectivity alone does not prove that the Extension can provide Panerelay's CDP relay. Capability metadata must remain separate from browser authorization and must fail closed when the required transport is explicitly absent.

## Goals and non-goals

### Goals

1. Give Edge the same Extension-backed CDP behavior and security invariants as Chrome.
2. Identify Edge registrations without exposing profile data or raw browser tab IDs.
3. Make the required CDP transport explicit before any automation state is allocated.
4. Install user-scoped Edge Native Messaging discovery entries on macOS, Linux, and Windows.
5. Preserve one Chromium Extension source graph, identity, and release archive.
6. Preserve compatibility with older same-protocol Chrome registrations that omit optional capability fields.
7. Keep Edge compatibility claims `Forwarded` until a dedicated real-Edge run records evidence.

### Non-goals

1. Add Firefox, Gecko-specific manifests, WebDriver, or a browser launcher.
2. Fork agent-browser or move snapshots, locators, input, waits, or other automation semantics into Panerelay.
3. Publish to Microsoft Edge Add-ons in this change.
4. Make the user's daily Edge process behave like a disposable process owned by agent-browser.
5. Infer authorization from Edge installation, focus, Native Host connectivity, or capability presence.
6. Add an Edge-specific Extension ID unless a separately signed Edge Add-ons artifact is introduced by a future decision.

## Terminology

- **Browser family**: the normalized Chromium runtime identity reported by an Extension registration: Chrome, Chromium, Edge, or unknown.
- **CDP relay capability**: whether the Extension runtime exposes the debugger operations required to service Panerelay's browser-level CDP endpoint.
- **Chromium Extension identity**: the validated 32-character Extension ID represented as one `chrome-extension://` origin in the Native Messaging manifest.
- **Forwarded**: implemented through an already tested browser API path with deterministic coverage but without dedicated real-browser evidence for that runtime.

## Proposed design

### Browser registration

`browser.register` adds these optional fields:

```text
browserFamily?: "chrome" | "chromium" | "edge" | "unknown"
capabilities?: {
  cdpRelay: boolean
}
```

The Extension detects Edge from its runtime user agent and feature-detects the debugger operations before declaring `cdpRelay`. The browser family is presentation and compatibility metadata; it does not grant authority and cannot override an explicit negative capability.

The Bridge copies the optional fields into its ephemeral local state so the agent-browser adapter can produce an early diagnostic. These fields contain no profile identity, raw tab ID, page content, cookie, credential, prompt, screenshot, or request body.

For same-protocol compatibility, absence of `capabilities` retains the already accepted Chrome behavior. This exception does not convert an explicit `cdpRelay: false` to success.

### Automation-session gate

The authenticated Bridge `POST /sessions` handler checks the active registration before reading the request body or allocating participant state. If `cdpRelay` is explicitly false, the Bridge returns a bounded conflict error naming the connected browser and the missing CDP relay.

The agent-browser Provider performs the same check against live Bridge state to avoid an unnecessary request when possible. This is diagnostic only: the Bridge remains the routing and policy boundary and repeats the authoritative check.

Neither rejection path creates:

- a participant ID or credential;
- a browser control lease;
- a CDP WebSocket URL;
- a debugger attachment;
- target or activity state.

### Shared Chromium Extension

Edge uses the existing `apps/extension/manifest.json`, service worker, `side_panel`, `sidePanel` permission, debugger permission, public manifest key, and build output. The background graph and side-panel graph remain shared with Chrome.

RFC-0001 through RFC-0004 authorization, observation, control, visibility, target lineage, serialization, and revocation rules remain unchanged. Site permission and tab authorization stay separate. Edge focus never grants authority. Mutation still requires the current lease.

No Edge-specific build switch is introduced. Separate source graphs are appropriate only when a browser requires materially different APIs or manifest ownership; Edge does not require that split for this change.

### Native Messaging installation

On macOS, setup writes the existing Chromium manifest into the supported Edge stable, Beta, Dev, and Canary per-user application-support locations in addition to Chrome and Chromium locations.

On Linux, setup writes it into Edge stable, Beta, and Dev per-user configuration locations in addition to the existing Chrome and Chromium paths.

On Windows, setup writes one managed Chromium manifest and registers its absolute path beneath:

```text
HKCU\SOFTWARE\Google\Chrome\NativeMessagingHosts\org.panerelay.bridge
HKCU\SOFTWARE\Microsoft\Edge\NativeMessagingHosts\org.panerelay.bridge
```

Both keys remain current-user scoped and require no administrator privileges. Setup, update, doctor, and uninstall address the keys independently. Uninstall removes only the exact Panerelay keys and Panerelay-owned files.

The manifest retains one configured `allowed_origins` entry. Edge installations from the current Chrome Web Store listing use the same Chromium Extension ID. A future separately signed Edge Add-ons listing may require an additional identity and a superseding RFC.

## Security and privacy

1. Capability metadata never grants site access, tab authorization, or a control lease.
2. Browser family never overrides an explicit negative capability.
3. Unsupported transport fails before participant credentials or control state exist.
4. Edge Native Messaging accepts only the configured Chromium Extension origin.
5. All local services remain loopback- or browser-scoped.
6. The Extension stores no model credentials and spawns no native Agent process.
7. Logs continue to exclude page content, cookies, credentials, prompts, screenshots, and request bodies by default.
8. Raw Edge tab identifiers remain Extension-private and are never stable public protocol IDs.

## Compatibility and migration

Chrome plus agent-browser 0.33.0 retains its existing `Verified` classifications. Edge shares the Chromium implementation, but its groups remain `Forwarded` until representative real-Edge evidence is recorded. Features requiring browser-process ownership remain `Unsupported` in both browsers.

The protocol additions are optional and the components still ship in lockstep. Reconnecting an Extension re-registers current metadata, so there is no persisted lease, target, or capability migration.

Existing Chrome installations continue to use their current manifest paths and registry key. Update adds Edge discovery entries; uninstall removes both browser entries idempotently.

## Alternatives considered

### Treat Edge as Chrome

Rejected because diagnostics and compatibility evidence need the actual runtime identity, and browser-specific Native Messaging discovery must be inspectable.

### Infer CDP support only from the browser name

Rejected because names are presentation strings and do not prove that the required debugger operations exist.

### Allocate a relay and fail on the first CDP command

Rejected because this creates misleading credentials, lease state, and readiness for a transport that cannot work.

### Create a separate Edge source graph and archive

Rejected because Edge uses the same required Chromium manifest and Extension APIs. A duplicate graph would increase drift without creating a security or compatibility boundary.

### Depend on Edge's Chrome registry fallback on Windows

Rejected because an explicit Microsoft Edge HKCU key is deterministic, independently diagnosable, and follows Edge's documented primary discovery path.

### Publish to Edge Add-ons immediately

Rejected for this change because store review, signing identity, and a possible distinct Extension ID require separate distribution work and acceptance evidence.

## Delivery plan

1. Add optional browser registration and Bridge-state metadata.
2. Add the Bridge and Provider pre-session capability gate.
3. Add shared Chromium runtime detection for Chrome, Chromium, and Edge.
4. Extend Native Messaging paths, Windows registration lifecycle, and doctor checks.
5. Update setup, README, package guidance, compatibility records, OpenSpec, and release acceptance.
6. Run the full repository and packed-release checks and inspect the shared artifact for Firefox/WebDriver leakage.

## Acceptance criteria

1. Edge registers as `edge` with CDP relay support when the debugger API is present.
2. A compatible older Chrome registration without capability fields still creates a relay session.
3. An explicit negative CDP capability fails before participant, lease, WebSocket, debugger, or activity state exists.
4. Authorized Edge tabs use the existing target lifecycle, CDP routing, visibility, and revocation rules.
5. Setup writes Edge per-user manifest locations on macOS and Linux.
6. Windows setup, doctor, update, and uninstall manage the exact Chrome and Edge HKCU keys independently.
7. One Chromium Extension archive remains the complete Chrome/Edge artifact.
8. Edge is not classified as `Verified` without dedicated real-runtime evidence.
9. No Firefox manifest, Gecko identity, WebDriver dependency, or browser launcher is added.
10. Protocol, Extension, Bridge, agent-browser, setup, release, OpenSpec, and full-repository checks pass.
