## 1. Architecture Gate and Browser Use Spike

- [x] 1.1 Review RFC-0007 against RFC-0001, RFC-0002, RFC-0003, RFC-0004, and RFC-0006; resolve blocking feedback and move RFC-0007 to Accepted before cross-package implementation begins.
- [x] 1.2 Pin Browser Use 0.13.7, Browser Harness 0.1.8, agent-browser 0.33.0, and representative Chromium versions in a new reproducible spike report without vendoring or modifying either upstream project.
- [x] 1.3 Add bounded loopback fixture pages for navigation, form input, popup lineage, same-origin and cross-origin iframes, downloads/uploads where supported, delayed network activity, and authorization-boundary checks.
- [x] 1.4 Capture and sanitize the actual Browser Harness browser-level CDP initialization trace against the current Panerelay relay, including method order, parameters needed for compatibility, results, events, session routing, and explicit unsupported calls.
- [x] 1.5 Run Browser Harness core helpers, tabs, popup, iframe/child-session, screenshot/artifact, revocation, and browser-ownership probes through the current virtual CDP and record a go/no-go matrix using Verified, Forwarded, Partial, and Unsupported.
- [x] 1.6 Verify current upstream daemon reuse, ignored replacement environment, simultaneous invocation, Native Host/relay loss, health probing, scoped reload, and stale-daemon recovery behavior; document whether public upstream behavior is sufficient without private IPC inspection.
- [x] 1.7 Retain only reusable fixtures, sanitized traces, and conclusions under `docs/spikes/`; remove temporary daemons, runtime directories, tabs, servers, credentials, screenshots, and machine-specific logs after the spike.
- [x] 1.8 Resolve the no-go input and iframe gates with bounded Extension-boundary probes; record the generic target focus-emulation and OOPIF target/session virtualization solutions without Browser Use-specific command rewriting or JavaScript input emulation.
- [x] 1.9 Implement generic target-scoped focus-emulation setup before first Input use, with per-target serialization, participant/attachment lifecycle cleanup, daily-Chrome Browser Harness verification, and agent-browser regression coverage.
- [x] 1.10 Implement generic non-pausing recursive OOPIF auto-attach plus participant-local virtual iframe target/session inventory, command/event translation, detach cleanup, Browser Harness `iframe_target()` verification, and child-session isolation tests.

## 2. CLI Adapter Protocol and Dispatcher

- [x] 2.1 Define the versioned Panerelay CLI adapter manifest, resolve, doctor, success, and failure envelopes with strict validators, payload bounds, protocol negotiation tests, and no Browser Use-specific fields in the generic contract.
- [x] 2.2 Add a protected setup-managed adapter registry with atomic writes, exact absolute executable paths, declared capabilities, allowed child-environment keys, protocol versions, and safe removal that preserves unrelated adapters.
- [x] 2.3 Extend `@panerelay/cli` with engine-neutral connection resolution, saved per-adapter mode, explicit one-run override, existing deterministic browser selection, and localized failure handling.
- [x] 2.4 Implement the CLI run surface so it invokes only the caller's exact child command, applies only manifest-allowed adapter environment, forwards standard streams and signals, returns the child exit status, and never interprets automation arguments.
- [x] 2.5 Add a user-scoped concurrency lock keyed by the adapter response so simultaneous Browser Use run invocations serialize within a bounded wait or fail busy without granting browser authority or claiming task isolation.
- [x] 2.6 Cover missing, relative, PATH-resolved, tampered, incompatible, oversized, slow, and over-permissioned adapter registrations/responses, plus browser-unavailable races and credential-redaction behavior, in CLI tests.

## 3. Authenticated CDP HTTP Bootstrap

- [x] 3.1 Add generic protocol types and validation for authenticated CDP bootstrap requests, responses, opaque lane keys, bounded automation actors, and single-connection participant policy.
- [x] 3.2 Implement an in-memory bounded bootstrap-ticket store with random credentials, browser/Native Host generation binding, expiry, outstanding limits, lane occupancy, and deterministic shutdown cleanup.
- [x] 3.3 Add authenticated `POST /cdp/bootstrap` behavior that creates only a no-store ticket and fails before participant, lease, target, WebSocket, or activity allocation on malformed, unauthorized, unsupported, or over-limit requests.
- [x] 3.4 Add ticket-specific `GET /cdp/bootstrap/<ticket>/json/version` behavior with standard DevTools version metadata, idempotent pre-connect resolution, lazy participant creation, connection-window expiry, and explicit invalid/expired/consumed/wrong-generation errors.
- [x] 3.5 Extend relay participants with a single-connection policy that consumes the Browser Use WebSocket credential after the first successful handshake while preserving the existing multi-connection `/sessions` behavior for agent-browser.
- [x] 3.6 Invalidate tickets and bootstrap participants on authorization loss, Extension disconnect, Native Host shutdown, transport loss, heartbeat expiry, and occupied-lane conflicts; verify target detach and pending-operation rejection remain fail closed.
- [x] 3.7 Add HTTP/WebSocket security tests for loopback binding, absent permissive CORS, unsupported methods and paths, body/time limits, repeated version requests, handshake races, second-client rejection, ticket/participant limits, and secret/content exclusion from logs and errors.

## 4. Browser Use Adapter Package

- [x] 4.1 Create the publishable `@panerelay/browser-use` package and standalone adapter executable with Node.js 20 compatibility, lockstep version metadata, licensing, build, typecheck, and package-artifact tests.
- [x] 4.2 Implement adapter manifest and doctor operations that report supported modes, allowed Browser Use environment keys, pinned Browser Use/Browser Harness compatibility, and bounded readiness errors.
- [x] 4.3 Implement Extension connection resolution by rereading only the CLI-selected live browser registration, verifying browser ID/PID/generation and CDP capability, and requesting a short-lived generic bootstrap ticket without returning the Bridge bearer.
- [x] 4.4 Return the private Browser Harness runtime, stable Panerelay daemon name, non-shared runtime setting, short-lived `BU_CDP_URL`, expiry, and concurrency key; ensure Direct mode bypasses ticket creation and adapter environment.
- [x] 4.5 Add adapter tests for explicit/default/single browser routing, unavailable or changed generations, multiple-browser ambiguity, missing authorization/readiness, ticket errors, bounded output, redaction, and no silent Direct fallback.

## 5. Setup, Skill, and Lifecycle Wiring

- [x] 5.1 Add explicit Browser Use integration selection to setup without changing existing default setup behavior or silently installing Browser Use itself.
- [x] 5.2 Build and install private version-pinned Panerelay CLI and Browser Use adapter artifacts under protected Panerelay storage, generate cross-platform launchers, and atomically register their exact paths without global npm installation or shell PATH changes.
- [x] 5.3 Persist the Panerelay-owned Browser Use Direct/Extension preference and private runtime paths without modifying Browser Use configuration, its official Skill, its executable, or another adapter's state.
- [x] 5.4 Add bounded Browser Use and Browser Harness executable/version probes to setup and doctor with English, Simplified Chinese, human-readable, and stable machine-readable diagnostics.
- [x] 5.5 Add the Panerelay Browser Use Skill using the private CLI run surface, normal Browser Use helpers, saved-mode behavior, explicit one-run overrides, authorization guidance, persistent-lane visibility, simultaneous busy behavior, and honest interleaved-Agent limitations.
- [x] 5.6 Add optional deterministic CLI MCP wiring through the same private CLI run path without claiming legacy Python MCP or arbitrary SDK transparency.
- [x] 5.7 Implement idempotent update and uninstall behavior that removes only Panerelay-owned Browser Use registration, Skill, configuration, launcher, adapter artifact, and private runtime state, with exact stale-daemon diagnostics and no broad process killing.
- [x] 5.8 Cover macOS, Linux, and Windows paths, permissions/ACL expectations, launchers, upgrades, partial installs, rollback, unrelated adapter preservation, official Skill preservation, and absent/incompatible Browser Use behavior in setup tests.

## 6. Integration and Real-Browser Acceptance

- [x] 6.1 Add Bridge-adapter-CLI contract tests proving ticket issuance allocates no participant, `/json/version` allocates exactly one, a healthy Browser Harness daemon ignores later ticket URLs, and unused tickets expire without consuming participant capacity.
- [x] 6.2 Verify the pinned Browser Harness initialization and representative core helpers through the implemented bootstrap and virtual CDP, including explicit errors for unsupported browser-process, context, containment, whole-profile, and whole-browser operations.
- [x] 6.3 Run a daily-Chrome single-tab scenario for passive initialization, read observation, form interaction, navigation, screenshot, cross-origin authorization loss, visible actor/activity, and immediate user revocation.
- [x] 6.4 Run a daily-Chrome all-tabs scenario for existing targets, background tab creation, logical selection without foreground theft, close, controlled popup lineage, iframe/child sessions, and independently opened target exclusion.
- [x] 6.5 Verify two sequential CLI processes reuse one Browser Harness daemon, participant, and WebSocket; verify simultaneous run behavior and record that sequential multi-Agent interleaving remains shared rather than isolated.
- [x] 6.6 Reload or terminate the Extension/Native Host while the persistent lane is connected, verify old tickets and WebSocket credentials fail, target attachments clear, the stale daemon cannot control Chrome, and the next invocation either recovers with a fresh ticket or fails with the specified actionable error.
- [x] 6.7 Inspect adapter, CLI, Bridge, Browser Harness, setup, and test output for Bridge bearers, tickets, WebSocket credentials, page content, cookies, screenshots, prompts, request bodies, or raw CDP bodies; retain no generated sensitive artifacts.
- [x] 6.8 Run the complete agent-browser 0.33.0 contract and representative daily-Chrome regression suite to prove `/sessions`, multi-connection participants, compatibility groups, cleanup, and browser routing remain unchanged.
- [x] 6.9 Remove all test tabs, fixture servers, temporary profiles, private runtime test directories, adapter locks, participants, and stale processes created by acceptance runs.

## 7. Compatibility, Documentation, and Release Gates

- [x] 7.1 Add a version-specific Browser Use 0.13.7 / Browser Harness 0.1.8 compatibility record with CLI, Panerelay Skill, CLI MCP, core, tabs, popups, frames, lifecycle, concurrency, ownership, and Python SDK scope classifications.
- [x] 7.2 Update package READMEs, setup/uninstall/doctor guidance, Skill guidance, security documentation, and user-facing mode/override examples while marking design-only commands until their final CLI spelling is implemented.
- [x] 7.3 Update release inventories, lockstep package versions, build/publish metadata, packed-artifact checks, and licensing for `@panerelay/browser-use`, the private CLI artifact, adapter registration, Skill, and Native Host bootstrap changes.
- [x] 7.4 Run package-scoped tests and typechecks during development, then `pnpm install --frozen-lockfile`, `pnpm run check`, strict OpenSpec validation, packed-release checks, and `git diff --check` before completion.
- [x] 7.5 Reconcile proposal, specs, design, RFC-0007, spike evidence, and compatibility results with implementation discoveries; keep unsupported behavior explicit and do not mark RFC-0007 Implemented until the governed lockstep release is published.
