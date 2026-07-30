## Context

See `proposal.md` for motivation. The setup package currently installs the Native Host, registers the Panerelay agent-browser plugin, and optionally writes project-level or user-level defaults. The Extension already maintains a private mapping between opaque relay targets and Chrome tabs, but its settings UI only exposes a target count and whole-session release. Native Messaging currently carries browser relay and Agent conversation families, not local integration settings.

The design must preserve RFC-0001's Native Host boundary, RFC-0002's browser authorization model, and RFC-0003's user-visible control ownership. Raw Chrome tab IDs remain Extension-private. Chrome permissions continue to require a user gesture.

## Goals / Non-Goals

**Goals:**

- Share one atomic implementation for reading, setting, and conditionally clearing the user-level agent-browser default between setup and the Native Host.
- Add actionable, localized readiness states without converting transient errors into false installation claims.
- Reuse the Extension's existing controlled-tab mapping for per-tab user actions.
- Preserve original diagnostics while adding bounded recovery guidance.

**Non-Goals:**

- The Extension does not edit project-level configuration, install local files, or execute setup.
- The Bridge does not learn Chrome tab IDs or implement browser automation semantics.
- An Agent request does not directly call `chrome.permissions.request`.

## Decisions

### Add a dedicated Native Messaging integration request family

The protocol will add correlated `integration.request` and `integration.response` messages for `default-provider.get`, `default-provider.set`, and `default-provider.clear`. The Native Host will handle these operations before browser-relay routing and return the resulting current value.

This keeps local configuration separate from Agent conversation methods and browser CDP messages. Reusing `agent.request` was rejected because default selection is a Panerelay integration setting, not an Agent runtime operation. Encoding it as a browser request was rejected because the Bridge, not Chrome, owns the filesystem write.

RFC-0001 will be updated with this message family and ownership boundary.

### Factor user-level default configuration into the Bridge package

A Bridge export will own atomic JSON reads and writes for `~/.agent-browser/config.json`. Setup will call that implementation for its existing `--global-provider` behavior, while the Native Host will expose read/set/conditional-clear operations to the Extension. Writes preserve unrelated keys and plugins. Clear removes `provider` only when its current value is `panerelay`; another Provider is never overwritten or cleared.

Keeping a second implementation in the Extension was rejected because MV3 cannot safely edit the local file. Duplicating the mutation in setup and the Native Host was rejected because their edge cases could drift.

### Keep controlled-tab actions entirely Extension-local

The shared control-session summary remains provider-neutral and count-based. The side panel will render recognizable tab titles and URLs from the background service worker's existing private `controlledTabs` map. Activate and close requests carry a tab ID only across Extension runtime messaging and are accepted only if that tab is still in the controlled map. Activation focuses the containing window; close removes the Chrome tab and lets existing removal handlers detach and refresh state.

Adding controlled target identifiers to the Bridge protocol was rejected because it is unnecessary for these browser-local actions and would widen a stable cross-package contract.

### Model Native Host readiness separately from connection state

The background service worker will expose `connecting`, `connected`, `missing`, and `disconnected` readiness. Only Chrome's recognized Native Messaging host-not-found diagnostic maps to `missing`; ordinary disconnects remain recoverable connection failures. A retry action resets the reconnect timer and immediately attempts a new connection.

The setup command remains copyable guidance only. The Extension never invokes it.

### Turn authorization denial into a pending user action

When `Target.createTarget` is denied because all-tabs authorization is absent, the background service worker will store an `all-tabs` authorization request hint, broadcast updated status, and return an explicit error directing the user to the Panerelay Extension. The side panel will render a compact authorization card. Its button uses the existing permission flow, so `chrome.permissions.request` still executes only from a user gesture. The hint clears after successful authorization or when authorization is explicitly released.

Automatically opening Chrome's prompt from the Agent request was rejected because it would lack a valid user gesture and violate the permission invariant.

### Classify only recognized Panerelay setup failures

A small pure classifier will match known Panerelay Provider/plugin readiness signatures, including `Plugin 'panerelay' returned success=false`. Matching failed activities keep their diagnostic text and gain a setup guide. Non-matching errors retain the existing presentation.

Broad matching on `success=false` was rejected because unrelated plugins and runtime failures would produce misleading installation advice.

### Keep MCP identifiers stable while shortening their display

The MCP server remains `panerelay_browser` so existing Agent configuration, Skill instructions, and tool calls stay compatible. The side panel applies a bounded activity-title alias from a leading `panerelay_browser` segment to `panerelay`; activity details and runtime payloads remain unchanged.

### Keep installation non-defaulting while retaining all explicit controls

The README quick start will use `npx --yes @panerelay/setup`. Separate concise guidance will document explicit `--global-provider`, `--project-provider`, and Extension user-level set/clear controls. The setup CLI contract and uninstall behavior remain unchanged.

### Keep the public beta ordinal independent from workflow retries

Beta npm versions use `X.Y.Z-beta.<run-number>`. `GITHUB_RUN_ATTEMPT` remains available only for the numeric Chrome build identity, so rerunning one workflow does not publish an unexpected npm prerelease such as `beta.1.2`. The publisher's existing identical-integrity check makes reuse of the same npm version safe after a partial retry.

Encoding both run number and run attempt in the npm prerelease was rejected because it exposed CI retry mechanics as a second public beta level and produced `beta.1.1` after an existing `beta.1`.

## Risks / Trade-offs

- [Chrome changes the Native Host error wording] → Keep the classification narrow, retain the raw diagnostic, and fall back to `disconnected` rather than falsely claiming installation is missing.
- [Concurrent tools edit agent-browser configuration] → Use the existing atomic temporary-file rename strategy and preserve all unrelated JSON keys; this does not claim cross-process locking.
- [A controlled tab disappears before a click] → Revalidate membership and tab existence in the background worker, fail closed, and refresh status.
- [Authorization guidance becomes stale] → Clear it on successful all-tabs authorization and explicit release; keep the actual authorization state authoritative.
- [Known plugin wording changes in agent-browser] → Keep the classifier isolated and covered by fixtures so additional signatures can be added without changing generic error behavior.
- [A workflow retry finds a partially published beta] → Reuse the same public beta version and let publication preflight skip identical tarballs while rejecting integrity drift.

## Migration Plan

1. Ship the protocol and Native Host handler together with the Extension that consumes the new messages.
2. Preserve setup's existing public options and route its global-default mutation through the shared helper.
3. Older Native Hosts will leave the Extension setting unavailable while existing browsing and Agent conversations continue to work.
4. Rollback removes the Extension controls and new message handling; the JSON mutations themselves require no migration because they use agent-browser's existing `provider` field.
