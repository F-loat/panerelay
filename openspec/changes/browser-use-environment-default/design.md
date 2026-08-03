## Context

The current Browser Use adapter asks a selected Browser Relay to mint a short-lived ticket and injects the resulting URL into a child process through `@panerelay/cli`. Browser Harness 0.1.8 reads `BU_CDP_URL` directly, requests `<base>/json/version`, and reuses a healthy daemon before considering replacement environment. The current model therefore works for the official CLI, but only when Panerelay owns process launch and when a fresh ticket is injected.

The new model must preserve RFC-0001, RFC-0002, RFC-0004, RFC-0006, and the accepted security properties in RFC-0007 while making the official Browser Use process consume a persistent Panerelay environment default. A fixed URL must survive Browser Relay dynamic ports and Native Host restarts, so the fixed URL cannot be a Browser Relay URL itself.

## Goals / Non-Goals

**Goals:**

- Make `BU_CDP_URL` the Browser Use integration default read by the official Browser Use CLI and CLI MCP.
- Provide a stable per-user loopback discovery URL independent of any one Browser Relay's random port.
- Preserve saved browser selection, current generation binding, authorization, participant revocation, lane serialization, and explicit unsupported-operation failures.
- Keep Browser Use and Browser Harness automation semantics upstream-owned.
- Make Browser Use mode configuration symmetric with agent-browser Provider configuration while keeping browser selection shared and engine-neutral.

**Non-Goals:**

- Do not expose a remote or cross-user CDP service.
- Do not make arbitrary Browser Use Python SDK construction transparent beyond the environment behavior already provided by Browser Harness.
- Do not provide browser-process ownership, whole-profile cookies, isolated browser contexts, or task isolation.
- Do not preserve the old dedicated launcher, wrapper-only Skill, or wrapper-only CLI MCP path.

## Decisions

### 1. Add a user-scoped fixed gateway, not a fixed Browser Relay port

The gateway listens on a protected, user-scoped loopback port recorded under Panerelay state. Its public Browser Use endpoint is stable, for example `http://127.0.0.1:<gateway-port>/cdp/browser-use`. Browser Relays continue to use dynamic ports and register their current state normally.

The gateway is a Panerelay routing component, not an automation engine or Browser Use fork. The first Native Host that needs the integration ensures the gateway is running; subsequent Native Hosts reuse the protected gateway state. Gateway startup uses an atomic lock and verifies ownership before accepting an existing endpoint. If no Native Host is alive, the endpoint returns unavailable; it does not start a browser or bypass Extension authorization.

Alternatives rejected:

- A fixed port per Browser Relay does not support multiple browsers and makes port collisions part of browser registration.
- Writing the current dynamic Relay URL to `.env` is not stable across Native Host restart and does not make browser-default switching transparent.
- Keeping the current wrapper preserves the old asymmetry and does not affect a separately launched official Browser Use process.

### 2. Keep the dynamic ticket and WebSocket credential behind the stable endpoint

For `GET /cdp/browser-use/json/version`, the gateway selects a live registration using the same protected browser-default algorithm as agent-browser. A one-run adapter resolution can instead use `GET /cdp/browser-use/browser/<opaque-selection>/json/version`; the gateway decodes only the bounded browser ID and generation, validates that the live registration still has that generation, and does not consult an inherited `PANERELAY_BROWSER_ID`. In both cases it performs the equivalent authenticated bootstrap request to the selected Browser Relay, fetches that ticket's `/json/version`, and returns the version metadata to Browser Harness. The returned WebSocket URL remains the Relay's participant-specific URL and retains its short-lived connection credential.

The fixed URL is therefore only a discovery and routing address. It is not a permanent CDP authorization token. The gateway never returns Bridge bearer tokens or ticket URLs, and it does not log the returned WebSocket URL.

The gateway maps Browser Relay errors to bounded Browser Harness-compatible HTTP errors. It does not create a participant before a valid discovery request and reuses the existing ticket-store idempotency and lane checks.

### 3. Store Browser Harness environment as an integration-owned `.env` overlay

The Browser Use integration writes only its managed keys to a protected Browser Harness workspace environment file using atomic replacement and a parse/merge routine. Extension mode writes `BU_CDP_URL` pointing to the fixed gateway plus the stable daemon name and telemetry/recording disables. It intentionally leaves Browser Harness's runtime and temporary-directory defaults unchanged because Browser Harness 0.1.8 initializes client IPC paths before loading the workspace `.env`; overriding those paths from `.env` can make the client and daemon resolve different sockets. Direct mode removes only those managed keys, allowing Browser Harness's normal local discovery and user settings to apply.

This uses Browser Harness's documented environment loading behavior and does not patch or vendor it. Unrelated keys remain intact. The configuration is only a default: explicit process environment values retain normal upstream precedence where Browser Harness supports them.

### 4. Move mode persistence to the Browser Use integration boundary

`connection use browser-use extension|direct` remains the engine-neutral user-facing command, but its Browser Use branch delegates to the shared Browser Use integration configuration writer rather than relying on `run` to inject child environment. The Extension's Browser Use default setting uses the same writer. Browser selection remains in the shared browser registry and is read by the gateway at discovery time.

Setup exposes one generic `--global-default` flag for user-level defaults. When `--agent-browser` and/or `--browser-use` is selected, the flag applies to each selected integration; project-level default configuration is not exposed by the setup CLI.

The adapter protocol remains available for health/diagnostic and integration installation operations during the transition implementation, but normal Browser Use invocation no longer depends on adapter resolution or a Panerelay child wrapper.

### 5. Gateway lifecycle and revocation

The gateway owns no Browser participant. It forwards the dynamic WebSocket URL to Browser Harness, while the selected Browser Relay owns the participant and invalidates it on authorization loss, generation change, transport loss, heartbeat expiry, or Native Host shutdown. A later `/json/version` request must select a current registration and mint a new participant when the old one is invalid. Uninstall verifies the gateway's protected state against its loopback health PID and asks that owned gateway to exit; an unavailable or mismatched process is reported as remaining rather than being killed by a broad process match.

When the gateway cannot find a valid default, it fails closed. It never falls back to Direct mode or another browser after an explicit/default selection failure.

## Risks / Trade-offs

- **[Same-user loopback access]** A same-user local process can call the fixed discovery endpoint without a per-request secret → bind loopback only, use protected gateway state, keep the dynamic WebSocket credential, document the same-user trust boundary, and do not claim cross-user isolation.
- **[Gateway process lifecycle]** A Native Host may exit while the gateway remains → use a protected PID/lock record, health checks, stale-owner recovery, and uninstall cleanup; the endpoint returns unavailable when no Browser Relay is eligible, and uninstall reports a gateway that cannot be verified or stopped.
- **[Browser Harness daemon reuse]** A healthy daemon ignores changed connection environment, and Browser Harness 0.1.8 loads workspace environment after initializing IPC paths → use the stable gateway URL and `BU_NAME` lane while leaving runtime/temp directory defaults untouched, and explicitly test reload, stale participant invalidation, and browser-default changes.
- **[Configuration ownership]** Browser Harness `.env` is upstream-owned input → merge only bounded Panerelay keys atomically, preserve unrelated entries, and remove only exact managed keys on uninstall.
- **[Multiple browsers]** A fixed endpoint must select among independent Native Hosts → read the protected shared browser registry at every discovery request and use the existing saved-default/ambiguous-selection rules.
- **[Version drift]** Browser Harness environment loading may change → pin and verify Browser Use 0.13.7/Browser Harness 0.1.8, retain a compatibility probe, and fail doctor/setup with an actionable unsupported message.

## Migration Plan

Because this release is unpublished, remove the old launcher, wrapper-specific artifacts, and adapter-injected child environment in one change. Setup installs/starts the gateway, writes the Browser Harness default, and installs a Skill that invokes the official `browser-use` command. Uninstall stops/removes the gateway ownership state and removes only Panerelay-managed environment keys.

Rollback during development is a source-level revert. There is no released-user migration requirement, but tests must cover cleanup of state created by a failed or interrupted installation.

## Verification Matrix

- **Verified:** official Browser Use CLI and CLI MCP start with only the managed environment default and complete `list_tabs()`/`page_info()` against authorized daily Chrome.
- **Verified:** fixed endpoint discovery, Browser Relay selection, generation changes, Extension revocation, stale daemon recovery, and sequential daemon reuse.
- **Verified:** multiple registered browsers use the saved default and fail explicitly when ambiguous.
- **Verified:** gateway loopback, method/path/query rejection, bounded responses, atomic environment updates, uninstall cleanup, and gateway stale-owner recovery.
- **Forwarded:** ordinary Browser Use helper and MCP semantics remain upstream behavior reached through the gateway.
- **Unsupported:** browser-process ownership, whole-profile cookies, isolated contexts, and arbitrary SDK transparency remain explicit boundaries.
