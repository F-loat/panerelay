## Why

Browser-backed fetch currently relies only on Chrome Host Permission, so any local caller that receives a fetch-only session can target every domain Chrome has granted without a Panerelay-owned approval boundary. Panerelay needs an explicit, user-visible fetch authorization model that lets an Agent request one exact or wildcard domain while still allowing the user to deliberately grant all domains and review or revoke saved grants.

## What Changes

- Gate every browser-fetch request on a persistent Panerelay fetch-domain policy in addition to Chrome Host Permission.
- Let users grant fetch access for the active tab's current hostname, an explicit wildcard such as `*.baidu.com`, or all domains, independently from URL scheme, tab authorization, and browser-control leases.
- Add an expandable side-panel view of every saved domain-pattern fetch grant with immediate revocation and a separate all-domains state.
- Add an Agent-initiated authorization request that accepts a hostname, wildcard domain, or URL, normalizes it to a scheme-independent domain pattern, opens a focused Extension confirmation window, and requests Chrome Host Permission only from the user's approval gesture.
- Return a bounded, actionable permission-required result when an Agent attempts an unauthorized domain, without issuing cookies, header rules, or network traffic.
- Update RFC-0009 and browser-fetch compatibility documentation to replace the previously deferred domain-policy decision.
- Keep agent-browser 0.33.0, Browser Use 0.13.7, and Playwright CLI 0.1.17 automation behavior unchanged.

Non-goals include per-request approval after a domain is already granted, path- or method-level ACLs, silent permission widening, changing tab authorization or control ownership, containing traffic outside the Extension, or claiming ownership of the user's browser process.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `browser-fetch-relay`: require explicit fetch-domain authorization, support exact, wildcard, current-domain, and all-domain grants, expose grant management, and support Agent-initiated user approval before browser fetch execution.

## Impact

- `@panerelay/protocol`: correlated fetch authorization request/result messages and bounded validation.
- Bridge and CLI: permission-request routing plus an explicit Agent-facing authorization command while preserving fetch-session credential scope.
- Extension background, standalone permission page, side-panel status and controls, storage, and localization.
- RFC-0009, browser-fetch compatibility documentation, and focused protocol/Bridge/Extension/CLI tests.
- No new external runtime dependency and no change to automation participants, CDP attachment, tab inventory, focus, or control leases.
