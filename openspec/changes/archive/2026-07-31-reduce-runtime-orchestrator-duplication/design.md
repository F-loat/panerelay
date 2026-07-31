## Context

See [proposal.md](proposal.md) for motivation. The Extension currently maintains separate pending maps and nearly identical request/response/disconnect code for Agent and integration operations. The Bridge's Codex, Claude, and Qoder adapters separately construct the same agent-browser MCP identity, arguments, scoped environment, instructions, and cleanup command.

RFC-0001 remains authoritative for the Bridge/Extension trust boundary, provider-neutral conversation messages, and user revocation. RFC-0006 remains authoritative for exact browser pinning and participant cleanup. This refactor must preserve the agent-browser 0.33.0 compatibility baseline and does not change the existing `Verified`, `Forwarded`, `Partial`, or `Unsupported` classifications.

## Goals / Non-Goals

**Goals:**

- Give each repeated lifecycle one internal owner with a small typed API.
- Preserve request IDs, timeout text, response validation, browser selectors, MCP names and arguments, environment values, cleanup bounds, and diagnostic behavior.
- Keep provider-native serialization visible in each Provider adapter.
- Make the extracted behavior independently testable.
- Keep runtime entry points focused on state ownership, event wiring, and cross-module coordination.
- Give security-sensitive CDP policy, target scheduling, activity history, UI request dispatch, reducer transitions, image validation, and injected static assets explicit module owners.

**Non-Goals:**

- Do not create a new workspace package or public Bridge export.
- Do not generalize all Provider behavior behind a base class.
- Do not alter Native Messaging framing or protocol validation.
- Do not move lease, target, or permission enforcement out of their existing owners.
- Do not introduce a generic orchestration framework or split synchronous mutable state across modules without a stable API.
- Do not change how `chrome.scripting.executeScript` isolates page-comment state per frame.

## Decisions

### Use a generic Extension request tracker with caller-owned response validation

Add an internal `PendingRequestTracker<TResult>` that owns correlation IDs, timers, pending promise settlement, synchronous dispatch-failure cleanup, and reject-all behavior. The background worker will keep Agent and integration response validation at the call site because their protocol envelopes have different success rules.

The tracker accepts the timeout, ID generator, and timeout-message formatter as constructor inputs. This keeps tests deterministic and preserves the current operation-specific timeout text.

Alternative considered: one generic Native Messaging RPC client that also serializes protocol envelopes. Rejected because it would couple Agent and integration message shapes and obscure their different response validation.

### Share an agent-browser session definition, not Provider-native MCP objects

Add a Bridge-internal module that owns:

- the agent-browser MCP name, arguments, Provider ID, and side-panel instructions;
- a provider-neutral session descriptor containing executable, config path, and label;
- construction of the scoped environment, including the exact browser selector when present;
- the bounded `agent-browser ... close` command.

Codex, Claude, and Qoder will continue to translate this definition into their own configuration formats. This avoids a broad Provider abstraction while ensuring shared security-sensitive values cannot drift.

Alternative considered: a common Provider base class. Rejected because the app-server, stream-json, and ACP lifecycles differ substantially; inheritance would hide rather than remove complexity.

### Preserve cleanup policy at the adapter boundary

The shared helper throws when agent-browser cleanup fails. Each Provider retains its current decision about whether and how to sanitize that failure, so successful Agent results are not reclassified and existing diagnostics remain stable.

Alternative considered: swallowing cleanup failures in the helper. Rejected because it would remove adapter-specific observability and make tests unable to assert failure behavior.

### Keep BrowserRelay ownership centralized while extracting stable mechanics

`BrowserRelay` remains the only owner of participants, leases, WebSocket transports, opaque target/session routing, debugger attachment state, and Extension coordination. Three mechanics with narrow inputs and outputs move behind internal modules:

- CDP scope policy receives target metadata, method, and params and returns a bounded policy error or `null`;
- a generic per-key command scheduler owns FIFO acquisition, idempotent release, and waiter cancellation;
- a control-activity journal owns correlation, bounded retention, sequencing, snapshots, and sanitized activity emission.

The relay passes participant and lease facts into the activity journal rather than allowing that module to inspect routing state. This preserves the Bridge policy boundary while making policy and lifecycle invariants directly testable.

Alternative considered: split the relay into separate HTTP, WebSocket, lease, and target-controller classes. Rejected for this change because those parts share synchronous teardown ordering; moving them together would create a larger ownership redesign rather than a bounded refactor.

### Extract a typed side-panel request router from the Extension background entry point

The background worker retains browser authorization, Native Messaging, CDP target state, Chrome event listeners, and service construction. A typed request router receives explicit callbacks and service-shaped dependencies, then maps each `SidePanelRequest` to the existing response and side effect.

This removes the UI command switch from the browser-control entry point without moving authorization or controlled-tab validation into UI code.

Alternative considered: encapsulate the entire background worker in one application class. Rejected because it would relocate module-global MV3 service-worker lifecycle state without reducing its coupling.

### Separate Side Panel state and image preparation from React orchestration

Move the state model, initial-state factory, reducer, and timeline transition helpers to a pure state module. Move image MIME/count/size validation and file-to-base64 preparation to a separate helper returning accepted images plus the same localized error keys or values. The controller continues to own generation guards, client requests, optimistic sends, React effects, and refs.

The controller module re-exports the state-facing symbols used by existing callers so this remains an internal source-layout change.

Alternative considered: split every action group into a custom Hook. Rejected because most actions share activation generations, mutable current state, and interruption behavior; distributing those refs would obscure ordering.

### Pass static page-comment assets into the self-contained injected runtime

`chrome.scripting.executeScript` serializes the provided function without its module closure, so the runtime cannot import executable helpers. Move only serializable static data—style properties, localized labels, SVG strings, and editor CSS—to an assets module. The background worker supplies that object through `executeScript.args`, and tests invoke or serialize the runtime with the same object.

Dynamic DOM state, event handlers, evidence capture, style mutation, and cleanup remain inside `installPageCommentsRuntime`. This makes the injection constraint explicit and reduces embedded presentation data without using `eval`, a permanent content script, or a page-global API.

Alternative considered: bundle the runtime as a separately injected file. Rejected because it would add build-output naming and manifest/runtime loading concerns unrelated to this refactor.

## Risks / Trade-offs

- [A shared helper subtly changes timeout or cleanup semantics] → Preserve existing constants and add direct helper tests plus unchanged Provider regression tests.
- [Provider-native configuration needs diverge later] → Share only stable agent-browser identity and session mechanics; keep serialization in each adapter.
- [A tracker settles a request more than once] → Remove the entry before resolving or rejecting and return a boolean for unknown/stale response IDs.
- [Refactoring a security boundary is mistaken for a compatibility improvement] → Make no new compatibility claim and require the existing full test and strict OpenSpec suites.
- [Extracted Relay modules accidentally gain ownership of leases or raw Chrome identifiers] → Pass only bounded inputs and keep all routing maps private to `BrowserRelay`.
- [A request router bypasses authorization checks] → Keep authorization and controlled-target validation in injected callbacks and assert the router only dispatches.
- [Serialized page-comment assets drift from direct runtime tests] → Export one immutable asset object and pass it in both production injection and tests.
- [File count grows without reducing cognitive load] → Extract only responsibilities with named invariants and independent tests; review imports and remaining orchestrator roles after each move.

## Compatibility Review

The implementation retains RFC-0001's provider-neutral request boundary and RFC-0006's exact browser selector in every Provider-native MCP payload. Agent and integration messages keep their existing timeout and response rules, while browser-session cleanup keeps its existing process environment, five-second bound, command shape, and adapter-specific failure handling.

The relay extraction also preserves RFC-0002's bounded target inventory, lazy attachment, background activation, browser-process denial, and target-origin cookie/storage limits. `BrowserRelay` still owns every participant, credential, transport, target/session mapping, and debugger attachment. The extracted scheduler cannot authorize work, and the extracted policy function cannot attach or route a target.

RFC-0003 control-session ownership, participant liveness, teardown, correlation, sanitization, sequence, and bounded activity replay remain unchanged: the journal receives already-authorized session facts and never owns a lease or transport. RFC-0004's separation of passive read observation from active control remains in `BrowserRelay`; only control commands enter the scheduler and activity journal.

The agent-browser 0.33.0 compatibility groups for side-panel Provider sessions, browser tools, normal Provider release, and participant cleanup therefore keep their current classifications. No compatibility document or RFC update is required because this change adds no behavior, evidence, platform, protocol, permission, lease, routing, or ownership claim.

## Structural Review

The four original orchestrator files now retain only the state and ordering that cannot be separated without changing ownership:

| Orchestrator | Before | After | Extracted responsibility |
| --- | --: | --: | --- |
| `BrowserRelay` | 1,760 | 1,460 | CDP policy, keyed FIFO scheduling, and control-activity journaling |
| Extension background | 1,316 | 1,158 | pending request lifecycle and typed side-panel dispatch |
| Side Panel controller | 1,518 | 1,202 | reducer/state transitions and image validation/preparation |
| Page-comment runtime | 1,405 | 1,236 | immutable locale, property, SVG, and editor-CSS assets |

The remaining relay code coordinates leases, transports, Extension messages, target/session maps, and teardown. The remaining background code owns MV3 listeners, authorization, Native Messaging, Chrome debugger state, and service wiring. The remaining controller owns React effects, activation generations, optimistic request flows, and client calls. The remaining injected runtime owns per-frame DOM state and event cleanup because executable module helpers are not available after `executeScript` serializes the function.

Imports point from orchestrators to leaf modules. The relay policy, scheduler, and journal do not import `BrowserRelay`; Side Panel state does not import the controller, while image preparation depends only on state types and localization; runtime assets have no imports, and the injected runtime consumes them only as an explicit argument. No extracted module is added to a package export map, and the controller re-exports its existing state-facing symbols to avoid an internal source-layout break.

## Migration Plan

1. Add and test the Extension tracker, then replace the two background pending maps.
2. Add and test the Bridge agent-browser session helper, then migrate each Provider without changing its public surface.
3. Extract and test Relay policy, scheduling, and activity history, then leave the relay responsible only for coordination and state ownership.
4. Extract and test the Extension request router, Side Panel state and image preparation, and serializable page-comment assets.
5. Review the resulting dependency directions and orchestrator responsibilities.
6. Run targeted Extension and Bridge tests, full workspace checks, strict OpenSpec validation, `git diff --check`, and a bounded daily-Chrome regression.

There is no persisted-state or release migration. Rollback restores the in-file helpers and pending maps; protocol and browser state remain compatible.
