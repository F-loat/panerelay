## Why

Installing Panerelay in Chrome and Edge currently leaves one process-wide discovery file, so the last browser to register silently becomes the browser used by every new agent-browser session. Users need deterministic browser selection without combining independent browser permissions, control leases, or CDP transports.

## What Changes

- Register each connected Chrome or Edge Native Host independently instead of overwriting a singleton discovery record.
- Add deterministic browser selection for agent-browser 0.33.0: an explicit invocation selector, then the saved user default, then the only ready browser; ambiguous or unavailable selections fail closed.
- Pin every allocated agent-browser participant to one browser registration for its complete lifetime and clean it up through that same registration.
- Let each Extension instance make its own browser the saved user default and show whether it currently owns that default.
- Add CLI inspection and selection commands for external agent-browser users.
- Preserve browser-local site permissions, tab authorization, control leases, revocation, and status. Selecting a browser does not authorize it.
- Record the durable routing and ownership decision in a new RFC and update the Chrome/Edge compatibility evidence.

Non-goals:

- Merging Chrome and Edge into one CDP endpoint or allowing one agent-browser session to span browsers.
- Automatically choosing a browser from operating-system focus, recent activity, or a newly granted permission.
- Moving browser automation semantics out of agent-browser or adding browser-specific behavior to the shared wire protocol.
- Supporting simultaneous selection of multiple profiles with the same browser-family shortcut; users must select an opaque registration ID when a family is ambiguous.

Browser ownership remains local to the selected browser installation. Its Extension and Native Host retain sole authority over that browser's permissions, leases, controlled tabs, and revocation.

## Capabilities

### New Capabilities

- `multi-browser-routing`: Independent browser registration, deterministic selection, browser-pinned agent-browser sessions, fail-closed ambiguity handling, and CLI selection.

### Modified Capabilities

- `guided-browser-readiness`: Extension settings expose a browser-local action for inspecting and changing the saved agent-browser default without granting permissions.

## Impact

- Affects `@panerelay/protocol` Node paths, Bridge state and Native Host lifecycle, the agent-browser Provider plugin, setup diagnostics, the standalone CLI, Extension native integration, and Extension settings.
- Pins compatibility to agent-browser 0.33.0 and affects the existing Chrome/Edge desktop-extension, native-messaging, and agent-browser Provider compatibility groups.
- Replaces last-writer-wins singleton discovery for current lockstep builds; transitional reads of a live legacy singleton may remain when no current registry entries exist.
- Adds `@panerelay/browser-registry` as an internal runtime package; the follow-up CLI extraction adds `@panerelay/cli`. Neither introduces a new external runtime or automation-engine dependency, and browser-automation command semantics remain owned by agent-browser.
