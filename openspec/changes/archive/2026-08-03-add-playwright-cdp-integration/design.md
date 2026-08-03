## Context

The accepted architecture in RFC-0001 and RFC-0002 keeps browser automation semantics in the client and makes the Bridge the local routing, policy, lease, and CDP boundary. The existing Browser Use gateway is a compatibility wrapper around authenticated `/cdp/bootstrap`; it selects a browser, allocates a single Browser Use lane, and proxies standard `/json/version` metadata. The recent smoke test confirmed that `43827` is live, but an already connected Browser Use participant returns `lane-busy` and the Playwright CLI also exposes a trailing-slash version-path mismatch.

The initial Playwright CLI baseline is `@playwright/cli` 0.1.17. The existing baselines remain agent-browser 0.33.0 and Browser Use 0.13.7 with Browser Harness 0.1.8.

## Goals / Non-Goals

**Goals:**

- Connect Playwright CLI to the user's existing authorized Chrome/Chromium browser.
- Keep Playwright participant lifecycle independent from Browser Use's daemon and lane.
- Reuse the shared CDP relay, opaque target model, control lease, target scheduler, authorization checks, and revocation cleanup.
- Make a configured Panerelay CDP endpoint usable for an explicit Playwright CLI session through `.playwright/cli.config.json`, `PLAYWRIGHT_MCP_CDP_ENDPOINT`, or `attach --cdp`.
- Produce evidence-based compatibility classifications for Playwright CLI on Chrome and Edge.

**Non-Goals:**

- Do not implement Playwright's proprietary Extension transport or make `attach --extension` discover Panerelay.
- Do not expose a permanent CDP credential or a public remote endpoint.
- Do not add browser-process ownership, isolated contexts, proxy containment, launch flags, or browser-wide close.
- Do not alter agent-browser 0.33.0 or Browser Use 0.13.7 lane semantics.

## Decisions

### 1. Add a Playwright-specific discovery wrapper over the shared bootstrap relay

Add a loopback `/cdp/playwright` gateway that performs the same authenticated browser selection and `/cdp/bootstrap` request as the existing Browser Use gateway, but supplies `engine: "playwright"`, a dedicated lane key, and a Playwright actor label. The wrapper returns the ticket's standard CDP metadata and hides Bridge authentication.

The underlying `BrowserRelay` remains the only implementation of participant allocation, CDP session routing, target serialization, and cleanup. This avoids a second automation protocol while allowing client-specific discovery and concurrency policy.

Alternative rejected: making `/cdp/browser-use` multi-client. Browser Use's persistent daemon intentionally uses one canonical connection and its `lane-busy` response is part of its lifecycle contract. Sharing it with Playwright would couple two independent session models and make cleanup ambiguous.

### 2. Keep one participant per Playwright attach, with a separate lane

Each Playwright CLI attach gets one short-lived bootstrap ticket and one participant. Sequential CLI commands are handled by the Playwright CLI daemon; a reconnect obtains a fresh ticket. The lane key is `playwright:panerelay`, while Browser Use keeps `browser-use:panerelay`.

The participants may share the same browser control lease. Existing per-target scheduling remains the serialization point when two clients mutate the same target. A Playwright detach releases only its participant; it does not revoke Browser Use or side-panel participants.

### 3. Normalize the CDP discovery path, not the CDP semantics

The gateway and ticket endpoint accept both `/json/version` and `/json/version/`, return standard no-store CDP metadata, and keep the participant-scoped WebSocket URL constrained to loopback and the current Native Host generation. No Playwright-specific page actions are added to the protocol.

Alternative rejected: exposing a raw WebSocket URL as the configured default. It would be short-lived, unsafe to persist, and incompatible with Panerelay's bootstrap and revocation model.

### 4. Extend the existing controlled-favicon mechanism by engine

The Extension already injects an engine-specific favicon only when `cdpCommandTouchesDocument` classifies a command as control, restores the captured page icon on detach, and leaves passive setup/read/screenshot commands unmarked. Add a Playwright-specific icon and map it explicitly from the expanded engine union; do not let the default branch silently reuse the agent-browser icon. The green control badge and page-owned icon restoration remain shared behavior. Apply and restore the favicon asynchronously as best-effort presentation work so a scripting failure, a stalled document, or an open JavaScript dialog cannot block CDP dispatch or control cleanup.

This is an Extension presentation cue, not an authorization signal. Its success is not part of command or cleanup correctness. The side panel, action badge, control lease, and revocation state remain authoritative.

### 5. Add a first-class optional CLI adapter and configuration output

Add a `playwright` adapter alongside the existing agent-browser and Browser Use adapters. Setup verifies the user-installed `@playwright/cli` executable and minimum version, registers only Panerelay-owned adapter metadata, and returns the stable discovery URL in the child environment as `PLAYWRIGHT_MCP_CDP_ENDPOINT`. It does not install or modify the upstream Playwright package.

The setup command is opt-in and does not provide a Playwright user-level default. It may document `PLAYWRIGHT_MCP_CDP_ENDPOINT` and `.playwright/cli.config.json` as user-managed explicit configuration, but must not overwrite user files, edit shell startup files, shadow `playwright-cli`, or add Playwright to the Extension's default settings surface. The upstream CLI still requires an explicit `open` or `attach` session before `tab-list`.

### 6. Use a capability matrix with conservative classifications

The new compatibility record classifies each Playwright CLI command group as `Verified`, `Forwarded`, `Partial`, or `Unsupported`. The first real-Chrome gate covers attach, tab list/select/new/close, snapshot, locator actions, navigation, input, dialogs, screenshots, popup lifecycle, cleanup, and revocation. Isolated context and browser-process features remain `Unsupported`. Edge inherits only `Forwarded` until its own representative run passes, consistent with RFC-0005 and the existing browser-platform policy.

## Risks / Trade-offs

- [Risk] Playwright's CDP connection has lower fidelity than its native Playwright protocol and may assume BrowserContext features that an existing browser cannot honestly provide. → Mark unsupported operations explicitly, add command-trace fixtures, and never synthesize isolated contexts.
- [Risk] A Playwright CLI daemon may stay alive after its shell command exits. → Track participant heartbeat/transport loss, require explicit detach cleanup, and test stale daemon recovery and revocation.
- [Risk] Browser Use and Playwright can race on the same target. → Reuse the existing control lease and per-target FIFO scheduler; reject mutations after lease loss.
- [Risk] Playwright CLI or MCP changes its config/env contract. → Pin 0.1.17 for Verified evidence, probe version/handshake in doctor, and classify newer versions as unverified until rerun.
- [Risk] The gateway becomes another adapter-specific HTTP wrapper. → Keep its implementation thin and make the shared authenticated bootstrap/relay contract the sole source of participant and CDP behavior.
- [Risk] Setup default configuration could unexpectedly change user workflows. → Make Playwright selection explicit, preserve existing integration defaults, and keep authorization and default selection separate.

## Migration Plan

1. Add protocol and Bridge support behind the new `playwright` engine/lane while leaving existing routes untouched.
2. Add adapter registration, setup/doctor, environment/configuration guidance, and package/Skill documentation.
3. Run deterministic contract tests and a real Chrome verification using a local fixture page and explicitly authorized tabs.
4. Publish the compatibility record with the initial release classification; retain `Forwarded`/`Unsupported` claims where evidence is incomplete.
5. Roll back by removing the Playwright adapter registration and gateway route; existing Browser Use and agent-browser artifacts remain valid.
