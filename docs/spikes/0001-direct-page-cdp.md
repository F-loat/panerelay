# Spike 0001: Extension-backed direct-page CDP

- Status: Passed
- Branch: `feat/direct-page-spike`
- RFC: [RFC-0001](../rfcs/0001-extension-connection-and-agent-interoperability.md)

## Question

Can an unmodified `agent-browser` process operate an explicitly authorized tab in the
user's Chrome through a Panerelay extension?

## Implemented path

```text
agent-browser --provider panerelay
  -> @panerelay/agent-browser provider process
  -> authenticated loopback session allocation
  -> short-lived direct-page WebSocket
  -> @panerelay/bridge Native Messaging host
  -> Panerelay Chrome extension
  -> chrome.debugger on one authorized tab
```

The provider returns an `agent-browser.plugin.v1` browser launch response with
`directPage: true`. The returned WebSocket acts like a page-scoped CDP endpoint:

- numeric CDP command IDs are preserved;
- CDP command results and protocol errors are routed to the originating client;
- page events are forwarded without browser session IDs;
- `Browser.getVersion` receives a minimal compatibility response because agent-browser uses it
  to probe connection liveness while Chrome's extension debugger only exposes page-scoped domains;
- one automation lease and one authorized tab are allowed at a time;
- a lease can carry a small number of transport sockets because `agent-browser` may overlap
  direct-page connections while auto-launching.

## Trust properties in the spike

- The relay listens only on `127.0.0.1`; its random 256-bit bootstrap token is used only to
  allocate and release relay sessions.
- Bridge discovery state and the bootstrap token are written with user-only file permissions.
- Each provider launch receives a separate 256-bit CDP credential with a bounded connection
  window. The credential is invalidated on provider cleanup, final transport disconnect,
  extension revocation, or Bridge shutdown.
- Only one relay session can own the authorized tab at a time.
- The Native Host is bundled and installed under `~/.panerelay/bin`; Chrome never executes
  files from the source checkout.
- A WebSocket connection does not grant tab access by itself.
- The user must authorize a supported tab in the extension side panel.
- Single-tab authorization is memory-only and bound to the selected tab and exact origin.
- All-tabs authorization persists across Extension, service-worker, and browser restarts only
  while Chrome still reports the explicitly granted HTTP and HTTPS permissions.
- Chrome displays an `AI` badge while `chrome.debugger` is attached.
- Connections are capped per lease, and all lease connections are terminated on revocation.

These properties are a prototype of the RFC trust model, not a completed security review.
In particular, the spike does not yet implement active-lease heartbeat expiration, per-action
approval, an operation journal, or browser-level multi-target CDP.

## Automated evidence

The Bridge test suite covers:

1. fragmented Native Messaging framing;
2. oversized Native Messaging rejection;
3. extension registration;
4. direct-page attach;
5. CDP command/result correlation;
6. CDP event forwarding;
7. invalid relay-token rejection;
8. exclusive relay-session allocation and provider cleanup;
9. expiration of unused connection credentials;
10. immediate credential invalidation on extension revocation.

The provider test suite covers manifest discovery, authenticated session allocation from live
Bridge state, direct-page launch metadata, and provider cleanup.

Run all evidence with:

```bash
pnpm check
```

## Manual compatibility check

Build the workspace and install the development Native Messaging manifests:

```bash
pnpm install
pnpm build
pnpm install:host
```

Load `apps/extension/dist` as an unpacked Chrome extension, open its side panel, and
authorize an ordinary web tab. From the repository root:

```bash
agent-browser --session panerelay-spike --provider panerelay snapshot
agent-browser --session panerelay-spike --provider panerelay get title
agent-browser --session panerelay-spike --provider panerelay close
```

The checked-in `agent-browser.json` registers the local provider build. Rebuild after
changing `packages/agent-browser` or `packages/protocol`.

Chrome resolves user-level Native Messaging hosts relative to its user-data directory.
If a development browser uses a temporary or custom profile, install an additional
manifest into that profile before launching it:

```bash
pnpm --filter @panerelay/bridge build
node packages/bridge/dist/install.js --user-data-dir /path/to/chrome-user-data
```

Remove the development Native Messaging manifests with:

```bash
pnpm uninstall:host
```

## Exit criteria

The spike succeeds when a released, unmodified `agent-browser` version can produce a
snapshot from an explicitly authorized Chrome tab and disconnecting it visibly releases
the tab.

## Result

Passed on 2026-07-29 with `agent-browser 0.33.0` and Chrome for Testing
`148.0.7778.96`. The real extension-backed run returned the `Example Domain` heading,
paragraph text, and `Learn more` link from the authorized tab. The compatibility run also showed
that agent-browser can briefly overlap direct-page WebSockets during auto-launch and probes an
existing connection with `Browser.getVersion`. Panerelay treats overlapping sockets as transports
inside one authorization lease, revokes them together, and answers the liveness probe at the relay
boundary so consecutive commands reuse the attachment.

The same build was then loaded in a daily Chrome profile. One authorized, authenticated page
successfully handled separate `snapshot`, `get title`, and `get url` CLI invocations in the same
agent-browser session without relaunching. Closing the session removed every CDP client connection
and left only the loopback Bridge listener.

The installed short-lived session build also passed an exclusive-ownership run: a second
agent-browser session was denied while the first remained usable, then acquired a fresh session
after the owner closed. Final cleanup again removed every CDP client while keeping the Bridge
available for the next allocation.

The RFC acceptance run used the checked-in
`docs/spikes/fixtures/rfc0001-actions` fixture with agent-browser 0.33.0 and daily Chrome
150.0.7871.187. Through the standard `panerelay` Provider, the client produced an interactive
snapshot, filled a text field, read the resulting value, clicked a button, waited for the
completion text, captured a screenshot, followed a link, waited for the new URL and heading, and
captured the navigated page. The all-tabs grant was then tested independently: the Provider
session was closed, the Extension was reloaded, and a fresh session produced a snapshot without a
new permission prompt. This demonstrates that authorization eligibility persists while leases and
debugger attachments do not.
