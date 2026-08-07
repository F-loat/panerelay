# RFC-0006: Multi-browser registration and routing

- RFC: 0006
- Title: Multi-browser registration and routing
- Status: Accepted
- Authors: F-loat
- Created: 2026-07-31
- Updated: 2026-08-01
- Amendment: `openspec/changes/archive/2026-08-01-add-browser-use-default-setting`
- Amendment: RFC-0009, `openspec/changes/add-browser-fetch-adapters`

This RFC supersedes RFC-0001's unspecified recent-focus fallback for browser selection. Focus remains presentation state and never selects an automation authority.

## Summary

Panerelay will retain one independent registration for every connected browser installation and select exactly one registration for each new agent-browser participant. Selection is deterministic: an explicit process selector, the saved user default, or the only live CDP-ready browser. Missing, unavailable, or ambiguous choices fail closed.

Each Extension connection, Native Host, loopback relay, permission set, control lease, target inventory, and revocation boundary remains browser-local. A participant is pinned to its selected registration until it terminates and is never migrated to another browser.

## Motivation

Chrome and Edge already start separate Native Host processes, but those processes overwrite one singleton discovery file. Whichever browser registers last therefore becomes the implicit target for every new Provider session, and changing that singleton can prevent a Provider from releasing its original participant.

Registration order is not user intent. Browser focus is also not authorization and cannot safely resolve the ambiguity. Panerelay needs explicit shared selection state while keeping browser ownership separated.

## Goals and non-goals

### Goals

1. Discover Chrome and Edge concurrently without last-writer-wins behavior.
2. Select one browser deterministically for each new Provider participant.
3. Keep existing participants pinned when the user changes the default.
4. Scope side-panel Agent browser tools to the Extension that launched them.
5. Let users inspect and change the saved default from the Extension or CLI.
6. Preserve browser-local permissions, leases, visibility, and revocation.

### Non-goals

1. Merge multiple browser relays into one CDP endpoint.
2. Let one participant or lease span browsers.
3. Select from operating-system focus, browser recency, or registration order.
4. Copy site permission, tab authorization, target state, or control ownership between browsers.
5. Add a central broker daemon, browser launcher, Firefox transport, or agent-browser fork.
6. Identify user profiles beyond each Extension's opaque registration ID.

## Terminology

- **Browser registration**: one live Extension/Native Host/relay identity and its bounded connection metadata.
- **Saved browser default**: a user-level opaque registration ID used only when an invocation has no explicit selector.
- **Explicit selector**: an exact registration ID or browser-family selector supplied to one Provider process.
- **Ready registration**: a live compatible registration that does not explicitly deny CDP relay capability.
- **Browser-pinned participant**: a relay participant allocated and cleaned up through the same registration for its full lifetime.

## Proposed design

### Independent registration store

Current Native Hosts write one protected file per opaque browser ID under the Panerelay user-data directory. Filenames are deterministic hashes rather than raw IDs. Each record contains the existing `BridgeState`: protocol, PID, loopback port, bearer token, browser identity, Extension identity, optional family and capabilities, and update time.

The directory is user-only, records are user-only, and writes are atomic. A Native Host removes only a record matching its browser ID and PID. Consumers validate schema, protocol, process liveness, path-to-ID correspondence, and CDP readiness before use.

The saved default is a separate protected record containing the protocol version, opaque browser ID, and update time. It conveys routing preference only.

### Selection order

For each Provider `browser.launch`, Panerelay resolves:

1. `PANERELAY_BROWSER_ID`, which must match one exact live registration;
2. `PANERELAY_BROWSER`, which may match an exact ID or one unambiguous normalized family;
3. the saved default registration ID;
4. the only live CDP-ready registration.

Every other state fails with an actionable diagnostic. An explicit or saved registration that is offline or incapable does not fall through to another browser. Multiple registrations of one selected family require the exact opaque ID.

Focus, recency, file order, process start time, and permission changes never affect selection.

### Participant pinning and cleanup

Provider cleanup metadata contains the selected browser ID, Native Host PID, and participant ID. On close, the Provider rereads that browser's exact registration and verifies PID before releasing the participant.

Changing the saved default affects only later unscoped launches. If the selected browser disconnects, its participants fail and are not recreated or replayed elsewhere.

### Side-panel scope

Each Native Host process belongs to one browser registration. Agent runtimes launched from its side panel receive that exact registration ID, and generated agent-browser MCP server configuration repeats the selector explicitly. This scoped selector outranks the saved default.

The Native Host exposes integration operations to inspect the current browser/default relationship, make the registered current browser the default, or conditionally clear a default owned by the current browser. The bounded result also reports only whether more than one live registration exists, derived through the protected browser registry without returning another browser's identity, metadata, credentials, or exact count. The Extension cannot nominate an arbitrary registration ID through this operation.

The side panel renders a “Control by default” / “默认受控” switch only while that multiple-browser boolean is true. The side panel already identifies its current browser context, so the row does not repeat a browser-family name. Hiding the row for zero or one live registration does not change or clear the saved default. The switch remains a future-routing preference and never grants site permission, tab authorization, participant state, or a control lease. Registration count is refreshed when the Native Host registers and when settings open; an already-open panel may retain its prior visibility until the next refresh after another browser disconnects.

### CLI scope

The optional `@panerelay/cli` package exposes the `panerelay` executable. It lists live browser registrations and manages the same saved default. Family shortcuts are accepted only when one live ready registration matches. These operations do not contact pages, grant permissions, change leases, or move active participants.

The CLI depends on the engine-neutral `@panerelay/browser-registry` runtime, not on agent-browser or another automation engine. It can be installed globally for recurring use or invoked occasionally with `npx`. The one-time `@panerelay/setup` package retains setup, update, doctor, and uninstall operations; it neither owns recurring browser administration nor installs the CLI globally.

## Security and privacy

1. Browser selection never grants site permission, tab authorization, or a control lease.
2. Mutating CDP actions still require the selected browser's current lease.
3. Revocation affects the selected browser's participants and targets, not another browser.
4. Bearer tokens are stored only in protected local records and never printed by list or selection commands.
5. Raw browser tab IDs, page content, URLs, cookies, prompts, screenshots, and request bodies are absent from registration/default state.
6. Opaque browser IDs are hashed before use in filesystem paths.
7. Ambiguity and unsupported capabilities fail closed before participant allocation.

## Compatibility and migration

agent-browser 0.33.0 remains the minimum and initial Chrome-verified baseline. No upstream modification is required because Panerelay selection uses Provider process environment and local state. The administration CLI is automation-engine neutral so future adapters can reuse the same selection state.

Chrome retains its existing `Verified` evidence where the behavior is covered. Edge uses the same registry and Chromium relay path but remains `Forwarded` until dedicated real-Edge evidence exists. One-session/multiple-browser operation remains `Unsupported`.

During a lockstep update, the Provider may read one live legacy singleton only when no current per-browser registration exists. Current Native Hosts no longer write the singleton. Reloading installed Extensions converges every browser to independent registration. Older releases ignore the new files and recreate their singleton after rollback and reload.

## Alternatives considered

### Select the most recently focused browser

Rejected because focus never grants authorization, changes without an Agent action, and creates surprising cross-browser routing.

### Merge registrations into one CDP endpoint

Rejected because permissions, target inventories, process lifetimes, and control leases belong to different browser owners. Cross-browser multiplexing would weaken revocation and failure boundaries.

### Run a permanent central broker

Deferred because separate Native Hosts already isolate ownership. A broker adds another authenticated lifecycle, upgrade, and crash-recovery surface without being necessary for deterministic selection.

### Use only browser-family defaults

Rejected because users can run multiple profiles or channels in the same family. The durable selection is an opaque registration ID; family is only an unambiguous convenience.

### Put recurring browser commands in setup

Rejected because setup is intentionally a one-time `npx` integration surface. Keeping recurring administration in a standalone optional package avoids a global setup dependency and keeps the command independent of any automation engine.

## Delivery plan

1. Add the protected registry and selection module with deterministic tests.
2. Move Native Host discovery writes and Provider reads to per-browser records.
3. Pin cleanup and side-panel Agent MCP environments to the selected registration.
4. Add Extension integration operations and a browser-default setting.
5. Add standalone CLI list, use, and clear commands.
6. Update compatibility documentation and run real Chrome plus synthetic two-browser acceptance.

## Acceptance criteria

1. Concurrent Chrome and Edge registrations remain independently discoverable.
2. Exact, saved, and single-ready selection follow the defined order.
3. Unavailable defaults and ambiguous selectors fail without fallback.
4. Changing the default does not redirect or terminate an active participant.
5. Provider cleanup addresses the participant's original browser registration.
6. Edge side-panel Agents select Edge even when Chrome is the saved default.
7. Browser selection changes no permissions, targets, leases, or revocation state.
8. CLI and Extension expose only bounded registration metadata and never bearer tokens.
9. Legacy fallback occurs only when no current registration exists.
10. agent-browser 0.33.0 works without an upstream fork.
