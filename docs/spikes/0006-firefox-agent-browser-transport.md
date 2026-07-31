# Spike 0006: Firefox agent-browser transport

- Date: 2026-07-31
- Status: Concluded
- agent-browser baseline: `v0.33.0` (`1ed371f3af472cc0d6cd8fdaea75d1a085ff7534`)
- Firefox runtime evidence: documentation and source-contract review; no local Firefox runtime was available

## Question

Can Panerelay add meaningful Firefox automation while keeping browser automation semantics in agent-browser and keeping Chromium-only code out of the Firefox Extension artifact?

## Evidence

### Firefox cannot reuse the Chromium Extension transport

Firefox does not implement Chrome's WebExtension `debugger` API. Firefox 141 also removed its Remote Agent CDP support, leaving WebDriver BiDi as the Remote Agent protocol. The Remote Agent can only be enabled at Firefox process startup with `--remote-debugging-port`. An existing Firefox process can instead be connected through geckodriver only when it was started with Marionette enabled, normally through `--marionette`.

Relevant upstream documentation:

- [Chrome incompatibilities: Debugger API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Chrome_incompatibilities#unsupported_apis)
- [Firefox Remote Agent security and startup](https://firefox-source-docs.mozilla.org/remote/Security.html)
- [Firefox Remote Agent protocol selection](https://firefox-source-docs.mozilla.org/remote/Prefs.html)
- [geckodriver `--connect-existing`](https://firefox-source-docs.mozilla.org/testing/geckodriver/Flags.html#connect-existing)

Content-script event synthesis is not an equivalent fallback. It cannot provide trusted mouse or keyboard input and would move snapshot, locator, wait, input, and network semantics into Panerelay.

### agent-browser Provider v1 accepts only CDP

The exact `v0.33.0` tag was inspected:

```bash
git show v0.33.0:cli/src/plugins.rs
git show v0.33.0:cli/src/native/providers.rs
git show v0.33.0:cli/src/native/actions.rs
```

`BrowserProviderResult` contains only:

```text
cdp_url: String
direct_page: bool
cleanup: optional JSON
metadata: optional JSON
```

The Provider connection path converts that result to a CDP WebSocket connection. `directPage` changes whether agent-browser expects a page or browser CDP endpoint; it does not select another automation protocol.

### agent-browser already has a reusable WebDriver backend

The same `v0.33.0` source contains a generic `WebDriverBackend` and routes common navigation, snapshot, element, input, screenshot, URL, title, and lifecycle operations through it. The backend is currently selected only by the built-in Safari and iOS launch paths. A browser-provider plugin cannot select it.

This makes a small automation-engine extension preferable to a large CDP compatibility server in Panerelay:

1. extend the agent-browser browser-provider result with an explicit transport discriminator;
2. allow a Provider to return a WebDriver endpoint plus an existing session ID;
3. initialize the existing `WebDriverBackend` for that Provider;
4. keep unsupported WebDriver commands explicit through the existing backend capability checks.

The coordinated change is captured as a reproducible fixture in [`fixtures/agent-browser-v0.33.0-webdriver-provider/`](fixtures/agent-browser-v0.33.0-webdriver-provider/). The patch was applied to the exact baseline above and its complete Rust test suite passed with 1,014 tests, 0 failures, and 96 ignored tests. Focused tests also cover legacy CDP parsing, WebDriver parsing and backend selection, scoped endpoint/session validation, participant heartbeat, unsupported CDP-only actions, and Provider cleanup. This evidence proves the contract against the source baseline; it does not claim that a published agent-browser release contains the change.

The patched client includes `browser.provider.webdriver-existing-session` in its launch request. Panerelay uses that request-scoped capability as a bounded feature probe: an unpatched `0.33.0` client remains valid for Chromium but is rejected with targeted Firefox upgrade guidance before a WebDriver participant is allocated. The Provider metadata also supplies a bounded heartbeat interval; the patched WebDriver client keeps the virtual participant alive while its backend exists and stops the task when that backend is dropped.

## Decision

Panerelay will not translate Firefox operations into fake CDP and will not implement agent-browser actions inside content scripts.

The Firefox path will use a coordinated WebDriver Provider design:

```text
agent-browser commands
        |
agent-browser WebDriver backend
        |
authenticated Panerelay WebDriver relay
        |
geckodriver --connect-existing
        |
Firefox started with --marionette
```

The Bridge remains the policy boundary. The relay exposes only a participant-scoped session and authorized Firefox window handles. The Firefox Extension remains the source of explicit site/tab authorization and revocation.

Firefox cannot gain this capability transparently after a normal process has already started. Setup will install an explicit Panerelay Firefox launcher. The UI will report that automation requires closing Firefox once and starting it through that launcher; Panerelay will not terminate the user's browser automatically.

## Extension bundle boundary

The Extension will use separate entry graphs:

```text
shared/
  Native Messaging client
  Agent conversations and projects
  page comments
  authorization model and protocol types

background/chromium/
  chrome.debugger CDP adapter
  Chromium target lifecycle
  sidePanel, action badge, controlled favicon

background/firefox/
  sidebar integration
  authorized-tab to WebDriver-window rendezvous
  Firefox automation readiness and revocation
```

Each manifest points at its own background entry. Release validation will inspect both bundles and fail if the Firefox archive contains the Chromium debugger adapter or the Chromium archive contains the Firefox WebDriver rendezvous adapter.

## Security constraints

- Starting Firefox with Marionette is an explicit user action and never follows from focus, site access, or Extension installation.
- The Bridge never returns the raw geckodriver endpoint to an Agent.
- A Firefox tab is mapped to a WebDriver window only through a one-time challenge delivered to that browsing context and returned by the Panerelay content script with the browser-attested Extension tab identity.
- Challenges from unauthorized tabs are ignored. Missing, duplicate, stale, or ambiguous mappings fail closed.
- Revocation invalidates the window mapping and participant credentials before later commands are forwarded.
- Browser-chrome or system-level Firefox access is not enabled.
- Page content, WebDriver payloads, cookies, screenshots, and request bodies are not logged by default.

## Remaining runtime probe

A real Firefox installation is required to validate:

1. same-profile restart through the managed launcher;
2. geckodriver `--connect-existing` on macOS, Linux, and Windows;
3. tab/window challenge mapping across duplicate URLs and navigation;
4. the agent-browser WebDriver command compatibility matrix;
5. clean shutdown without closing Firefox unless the user requests it.

These results must be recorded before Firefox automation is classified as Verified.
