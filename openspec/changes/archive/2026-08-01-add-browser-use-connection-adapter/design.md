## Context

See [proposal.md](./proposal.md) for motivation and the delta specs for observable requirements.

Panerelay already exposes an authenticated browser-level virtual CDP WebSocket through one Extension-owned Native Host per connected Chromium browser. The live browser registry contains the Native Host PID, loopback port, bearer credential, opaque browser identity, and CDP capability. The current `@panerelay/agent-browser` Provider reads that protected registration, creates a participant through `POST /sessions`, returns its virtual WebSocket, and explicitly releases it when agent-browser closes the Provider.

The accepted authorization, target, and ownership boundaries remain RFC-0001, RFC-0002, RFC-0004, and RFC-0006. RFC-0003 describes the implemented heartbeat, participant-isolation, activity, and expiry model but is still marked Draft. This change adds another automation adapter without weakening those boundaries. RFC-0007 records the new durable decisions for CLI adapters, HTTP CDP bootstrap, and the persistent Browser Use lane.

The pinned upstream baseline is Browser Use 0.13.7 with Browser Harness 0.1.8. Current upstream behavior relevant to the design is:

- Browser Use's installed Skill, normal CLI, and CLI MCP use Browser Harness; arbitrary Python SDK construction uses a separate `BrowserSession` path.
- Browser Harness selects `BU_CDP_WS`, then `BU_CDP_URL`, then local Chrome discovery.
- `BU_CDP_URL` is treated as an HTTP DevTools base and Browser Harness requests `<base>/json/version` only when it starts a daemon connection.
- Browser Harness keeps one detached daemon per runtime/name, reuses a healthy daemon across commands, and ignores a new process environment when that daemon is already healthy.
- The daemon attaches a first page, holds one browser WebSocket, and logs the resolved WebSocket URL before connecting.
- Browser Use and Browser Harness expose no general upstream connection-provider lifecycle and no isolated one-run daemon abstraction.

The architecture-gate spike verified that initialization, daemon reuse, public stale-daemon recovery, revocation, tabs, navigation, screenshots, and uploads work through the current relay. A follow-up Extension-boundary probe resolved its two blockers without an upstream change. The Bridge now applies generic target focus emulation before first Input use and projects Chrome's non-pausing flattened OOPIF child sessions as participant-local browser-level iframe targets. The unchanged Browser Harness key, coordinate mouse, `iframe_target()`, and target-scoped JavaScript helpers pass through daily Chrome. The development candidate also implements and verifies the adapter, authenticated bootstrap, setup, Skill, CLI MCP, persistent-lane, and cleanup boundaries described below.

These facts make a stable process-wide `BU_CDP_URL` unsafe, and make eager participant creation wasteful: most Skill calls will reuse an existing daemon and never consume the new URL.

## Goals / Non-Goals

**Goals:**

- Keep every supported Skill and recurring integration call behind the Panerelay CLI while keeping Browser Use automation semantics upstream-owned.
- Install Browser Use support as an optional, separately versioned Panerelay adapter.
- Allocate a participant only when Browser Harness actually needs a new CDP connection.
- Let a fixed private Browser Harness lane remain connected for the Native Host generation while preserving immediate revocation, heartbeat expiry, and visible observation/control state.
- Keep Direct and Extension lanes independent so a saved default or one-run override cannot replace the other lane's daemon.
- Make the adapter boundary reusable by future engines without making Browser Use fields part of the shared browser protocol.

**Non-Goals:**

- Provide a Browser Use upstream plugin, patch or fork Browser Harness, or infer Browser Use task semantics from CDP traffic.
- Make the official Browser Use Skill or arbitrary raw `browser-use` calls automatically use Panerelay outside the installed Panerelay Skill/CLI entry.
- Transparently change Python SDK `Agent(...)` defaults.
- Provide multi-Agent task isolation inside one Browser Harness daemon.
- Add a central broker independent of the browser-owned Native Host.
- Change RFC-0002/RFC-0004 browser-process ownership, focus, target lineage, or unsupported-method boundaries.

## Decisions

### 1. Add a Panerelay CLI adapter protocol and keep Browser Use out of CLI core

`@panerelay/cli` becomes the only supported recurring entry point used by the installed Skill. A new `@panerelay/browser-use` package implements a Panerelay connection adapter executable. It is not described as a Browser Use upstream Provider.

The adapter runs out of process over a single-request/single-response JSON stdio protocol such as `panerelay.cli-adapter.v1`. The minimum operations are:

- `adapter.manifest`: returns adapter ID, protocol, capabilities, supported modes, and allowed child-environment keys;
- `connection.resolve`: resolves connection material for one exact browser ID and one mode;
- `adapter.doctor`: reports bounded dependency, registration, and compatibility diagnostics.

The CLI owns user-facing parsing, locale, saved mode, one-run override, deterministic browser selection, child execution, streams, signals, and exit status. For Extension mode, it passes only the selected opaque browser ID and bounded request metadata to the adapter. The adapter rereads that exact protected registration to obtain the current loopback endpoint and bearer without serializing the bearer through arguments or stdio.

The adapter response declares a connection kind, expiry, concurrency key, and an environment map. The CLI accepts only keys declared by the adapter manifest and registration. The Browser Use adapter may return `BU_CDP_URL`, `BU_NAME`, `BH_RUNTIME_DIR`, `BH_RUNTIME_DIR_SHARED`, `BH_TMP_DIR`, `BH_TMP_DIR_SHARED`, `BH_TELEMETRY`, `ANONYMIZED_TELEMETRY`, and `BH_RECORD`; it cannot replace `PATH`, home-directory variables, the child executable, or unrelated Agent configuration. Telemetry and automatic recording fail closed to disabled for the Panerelay lane. Browser Harness logs and temporary artifacts are confined to protected Panerelay-owned storage because the pinned upstream daemon otherwise records its full WebSocket URL and initial target metadata in its global temporary directory.

The implemented CLI surfaces are:

```text
panerelay connection use browser-use <direct|extension>
panerelay connection resolve browser-use
panerelay run browser-use -- browser-use [upstream arguments]
```

The installed Skill uses the run surface so the CLI can inject environment cross-platform and hold a simultaneous-invocation lock for the lifetime of the child. The connect surface exists for bounded diagnostics, spike work, SDK helpers, and explicit callers; it does not claim to lock an Agent task after the CLI exits.

Alternatives considered:

- **Hard-code Browser Use in `@panerelay/cli`**: rejected because environment names, version checks, and recovery behavior are engine-specific.
- **Have the Skill invoke the adapter binary directly**: rejected because it duplicates routing, mode, localization, security, and diagnostics outside the recurring CLI.
- **Load JavaScript modules into the CLI process**: rejected because package resolution and in-process code loading widen the trusted configuration and upgrade boundary.
- **Reuse the agent-browser Provider protocol**: rejected because its `browser.launch`/`browser.close` contract and upstream ownership are specific to agent-browser.

### 2. Setup installs exact private artifacts instead of global packages or PATH shims

Setup gains an explicit Browser Use integration selection. When selected, it installs lockstep artifacts under Panerelay-owned storage, for example:

```text
~/.panerelay/bin/panerelay[.cmd]
~/.panerelay/adapters/browser-use/<version>/panerelay-browser-use[.cmd|.cjs]
~/.panerelay/cli-adapters.json
~/.panerelay/browser-use/config.json
~/.panerelay/browser-use/runtime/
~/.agents/skills/panerelay-browser-use/
```

The exact paths are recorded with user-only directory and file permissions. The Skill refers to the setup-managed CLI launcher, not an ambient `panerelay` or adapter executable. Setup may bundle and copy artifacts built from the separate packages; it must not depend on the temporary `npx @panerelay/setup` dependency tree after setup exits.

This also avoids the current packaging collision in which both `@panerelay/setup` and `@panerelay/cli` publish a `panerelay` bin: setup does not install both packages into one global prefix. A globally installed `@panerelay/cli` remains optional for humans and reads the same protected adapter registry.

Setup does not install Browser Use itself. It detects and records the exact Browser Use executable/version when compatible, emits doctor guidance otherwise, and never edits Browser Use's official Skill or configuration. The Panerelay Skill is additive and is the supported transparent entry. Natural-language skill selection cannot guarantee interception of a separately installed official Browser Use Skill; setup and documentation must state that limitation rather than overwriting it.

Alternatives considered:

- **`npm install -g` or shell PATH modification**: rejected because it changes unrelated user commands and creates bin ownership conflicts.
- **A same-name `browser-use` shim**: rejected as the default because it silently intercepts raw upstream commands and is difficult to scope across Agents and shells.
- **Patch the installed Browser Use Skill**: rejected because upstream updates overwrite it and uninstall cannot safely reconstruct user edits.

### 3. Use a generic authenticated HTTP CDP bootstrap ticket

The current authenticated `POST /sessions` remains the direct Provider path for agent-browser and other explicit lifecycle owners. Browser Harness instead receives a generic HTTP DevTools base because it already knows when a daemon really needs a connection.

The Bridge adds a generic flow:

```text
POST /cdp/bootstrap                         Authorization: Bearer <bridge token>
  -> { cdpUrl: http://127.0.0.1:<port>/cdp/bootstrap/<ticket>, expiresAt }

GET /cdp/bootstrap/<ticket>/json/version
  -> { Browser, Protocol-Version, webSocketDebuggerUrl }

WS /cdp?session=<participant>&token=<connection capability>
```

The authenticated POST validates a bounded automation actor, opaque lane key, and single-connection policy, then creates only an in-memory ticket. It does not create a participant or lease. Initial implementation constants should reuse existing bounds where practical: a 30-second ticket lifetime, 30-second participant connection window, 16 KiB request cap, and a separate bounded outstanding-ticket count.

The ticket-specific `/json/version` request atomically creates at most one participant. Repeated version requests before WebSocket connection return the same result. The ticket and participant are bound to the browser ID, Native Host process/generation, actor, and lane key. If another connected participant already owns that lane key, consumption fails busy instead of returning its credential or allocating a competing Browser Use lane.

On the first successful WebSocket handshake, a single-connection participant consumes its connection capability. Further handshakes with the logged URL fail. Browser Harness holds the established WebSocket as long as it is healthy; after loss it obtains a new ticket and starts a new daemon connection rather than reconnecting with an old URL. Existing multi-connection participant behavior used by agent-browser remains unchanged.

All bootstrap responses use `Cache-Control: no-store`. The server remains loopback-only, sends no permissive CORS headers, rejects preflight and unknown paths, and never logs bearer, ticket, participant credential, body, or page content. Browser Harness currently logs the resolved WebSocket URL, so consuming its token at handshake is a required mitigation, not an optional hardening.

Alternatives considered:

- **Return a raw WebSocket from every adapter call**: rejected because a healthy daemon ignores it, leaving unused participants and hitting participant limits.
- **Expose a stable unauthenticated `/json/version`**: rejected because any local page or process could mint browser authority.
- **Expose the Bridge bearer in `BU_CDP_URL`**: rejected because Browser Harness environment and logs are not an appropriate home for the broad Bridge credential.
- **Use a long-lived scoped bootstrap secret**: rejected in favor of per-call short-lived tickets; unused tickets are cheap and create no participant.

### 4. Keep one private Browser Harness lane persistent

Extension mode uses a fixed private runtime and name, conceptually:

```text
BU_NAME=panerelay
BH_RUNTIME_DIR=~/.panerelay/browser-use/runtime
BH_RUNTIME_DIR_SHARED=0
BH_TMP_DIR=~/.panerelay/browser-use/tmp
BH_TMP_DIR_SHARED=0
BH_TELEMETRY=0
ANONYMIZED_TELEMETRY=false
BH_RECORD=0
BU_CDP_URL=<fresh short-lived bootstrap base>
```

The first Browser Use command starts Browser Harness. Its `/json/version` call consumes the ticket, creates the `browser-use` participant, and opens one WebSocket. Later Skill commands still resolve fresh tickets, but a healthy Browser Harness daemon reuses the old WebSocket and never requests those URLs; the unused tickets expire without participant cleanup.

Normal Skill completion does not stop this daemon or participant. The actor is the persistent Browser Use lane rather than an individual Agent task, so the side panel may continue to show it connected and may show attached targets as observed or controlled according to RFC-0004. User revocation, permission loss, WebSocket close, heartbeat expiry, Extension disconnect, or Native Host shutdown remains authoritative and immediately releases the participant and target attachments.

Browser Harness is detached from both the Skill shell and Native Host, so Native Host shutdown does not necessarily terminate its operating-system process. It does close the relay and make the daemon CDP connection unhealthy. The next invocation relies first on Browser Harness's public health/restart behavior with the fresh environment. The spike must verify this exact sequence. If current upstream cannot recover, the integration reports a bounded stale-daemon error or uses a documented public scoped reload; it must not inspect undocumented daemon internals, kill broad process patterns, or fall back to Direct.

Alternatives considered:

- **One daemon and participant per Skill command**: rejected because Browser Harness intentionally persists and multiple command invocations compose one task.
- **Stop the lane at an inferred Agent task boundary**: rejected because the Skill has no reliable cross-Agent task completion signal and cleanup instructions are not reliable after cancellation.
- **Tie the Browser Harness process itself to Native Host parent death**: rejected because upstream deliberately detaches the daemon; participant/authority follows the WebSocket and Native Host generation even if the stale process remains until recovery.

### 5. Direct and Extension modes are independent lanes

The saved mode is stored in protected Panerelay adapter configuration, not Browser Use configuration. Extension mode invokes the registered adapter and private runtime. Direct mode bypasses adapter resolution, does not request a ticket, and launches Browser Use with its normal environment and daemon behavior.

An explicit CLI/Skill mode overrides the saved value only for that invocation. Changing the saved value never restarts a healthy daemon. This makes both directions of one-run override possible without temporarily editing `BU_CDP_URL`, replacing a daemon, or changing another Agent's process environment.

The CLI resolves one exact ready browser before invoking the Extension adapter using RFC-0006 order. The adapter rereads only that registration and verifies its Native Host generation before requesting a ticket. An unavailable or ambiguous browser fails closed; it never falls through to another browser or Direct mode.

### 6. The Extension remains the only owner that starts the Native Host

Setup installs the Native Messaging manifest and bundled host. The Extension's existing `chrome.runtime.connectNative()` path starts the Native Host and reconnects after a disconnect. Neither the CLI nor Browser Use adapter launches the Native Host directly because a manually started process lacks the Chrome-owned Native Messaging channel and Extension identity.

If no live registration exists, the CLI/adapter fails with readiness guidance. It may perform a short bounded reread for a registration already being written, but it cannot wake Chrome or silently grant authorization. The user opens/reloads the Extension or side panel and authorizes eligible tabs through the existing UI.

### 7. Simultaneous invocation control is narrower than task isolation

The Browser Use adapter declares one concurrency key for its private lane. The canonical CLI run surface holds a user-scoped lock while the child Browser Use process is executing. A simultaneous run either waits within a small documented bound or fails busy. The lock is not a control lease and grants no browser authority.

Separate short CLI invocations from different Agents can still interleave over the persistent Browser Harness daemon after each process exits. Browser Harness maintains shared current page/session and event state, so this release documents that limitation and does not describe the lane as per-Agent isolated. True task isolation would require reliable Agent task identity plus per-task daemons/lifecycle or an upstream connection hook, and remains outside this change.

### 8. Compatibility is trace-driven and release claims are surface-specific

The mandatory spike records the Browser Harness initialization trace and compares it with the current Bridge virtual CDP surface. At minimum it exercises:

- HTTP `/json/version` and WebSocket handshake;
- the actual initialization calls—currently target discovery, flattened attach/detach, and page-domain enablement—plus any later `Browser.getVersion` probe if a pinned upstream version begins sending one;
- core page reads, accessibility, JavaScript, input, navigation, waits, screenshots, and supported files/artifacts;
- tab create/list/select/close, popup lineage, iframe and child-session routing;
- unsupported Browser and Target methods with explicit errors;
- single-tab and all-tabs authorization, cross-origin revocation, user release, and debugger displacement;
- two sequential CLI processes reusing one daemon/participant;
- simultaneous run behavior and documented interleaved-Agent limitations;
- Native Host/Extension reload, stale daemon detection, and fresh-ticket recovery;
- ticket expiry, repeated `/json/version`, handshake race, credential reuse, and sensitive-log inspection.

The compatibility record uses `Verified`, `Forwarded`, `Partial`, and `Unsupported`. Initial claims cover Browser Use CLI, the installed Panerelay Skill, and Browser Harness-backed CLI MCP for Browser Use 0.13.7 / Browser Harness 0.1.8. Python SDK transparency is not included. agent-browser 0.33.0 remains a full regression gate because bootstrap and participant-policy changes share the Bridge.

### 9. Resolve Browser Harness compatibility in the generic virtual-CDP layer

Panerelay applies `Emulation.setFocusEmulationEnabled({enabled:true})` as target-scoped connection setup before the first forwarded `Input.*` command for an attached target/debugger generation. The setup is serialized with the triggering target command. Each participant that uses Input holds a target focus-emulation claim; if the physical attachment remains for other observers, Panerelay disables emulation after the final such claim is released. Target detach naturally invalidates it. It also resets on authorization, Extension, and Native Host cleanup. It does not activate a Chrome tab, focus a Chrome window, grant authorization, or translate any Browser Harness input command.

Panerelay also enables non-pausing flattened iframe auto-attach on physically attached authorized top-level targets and recursively on attached OOPIF children. The Bridge maintains owning-target-scoped Chrome child state but exposes only participant-local opaque iframe target and session identifiers. Synthesized browser-level `Target.getTargets` includes those virtual iframe targets, and flattened `Target.attachToTarget` maps a virtual iframe target to a participant-local session backed by the already auto-attached Chrome child session. Child events and commands are translated through that mapping.

Child inventory never widens the authorized top-level target set. A child is visible only while its owning top-level target is authorized and exposed to that participant. Child detach, target detach, participant close, authorization loss, Extension disconnect, and Native Host shutdown invalidate the corresponding virtual targets and sessions. `waitForDebuggerOnStart` remains false, and nested auto-attach does not claim pre-request containment.

## Risks / Trade-offs

- **[Persistent Browser Use connection remains visible for hours or days]** → Treat this as intentional lane state, retain RFC-0004 observed/controlled visibility and immediate user release, and never call an idle connected participant “finished.”
- **[Official Browser Use Skill may be selected instead of the Panerelay Skill]** → Keep installation additive, make setup output and Skill descriptions explicit, support deterministic MCP configuration, and do not claim interception of the official Skill.
- **[Browser Harness logs the WebSocket URL]** → Use a short connection window and consume the credential on the first handshake; redact adapter/CLI diagnostics and test committed/runtime logs for credential leakage.
- **[Unused ticket churn on every sequential command]** → Tickets allocate no participant, expire quickly, and are bounded independently from participant limits.
- **[Native Host reload leaves a detached stale daemon process]** → Verify upstream health recovery, isolate it in a private runtime, fail explicitly if recovery does not work, and avoid broad process killing.
- **[One persistent lane lets sequential Agent tasks interfere]** → Prevent simultaneous process execution and document shared state; defer true multi-Agent isolation.
- **[CLI adapter protocol increases local executable trust]** → Allow only setup-managed absolute paths under protected storage, use a versioned manifest and bounded stdio, and never resolve adapters from PATH.
- **[Adapter output could inject dangerous child environment]** → Require a manifest-declared allowlist and reject path, home, shell, loader, and unrelated credential variables.
- **[Current virtual CDP differs from Browser Harness assumptions]** → Make the trace spike a gate before product implementation and classify unsupported semantics honestly rather than synthesizing high-level workarounds.
- **[Focus emulation changes page-observed focus while a target remains controlled]** → Enable it only on first Input use, never during passive observation, retain visible controlled state and immediate release, serialize setup/cleanup by target, and reset it with the owning attachment lifecycle.
- **[Virtual iframe inventory could leak raw Chrome identifiers or cross-participant state]** → Mint participant-local target/session identifiers, bind every child to one authorized owning target, translate all events and commands, and invalidate mappings on every child, participant, target, authorization, and host boundary.
- **[New bootstrap policy regresses agent-browser]** → Keep `/sessions` and existing multi-connection participants unchanged and run the pinned agent-browser 0.33.0 suite and daily-Chrome acceptance.

## Migration Plan

1. Land and accept RFC-0007 before implementation changes the CLI adapter, bootstrap, or persistent participant boundary.
2. Run the bounded Browser Use/Browser Harness spike against the current relay, commit only sanitized traces, fixtures, and conclusions, then implement and regress the verified generic focus-emulation and virtual iframe-target prerequisites before adapter or bootstrap release work.
3. Add generic bootstrap and participant-policy support behind no existing route or behavior change; keep `/sessions` as the agent-browser path.
4. Add the CLI adapter protocol and standalone Browser Use adapter, then setup-managed installation and Skill wiring.
5. Ship the integration as opt-in. Existing setup invocations, Browser Use configuration, raw CLI behavior, and agent-browser defaults remain unchanged.
6. Add doctor and compatibility gates before enabling a release claim for the pinned versions.

Rollback removes the adapter registration, Skill, private adapter/CLI artifacts, and private Browser Harness runtime, and disables the new bootstrap route in the matching lockstep Bridge release. It does not edit Browser Use. Reloading the Extension/Native Host invalidates all old tickets, URLs, and participants. RFC-0007 remains Accepted, not Implemented, until the feature is released.

## Remaining release question

Whether a future compatibility record promotes Edge from `Forwarded` after a dedicated real-Edge Browser Use run does not change the Chrome-first architecture. The implemented first-release bounds are 32 outstanding tickets, 30-second ticket and connection windows, and a 750-millisecond simultaneous-run wait capped by the generic CLI lock implementation.
