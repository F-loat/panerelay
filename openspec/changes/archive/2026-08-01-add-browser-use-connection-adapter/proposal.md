## Why

Browser Use can connect to an existing browser through CDP, but its current CLI and Browser Harness daemon do not expose a general connection-provider lifecycle. Panerelay needs an upstream-independent integration that lets the Browser Use Skill reuse explicitly authorized tabs in the user's daily Chromium browser without enabling Chrome Remote Debugging, replacing Browser Use automation semantics, or rewriting the user's unrelated Browser Use configuration.

## What Changes

- Add an optional `@panerelay/browser-use` connection adapter, installed and registered only when setup is asked to enable the Browser Use integration.
- Extend `@panerelay/cli` with a bounded out-of-process adapter protocol and commands that resolve or run an engine connection without hard-coding Browser Use into the CLI core.
- Add an authenticated, loopback-only CDP HTTP bootstrap flow. A short-lived bootstrap ticket produces `/json/version` metadata and allocates a virtual CDP participant only when Browser Harness actually starts a new daemon connection.
- Install a Panerelay Browser Use Skill that routes Browser Use CLI and Browser Harness calls through the Panerelay CLI, injects a dedicated `BU_NAME`, `BH_RUNTIME_DIR`, and dynamic `BU_CDP_URL`, and leaves Browser Use automation commands unchanged.
- Keep one lazily started Panerelay Browser Harness daemon and participant alive across sequential Skill calls. Extension revocation, WebSocket loss, Native Host shutdown, or heartbeat expiry still detaches targets and invalidates the participant; normal task completion does not stop the persistent lane.
- Store the global Direct or Panerelay connection preference in Panerelay-owned configuration and support one-run overrides without editing Browser Use configuration or replacing another Browser Harness daemon.
- Add Browser Use 0.13.7 and Browser Harness 0.1.8 spike and compatibility coverage for bootstrap, core helpers, tabs, popups, frames, revocation, reload, persistent reuse, fail-busy concurrency, and stale-daemon recovery.
- Add generic virtual-CDP prerequisites verified by the spike: target-scoped focus emulation before first Input use and participant-local browser-level iframe target/session virtualization backed by non-pausing OOPIF auto-attach.
- Preserve agent-browser 0.33.0 and its existing core, tab, cookie/storage, network, artifact, tracing, profiling, lifecycle, and browser-platform compatibility classifications as regression baselines; this change does not alter the agent-browser Provider contract.

Non-goals:

- Do not add or modify a Browser Use upstream provider/plugin API, fork Browser Use, patch Browser Harness, or intercept its automation semantics.
- Do not make arbitrary Python SDK `Agent(...)` construction transparently use Panerelay; a future SDK helper may explicitly construct a Browser Use `BrowserSession`.
- Do not silently affect raw `browser-use` commands outside the installed Panerelay Skill/CLI integration, install a global PATH shim, or overwrite Browser Use's own configuration or official Skill.
- Do not provide browser-process ownership, isolated browser contexts, whole-browser close, whole-profile data access, silent authorization, or focus-based authorization through the Extension-backed connection.
- Do not claim parallel task isolation inside one persistent local Browser Harness lane. The first release serializes or fails busy for simultaneous adapter invocations and documents that interleaved multi-Agent tasks still share Browser Harness tab/session state.

## Capabilities

### New Capabilities

- `browser-use-connection-adapter`: Optional setup, Skill, persistent lane, connection-mode selection, Browser Use compatibility, lifecycle, and fail-closed behavior for the Panerelay Browser Use integration.
- `cdp-http-bootstrap`: Authenticated short-lived HTTP-to-WebSocket CDP bootstrap tickets that allocate bounded participants only when consumed by a compatible client.

### Modified Capabilities

- `panerelay-cli`: Add setup-managed out-of-process connection adapters and engine-neutral connection resolution/execution commands while preserving the CLI's browser-administration role.

## Impact

- New publishable package: `packages/browser-use` under the `@panerelay` scope.
- Affected packages: `@panerelay/cli`, `@panerelay/setup`, `@panerelay/bridge`, `@panerelay/browser-registry`, and `@panerelay/protocol`; the Extension continues generic CDP command/event transport and should require only generic bootstrap/lifecycle message changes, if any.
- New setup-managed adapter registration, Panerelay-owned Browser Use configuration, private Browser Harness runtime directory, installed Skill, doctor checks, and uninstall behavior.
- New loopback Bridge endpoints, in-memory bootstrap-ticket state, participant connection policy, bounded expiry/rate limits, and explicit errors for unavailable browsers, unauthorized tickets, occupied lanes, unsupported CDP methods, and revoked authorization.
- New `docs/compatibility/` coverage for pinned Browser Use and Browser Harness versions, plus reproducible `docs/spikes/` fixtures and traces. Existing accepted RFC-0001/RFC-0002 authorization and ownership decisions remain authoritative; a new RFC is required for the durable CLI adapter protocol, HTTP CDP bootstrap lifecycle, and persistent Browser Use participant boundary.
