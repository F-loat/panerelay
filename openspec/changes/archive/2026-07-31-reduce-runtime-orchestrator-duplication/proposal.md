## Why

The Extension and Bridge contain both repeated lifecycle plumbing and several large runtime orchestrators whose unrelated responsibilities have accumulated in single files. Consolidating repeated mechanics and extracting stable responsibility boundaries now reduces drift, review cost, and regression risk without changing Panerelay's accepted behavior.

## What Changes

- Add one typed Extension request tracker for correlated Native Messaging requests, including timeout, synchronous-send failure, response settlement, and disconnect cleanup.
- Replace the separate Agent and integration pending-request maps with tracker instances while preserving their existing timeouts, messages, and response validation.
- Add one Bridge-internal agent-browser session module for MCP arguments, scoped environment construction, side-panel instructions, and bounded session cleanup.
- Adapt Codex, Claude, and Qoder to serialize the shared browser-session definition into their provider-native configuration formats.
- Extract browser-relay CDP scope policy, per-target command scheduling, and control-activity history into independently testable Bridge modules while keeping `BrowserRelay` as the routing and ownership coordinator.
- Extract Extension side-panel request dispatch from the background worker while keeping authorization, CDP attachment, target exposure, and Native Messaging state in their existing owners.
- Separate Side Panel state transitions and image-input preparation from the controller Hook so React effects and user actions no longer share one module with the reducer and binary validation rules.
- Move serializable page-comment locale, style-property, icon, and editor stylesheet assets out of the injected runtime while keeping the injected function self-contained through explicit arguments.
- Add focused regression tests for every extracted lifecycle, policy, state, scheduling, and serialization boundary.
- Keep all public protocol messages, Provider capabilities, browser selection, authorization, control leases, and user-visible behavior unchanged.

Non-goals:

- Do not replace `BrowserRelay`, the Extension background worker, or the Side Panel controller with a generic framework or dependency-injection container.
- Do not split state that requires synchronous ownership merely to meet a line-count target.
- Do not change the `@panerelay/protocol` surface, browser registration state, selection precedence, permissions, target exposure, or cleanup ownership.
- Do not move automation semantics out of agent-browser or add support for another automation engine.
- Do not allow one Provider session, participant, or control lease to span browsers.

The compatibility baseline remains agent-browser 0.33.0. The affected compatibility groups are side-panel Provider sessions, Provider-scoped browser MCP configuration, participant cleanup, and Native Messaging request correlation; their externally observable requirements remain unchanged.

## Capabilities

### New Capabilities

None. This is an internal behavior-preserving refactor.

### Modified Capabilities

None. Existing capability requirements remain unchanged.

## Impact

- `apps/extension/src/background`: shared request tracking, side-panel request routing, focused tests, and thinner background-worker integration.
- `apps/extension/src/pages/sidepanel`: reducer/state and image-input modules with a controller focused on effects and action orchestration.
- `apps/extension/src/content`: explicit serializable assets for the self-contained page-comment runtime.
- `packages/bridge/src`: shared agent-browser sessions plus extracted relay policy, command scheduling, activity history, focused tests, and thinner orchestration.
- No new runtime dependency, public export, protocol version, persisted state, migration, or compatibility claim.
