## Context

See [proposal.md](./proposal.md) for motivation and the delta specs for observable behavior.

Each Chromium Extension connection starts a separate Native Host process and a separate loopback `BrowserRelay`. The relay is therefore already browser-local, but every process currently writes `~/.panerelay/bridge.json`; the Provider reads whichever process wrote last. Cleanup also rereads that singleton, so a default change can make cleanup miss the participant's original relay.

RFC-0001 defines the Bridge as the registration, routing, policy, and lease boundary, while RFC-0003 makes a control lease browser-local. RFC-0005 adds Chrome/Edge family and CDP-capability metadata. A new RFC-0006 will supersede RFC-0001's unfinished recent-focus fallback with deterministic selection that never derives authority from focus.

The supported automation baseline remains agent-browser 0.33.0. Its Provider protocol supplies a session label but no Panerelay browser selector, so explicit selection must use Panerelay-owned process environment and saved local state without forking agent-browser.

## Goals / Non-Goals

**Goals:**

- Preserve the existing one-Extension/one-Native-Host/one-relay ownership boundary.
- Make discovery and cleanup safe when multiple browser processes register concurrently.
- Support browser-local side-panel Agents and deterministic external invocations.
- Keep registration IDs opaque and filesystem-safe.
- Make selection testable without a live Chrome or Edge process.

**Non-Goals:**

- Add a long-running central broker daemon.
- Merge CDP endpoints, participants, target inventories, or leases across browsers.
- Add profile names or raw browser tab IDs to public state.
- Change agent-browser's Provider protocol or browser automation semantics.
- Promote Edge from `Forwarded` to `Verified` without a dedicated real-Edge run.

## Decisions

### Use a small browser-registry package below Bridge, Provider, and setup

A new `@panerelay/browser-registry` package will own local registration persistence, liveness validation, selector resolution, and saved-default persistence. Bridge Native Hosts write their own entries; the agent-browser Provider reads and selects entries; setup and Extension integration read or update the saved default.

This keeps filesystem and selection policy out of the shared wire protocol and avoids duplicated validation across three packages. It also avoids a dependency cycle: `@panerelay/bridge` already depends on `@panerelay/agent-browser`, so the Provider cannot import Bridge state helpers.

Alternatives considered:

- Put routing in `@panerelay/protocol/node`: rejected because local browser selection is policy, not a shared protocol primitive.
- Put it in Bridge and let the Provider import Bridge: rejected because it creates a package cycle.
- Duplicate readers and writers: rejected because inconsistent validation or precedence would be a fail-open risk.
- Add a central broker daemon: deferred because independent Native Hosts already provide the required isolation and a broker adds startup, authentication, upgrade, and crash-recovery surfaces.

### Store one protected file per opaque registration

Live entries will be stored beneath `~/.panerelay/browsers/`. A filename is the SHA-256 digest of the opaque browser ID, while the complete ID remains in the validated JSON value. Directory permissions are `0700`, file permissions are `0600`, and writes use a same-directory temporary file plus atomic rename.

Each Native Host removes only the entry whose browser ID and PID it owns. Enumeration ignores malformed, incompatible, non-CDP-ready, and dead-process entries as appropriate; it never treats registration order or modification time as user intent.

The saved default is a separate protected record containing only protocol version, opaque browser ID, and update time. It is not stored in Extension storage because external Provider processes need the same user-level selection.

The existing `bridge.json` is read only as a transitional fallback when no current registry entries exist. Current Native Hosts do not write it, so mixed old/new installations converge after browser reload. Rollback remains possible because older builds can recreate their singleton after reload.

### Resolve a browser once per Provider launch

`PANERELAY_BROWSER_ID` explicitly selects an exact registration. `PANERELAY_BROWSER` accepts a normalized browser family (`chrome`, `chromium`, `edge`, or `unknown`) or an exact registration ID. Exact ID takes precedence when both variables are present.

Resolution order is:

1. explicit process selector;
2. saved registration ID;
3. the only live CDP-ready registration;
4. actionable failure.

An explicit or saved unavailable browser fails instead of falling through. A family matching more than one live registration fails and lists the opaque IDs. Names, focus, recency, process start time, and filesystem order never select a browser.

The Provider records browser ID, PID, and participant ID in cleanup metadata. `browser.close` rereads the exact browser entry and verifies PID before releasing the participant, so a changed default cannot redirect cleanup.

### Scope side-panel Agent subprocesses through environment

Every Native Host process belongs to one Extension connection. After `browser.register`, it records that browser ID in its process environment before launching Codex, Claude Code, or Qoder. The MCP configuration passed to each Agent also includes `PANERELAY_BROWSER_ID`, so nested agent-browser Provider processes remain scoped even when Agent runtimes filter inherited environment variables.

This explicit selector outranks the user default. It therefore keeps an Edge side-panel conversation in Edge while preserving Chrome as the default for unrelated shell or IDE invocations.

### Add browser-default integration operations

The shared Native Messaging protocol adds bounded `browser-default.get`, `browser-default.set-current`, and `browser-default.clear-current` integration operations. The Extension never supplies an arbitrary browser ID for mutation: the Native Host obtains the current identity from its registered relay.

The result contains the current browser's opaque ID, display name, family, current-default status, and saved default ID. Setting requires a current live registration. Clearing is conditional and removes the value only when the current browser owns it.

The Extension renders this separately from the agent-browser default-Provider toggle and browser authorization controls. No operation grants permission or changes an active participant.

### Extend the existing setup CLI

The `panerelay` binary adds:

- `panerelay browsers` to list live registrations and the saved default;
- `panerelay browser use <registration-id|family>` to save an exact or unambiguous live registration;
- `panerelay browser clear` to remove the saved default.

Human output remains localized. Selection commands operate only on local registry/default files and do not contact browser pages or change authorization. `doctor` continues to diagnose installation; browser listing is intentionally a separate runtime-status command.

### Compatibility classifications

- Chrome plus agent-browser 0.33.0 remains `Verified` only for behavior covered by its existing real-browser evidence and the new deterministic tests.
- Edge routing remains `Forwarded` until a representative real-Edge Provider run is recorded.
- Multiple simultaneous browser registrations are `Verified` at the local registry/selection contract level and `Forwarded` at the Edge runtime level.
- Cross-browser sessions and browser-process ownership features remain `Unsupported`.

## Risks / Trade-offs

- [A Native Host crashes and leaves a state file] → Liveness validation ignores dead PIDs; a later owner writes its own digest path atomically.
- [PID reuse makes an old entry appear live] → Provider requests still require the per-process random bearer token and bound loopback port; invalid endpoints fail without falling through to another browser.
- [A browser ID changes after reinstall] → The saved default becomes unavailable and fails with explicit reselection guidance instead of silently routing elsewhere.
- [Multiple profiles share one browser family] → Family selectors fail as ambiguous and require an exact opaque registration ID.
- [Environment is filtered by an Agent runtime] → Put the selector explicitly in each generated MCP server environment in addition to the browser-local parent process.
- [Legacy and current state coexist during update] → Ignore the legacy singleton whenever at least one current registry entry exists and document browser reload as the convergence step.
- [State files expose local credentials] → Preserve user-only permissions, never print bearer tokens, and show only bounded registration metadata in CLI/UI.

## Migration Plan

1. Ship the registry package, current Native Host writer, Provider reader/selector, CLI, and Extension operations in the lockstep release.
2. On first current browser registration, write only the per-browser entry and remove an owned legacy singleton when safe.
3. When no current entries exist, allow the Provider to read one live legacy singleton so an old still-running browser remains usable during update.
4. Ask users to reload each installed Extension after update; every reloaded browser then appears independently.
5. Roll back by reinstalling the previous lockstep release and reloading a browser, which recreates the legacy singleton. Per-browser files are inert to the older Provider.
