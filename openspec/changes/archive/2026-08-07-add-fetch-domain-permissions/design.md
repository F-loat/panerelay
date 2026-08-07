## Context

See `proposal.md` for motivation and `specs/browser-fetch-relay/spec.md` for the observable contract. RFC-0009 currently leaves domain policy to Chrome Host Permission and says fetch does not preflight or request that permission. The fetch path already crosses CLI, a generation-pinned Bridge, Native Messaging, and the Extension; the Extension is the only component that can safely enforce a persisted policy immediately before cookie and network work.

The existing side panel requests optional Host Permission from a direct click for single-tab or all-tab browser control. RFC-0001 requires site permission and tab authorization to stay separate. The local Mearl reference demonstrates a useful Agent flow: an explicit action opens a small Extension window, the user click performs `chrome.permissions.request`, and the correlated Agent call waits for approve, deny, close, or timeout. Panerelay will reproduce that interaction pattern without importing Mearl code or sharing its domain model.

## Goals / Non-Goals

**Goals:**

- Enforce a persistent exact/wildcard/all-domains fetch policy inside the Extension before any cookie, DNR, or network operation.
- Make user grants visible and reversible in the side panel while keeping Chrome Host Permission separate.
- Give shell-using Agents an explicit authorization command with a bounded confirmation lifecycle.
- Preserve fetch-only credentials, browser-generation pinning, and all existing automation ownership boundaries.

**Non-Goals:**

- Reuse browser-control authorization as fetch authorization or revoke Chrome Host Permission when removing only a fetch grant.
- Add path, method, adapter, or per-request policy.
- Auto-open or focus a normal web tab, attach CDP, or treat approval as a control lease.
- Claim OS network containment or change agent-browser 0.33.0, Browser Use 0.13.7, or Playwright CLI 0.1.17 compatibility.

## Decisions

### 1. Store normalized domain patterns and one independent all-domains flag in Extension local storage

The Extension owns `fetchAuthorizedDomains: string[]` and `fetchAuthorizeAllDomains: boolean`. Input may be an exact hostname, a leading `*.` wildcard, or a URL of any parseable scheme; it is normalized to a lowercase ASCII hostname/domain pattern with no scheme, credentials, port, path, query, or fragment. Exact patterns match one hostname regardless of scheme and port. Wildcards match their root plus all subdomains and are rejected for IP addresses or `localhost`. The all-domains grant does not delete narrower entries, so turning it off restores the saved pattern policy.

Extension local storage matches the browser profile and does not leak policy into Bridge registry state. The Bridge remains the routing boundary and validates authentication/generation, while the Extension is authoritative for the final policy at the credential-use boundary. Alternative: store ACLs in the Bridge. That would duplicate per-profile state and still require Extension enforcement to close revocation races. Alternative: derive policy from `chrome.permissions.getAll`. That would conflate fetch with Chrome permissions retained for tab automation.

### 2. Check Panerelay policy before cookies, DNR, and fetch, while leaving Chrome checks operation-driven

The background handler resolves the final request hostname, loads the fetch policy, and rejects requests that match no exact, wildcard, or all-domains grant before calling the executor. After Panerelay approval, cookie access, DNR installation, and fetch retain RFC-0009's current Chrome error handling. An externally removed Host Permission therefore fails explicitly without silently rewriting the Panerelay grant.

Alternative: call `chrome.permissions.contains` for every fetch. It adds no security beyond the operations that already require permission and can create time-of-check/time-of-use ambiguity. The explicit Panerelay ACL is the new preflight; Chrome remains authoritative when its APIs execute.

### 3. Add an authenticated registration-level permission endpoint and correlated Native messages

`POST /fetch/permissions` accepts the registration bearer token plus the exact selected `{browserId, generation, domain}` where `domain` is already normalized. It does not accept a fetch-session token and is never disclosed to adapter children. The Bridge sends `fetch.permission.request`; the Extension returns `fetch.permission.result`. Pending entries use opaque IDs, a 90-second bound, generation checks, and existing disconnect cleanup patterns.

The CLI exposes `panerelay fetch --authorize <hostname|*.domain|url> [--browser <selector>]`. Unauthorized fetch errors include the target hostname form. An adapter child cannot request permission by itself because it only receives a fetch-session credential, but an Agent controlling the parent CLI can run the explicit command after the first denial.

Alternative: auto-request on every unauthorized fetch. That would let arbitrary adapter traffic create surprise windows and blur request execution with permission widening. Alternative: put approval on the fetch-session endpoint. That would expose a widening capability to adapter children.

### 4. Use one standalone Extension confirmation page for Agent requests

The background opens a centered popup containing only the requested normalized domain pattern and two actions: deny and allow this domain pattern. It deliberately offers no all-domains action; that broader grant remains available only through direct side-panel management. Explicit denial removes the identical saved Panerelay domain pattern without touching Chrome Host Permission, while close or timeout fails closed without changing stored grants. Each approved domain remains one scheme-independent Panerelay grant, but the popup expands it to the declared HTTP and HTTPS Chrome Host Permission patterns before invoking `chrome.permissions.request` in its direct click handler. The popup uses a full-window background and vertically centers a bounded-width content region within a height that accommodates localized error state, so resizing or full-screening does not stretch the controls. It then sends a correlated runtime decision, and the background persists policy only after Chrome contains both required patterns. Duplicate response, background restart, or selected-generation loss resolves denied/fails closed without changing policy.

The page is a Vite HTML entry built with the Extension and uses shared authorization and localization helpers. Query parameters contain only the bounded normalized domain pattern and opaque request ID, never tokens, cookies, URL paths/queries, or page content. Alternative: ask only in the side panel. A panel may not be open, while a focused bounded popup makes the pending decision visible and provides the required user gesture.

### 5. Keep side-panel fetch grants distinct from browser access controls

The existing Browser access section stays authoritative only for tab scope and control release. A new Fetch access section offers current-domain and all-domain actions, displays status, and expands an exact/wildcard domain list with Panerelay-only revoke buttons. While all-domain access is active, it is the only highlighted scope action; narrower domain grants remain stored but their current-domain action is not highlighted until all-domain access is disabled. Selecting current-domain access from that state runs one serialized UI operation that ensures the current hostname is saved before disabling all-domain access, so a denied or failed domain grant cannot accidentally narrow access to nothing. Grant clicks first request Chrome Host Permission, then send a typed background mutation; background re-validates `permissions.contains` before persistence. Removing a pattern or disabling all-domain access changes only the fetch ACL.

Alternative: reuse the existing single-tab/all-tabs mode. That would violate RFC-0001 because a network credential boundary would become coupled to tab inventory and control revocation.

## Risks / Trade-offs

- [An installed adapter can repeatedly trigger permission guidance] → Fetch itself never opens approval UI; only the explicit registration-authenticated authorization command does.
- [A popup survives a Bridge disconnect briefly] → Correlate by request ID, reject the pending Bridge promise immediately, and ignore or close stale decisions without saving policy.
- [The all-domains option is broad] → Keep it only in side-panel management as a separate explicit button, require Chrome's own broad Host Permission prompt, show its active state persistently, and allow immediate disabling.
- [Revoking only the Panerelay grant may leave Chrome Host Permission visible] → Label the list as fetch grants and document that Chrome permission can be shared with browser control; never remove it implicitly.
- [Persisted policy can outlive Chrome Host Permission] → Chrome operations still fail closed and the UI can re-request permission on a future user grant.
- [No live-browser verification is available in automated tests] → Classify Chrome/Edge popup behavior as Partial until exercised in a real loaded lockstep Extension; protocol, Bridge, and UI state behavior can be Verified deterministically.

## Migration Plan

1. Ship protocol, Bridge, CLI, Extension, documentation, and RFC-0009 updates in one lockstep release.
2. Existing installations start with no Panerelay fetch grants, so the first fetch to each domain fails closed with authorization guidance; this is an intentional security tightening.
3. Users approve exact or wildcard domain patterns through the side panel or an Agent-request popup. All-domains approval is available only through the side panel. Existing Chrome Host Permission remains untouched until an explicit user gesture requests additional access.
4. Rollback ignores the Extension-local fetch policy keys and returns to the prior Chrome-only boundary; no browser-control, adapter registry, or Bridge registration migration is required.
